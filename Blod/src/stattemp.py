import pandas as pd
import numpy as np
from scipy.stats import shapiro, ttest_rel, wilcoxon, pearsonr, spearmanr
import matplotlib.pyplot as plt
import os
import re
import warnings


# -----------------------------
# PATHS
# -----------------------------
fc_path = "D:/PycharmProjects/BLOD/Blod/fairness_results FAIR Checker.csv"
kg_path = "D:/PycharmProjects/BLOD/WebApp/backend/data/fairness-data.csv"
output_dir = "analysis_output"
os.makedirs(output_dir, exist_ok=True)

# -----------------------------
# LOAD DATA
# -----------------------------
fc = pd.read_csv(fc_path)
kg = pd.read_csv(kg_path)

# -----------------------------
# NORMALIZE COLUMN NAMES
# -----------------------------
def normalize_columns(df):
    df.columns = [c.strip().lower() for c in df.columns]
    return df

fc = normalize_columns(fc)
kg = normalize_columns(kg)

# -----------------------------
# STANDARDIZE ID + TITLE
# -----------------------------
def normalize_text(s):
    if pd.isna(s):
        return np.nan
    s = str(s).lower().strip()
    s = re.sub(r'\s+', ' ', s)
    return s

# rename possible variants
fc.rename(columns={"kg id": "id", "kgid": "id"}, inplace=True)
kg.rename(columns={"kg id": "id", "kgid": "id"}, inplace=True)
fc.rename(columns={"kg name": "title", "name": "title"}, inplace=True)
kg.rename(columns={"kg name": "title", "name": "title"}, inplace=True)

if "id" not in fc.columns or "id" not in kg.columns:
    raise ValueError("ID column missing in one of the files")

if "title" not in fc.columns or "title" not in kg.columns:
    raise ValueError("Title column missing in one of the files")

fc["id_norm"] = fc["id"].astype(str).str.strip()
kg["id_norm"] = kg["id"].astype(str).str.strip()

fc["title_norm"] = fc["title"].apply(normalize_text)
kg["title_norm"] = kg["title"].apply(normalize_text)

# -----------------------------
# REMOVE DUPLICATES (BY ID)
# -----------------------------
fc = fc.drop_duplicates(subset=["id_norm"])
kg = kg.drop_duplicates(subset=["id_norm"])

# -----------------------------
# MERGE STRATEGY
# -----------------------------

# 1️⃣ ID-based merge (authoritative)
merged_id = pd.merge(
    fc,
    kg,
    on="id_norm",
    how="inner",
    suffixes=("_fc", "_kg")
)
merged_id["match_type"] = "id"

# 2️⃣ TITLE-based merge ONLY for unmatched rows
fc_unmatched = fc[~fc["id_norm"].isin(merged_id["id_norm"])]
kg_unmatched = kg[~kg["id_norm"].isin(merged_id["id_norm"])]

merged_title = pd.merge(
    fc_unmatched,
    kg_unmatched,
    on="title_norm",
    how="inner",
    suffixes=("_fc", "_kg")
)
merged_title["match_type"] = "title"

# 3️⃣ COMBINE
merged = pd.concat([merged_id, merged_title], ignore_index=True)

merged.to_csv(os.path.join(output_dir, "merged_full_fixed.csv"), index=False)

print("\nMERGE SUMMARY")
print("--------------------")
print(f"ID-based matches     : {len(merged_id)}")
print(f"Title-based matches  : {len(merged_title)}")
print(f"Total merged records : {len(merged)}")

# -----------------------------
# METRIC MAPPING
# -----------------------------
mapping = {
    "f1a_score": "f1",
    "f1b_score": "f1",
    "f2a_score": "f2",
    "f2b_score": "f2",
    "a1.1_score": "a1.1",
    "a1.2_score": "a1.2",
    "i1_score": "i1",
    "i2_score": "i2",
    "i3_score": "i3",
    "r1.1_score": "r1.1",
    "r1.2_score": "r1.2",
    "r1.3_score": "r1.3"
}

# -----------------------------
# ANALYSIS
# -----------------------------
results = []

for fc_col, kg_prefix in mapping.items():
    fc_candidates = [c for c in merged.columns if c.startswith(fc_col)]
    kg_candidates = [c for c in merged.columns if kg_prefix in c.lower()]

    if not fc_candidates or not kg_candidates:
        continue

    a = pd.to_numeric(merged[fc_candidates[0]], errors="coerce")
    b = pd.to_numeric(merged[kg_candidates[0]], errors="coerce")

    mask = a.notna() & b.notna()
    a = a[mask]
    b = b[mask]
    n = len(a)

    shapiro_p = paired_t_p = wilcoxon_p = pearson_r = spearman_r = np.nan

    if n >= 3 and a.nunique() > 1 and b.nunique() > 1:
        try:
            if shapiro(a - b).pvalue >= 0.05:
                paired_t_p = ttest_rel(a, b).pvalue
            else:
                wilcoxon_p = wilcoxon(a, b).pvalue
        except:
            pass

        try:
            pearson_r = pearsonr(a, b)[0]
        except:
            pass

        try:
            spearman_r = spearmanr(a, b)[0]
        except:
            pass

    results.append({
        "FAIR_metric": fc_col,
        "KG_metric": kg_prefix,
        "n": n,
        "paired_t_p": paired_t_p,
        "wilcoxon_p": wilcoxon_p,
        "pearson_r": pearson_r,
        "spearman_r": spearman_r
    })

results_df = pd.DataFrame(results)
results_df.to_csv(os.path.join(output_dir, "stat_results_per_metric_fixed.csv"), index=False)

print("\nAnalysis complete.")
print("Outputs saved in 'analysis_output/'")
