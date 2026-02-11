import pandas as pd
import numpy as np
from scipy.stats import shapiro, ttest_rel, wilcoxon, pearsonr, spearmanr
import matplotlib.pyplot as plt
import os
import re
import warnings


# Paths (adjust if needed)
fc_path = "D:/PycharmProjects/BLOD/Blod/fairness_results FAIR Checker.csv"
kg_path = "D:/PycharmProjects/BLOD/WebApp/backend/data/fairness-data.csv"
output_dir = "analysis_output"
os.makedirs(output_dir, exist_ok=True)

# -----------------------------
# Load CSVs
# -----------------------------
fc = pd.read_csv(fc_path)
kg = pd.read_csv(kg_path)

# -----------------------------
# Normalize KG column names
# -----------------------------
kg_cols_lower = {c.lower(): c for c in kg.columns}

# Normalize title
for variant in ["kg name", "kg_name", "title", "name"]:
    if variant in kg_cols_lower:
        kg = kg.rename(columns={kg_cols_lower[variant]: "title"})
        break

# Normalize id
for variant in ["kg id", "kg_id", "kgid", "id"]:
    if variant in kg_cols_lower:
        kg = kg.rename(columns={kg_cols_lower[variant]: "id"})
        break

if "title" not in kg.columns:
    raise ValueError("ERROR: No title-like column found in KG CSV.")

# -----------------------------
# REMOVE DUPLICATES
# -----------------------------
print("\nRemoving duplicates...")

fc_before = len(fc)
fc = fc.drop_duplicates(subset=["title"], keep="first")
fc_after = len(fc)
print(f"FC duplicates removed: {fc_before - fc_after}")

kg_before = len(kg)
kg = kg.drop_duplicates(subset=["title"], keep="first")
kg_after = len(kg)
print(f"KG duplicates removed: {kg_before - kg_after}")

# -----------------------------
# MERGE
# -----------------------------
merged = pd.merge(fc, kg, on="title", how="inner", suffixes=("_fc", "_kg"))
merged.to_csv(os.path.join(output_dir, "merged_full.csv"), index=False)

print(f"\nMerged {len(merged)} rows. Saved to {os.path.join(output_dir, 'merged_full.csv')}")

# After merge duplication stats
print("FC duplicate titles:", fc['title'].duplicated().sum())
print("KG duplicate titles:", kg['title'].duplicated().sum())

print("\nTop duplicates in KG (before cleaning):")
print(kg['title'].value_counts().head(10))

# -----------------------------
# METRIC MAPPING
# -----------------------------
mapping = {
    "F1A_score": "F1-M: Unique and persistent ID",
    "F1B_score": "F1-M: Unique and persistent ID",
    "F2A_score": "F2a-M: Metadata availability via standard primary sources",
    "F2B_score": "F2a-M: Metadata availability via standard primary sources",
    "A1.1_score": "A1.1-M: Working primary sources with metadata",
    "A1.2_score": "A1.2: Authentication & HTTPS support",
    "I1_score": "I1-M: Metadata are described with VoID/DCAT predicates",
    "I2_score": "I2 Use of FAIR vocabularies",
    "I3_score": "I3-D: Degree of connection",
    "R1.1_score": "R1.1: Any license retrievable",
    "R1.2_score": "R1.2: Publisher details",
    "R1.3_score": "R1.3-M: VoID/DCAT description"
}

# -----------------------------
# Helper functions
# -----------------------------
def norm(s):
    if pd.isna(s):
        return ""
    s = str(s).lower()
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def safe_filename(s):
    s = str(s)
    s = re.sub(r'[<>:"/\\|?*]', '_', s)
    s = s.replace(' ', '_')
    return s

kg_cols = merged.columns.tolist()
kg_cols_norm = {c: norm(c) for c in kg_cols}

# -----------------------------
# MAP FAIR Checker → KGHeartbeat metrics
# -----------------------------
mapped_pairs = []
for fc_col, kg_label in mapping.items():
    if fc_col not in merged.columns:
        alt = fc_col.replace('_score', '')
        if alt in merged.columns:
            fc_col = alt
        else:
            continue
    target_norm = norm(kg_label)
    found = None
    for col, ncol in kg_cols_norm.items():
        if target_norm and target_norm in ncol:
            found = col
            break
    if not found:
        short = kg_label.split(':')[0]
        shortn = norm(short)
        for col, ncol in kg_cols_norm.items():
            if shortn and shortn in ncol:
                found = col
                break
    if found:
        mapped_pairs.append((fc_col, found))
    else:
        print(f"Warning: no match for '{kg_label}' (FAIR col '{fc_col}')")

if len(mapped_pairs) == 0:
    raise SystemExit("No mapped metrics found! Check mapping labels and KGHeartbeat header names.")

# -----------------------------
# ANALYSIS
# -----------------------------
results = []
plot_files = []

fc_matrix = pd.DataFrame(index=merged.index)
kg_matrix = pd.DataFrame(index=merged.index)

for fc_col, kg_col in mapped_pairs:
    a = pd.to_numeric(merged[fc_col], errors='coerce')
    b = pd.to_numeric(merged[kg_col], errors='coerce')
    mask = ~(a.isna() & b.isna())
    a = a[mask].copy()
    b = b[mask].copy()
    a, b = a.align(b, join='inner')
    n = len(a)

    shapiro_fc_p = shapiro_kg_p = np.nan
    paired_t_stat = paired_t_p = np.nan
    wilcoxon_p = np.nan
    pearson_r = pearson_p = np.nan
    spearman_r = spearman_p = np.nan

    if n >= 3 and a.nunique() > 1 and b.nunique() > 1:
        try:
            shapiro_fc_p = shapiro(a).pvalue
        except:
            pass
        try:
            shapiro_kg_p = shapiro(b).pvalue
        except:
            pass

        diff = (a - b).dropna()
        use_t = False
        if len(diff) >= 3 and diff.nunique() > 1:
            try:
                use_t = shapiro(diff).pvalue >= 0.05
            except:
                pass

        if use_t and len(diff) >= 3:
            try:
                paired_t_stat, paired_t_p = ttest_rel(a, b, nan_policy='omit')
            except:
                pass
        else:
            try:
                if len(a) >= 1:
                    _, wilcoxon_p = wilcoxon(a, b)
            except:
                pass

        try:
            pearson_r, pearson_p = pearsonr(a, b)
        except:
            pass
        try:
            spearman_r, spearman_p = spearmanr(a, b)
        except:
            pass

    fc_matrix[fc_col] = pd.to_numeric(merged[fc_col], errors='coerce')
    kg_matrix[kg_col] = pd.to_numeric(merged[kg_col], errors='coerce')

    results.append({
        'FAIR_col': fc_col,
        'KG_col': kg_col,
        'n': n,
        'shapiro_fc_p': shapiro_fc_p,
        'shapiro_kg_p': shapiro_kg_p,
        'paired_t_stat': paired_t_stat,
        'paired_t_p': paired_t_p,
        'wilcoxon_p': wilcoxon_p,
        'pearson_r': pearson_r,
        'pearson_p': pearson_p,
        'spearman_r': spearman_r,
        'spearman_p': spearman_p
    })

results_df = pd.DataFrame(results)
results_df.to_csv(os.path.join(output_dir, "stat_results_per_metric.csv"), index=False)
print("\nSaved per-metric statistics.")

# -----------------------------
# SCATTER PLOTS
# -----------------------------
for fc_col, kg_col in mapped_pairs:
    a = pd.to_numeric(merged[fc_col], errors='coerce')
    b = pd.to_numeric(merged[kg_col], errors='coerce')
    mask = a.notna() & b.notna()
    if mask.sum() < 2:
        continue
    plt.figure(figsize=(5,4))
    plt.scatter(a[mask], b[mask])
    plt.xlabel(fc_col)
    plt.ylabel(kg_col)
    plt.title(f"{fc_col} vs {kg_col} (n={mask.sum()})")
    plt.grid(True)
    fname = os.path.join(output_dir, f"scatter_{safe_filename(fc_col)}_vs_{safe_filename(kg_col)}.png")
    plt.savefig(fname, bbox_inches='tight')
    plt.close()
    plot_files.append(fname)

# -----------------------------
# CORRELATION MATRICES
# -----------------------------
pearson_corr = pd.DataFrame(index=fc_matrix.columns, columns=kg_matrix.columns, dtype=float)
spearman_corr = pd.DataFrame(index=fc_matrix.columns, columns=kg_matrix.columns, dtype=float)

for c1 in fc_matrix.columns:
    for c2 in kg_matrix.columns:
        x = fc_matrix[c1]
        y = kg_matrix[c2]
        mask = x.notna() & y.notna()
        if mask.sum() >= 3 and x[mask].nunique() > 1 and y[mask].nunique() > 1:
            try:
                pearson_corr.loc[c1,c2] = pearsonr(x[mask], y[mask])[0]
            except:
                pearson_corr.loc[c1,c2] = np.nan
            try:
                spearman_corr.loc[c1,c2] = spearmanr(x[mask], y[mask])[0]
            except:
                spearman_corr.loc[c1,c2] = np.nan
        else:
            pearson_corr.loc[c1,c2] = np.nan
            spearman_corr.loc[c1,c2] = np.nan

pearson_corr.to_csv(os.path.join(output_dir, "pearson_corr_matrix.csv"))
spearman_corr.to_csv(os.path.join(output_dir, "spearman_corr_matrix.csv"))
print("Saved correlation matrices.")

# -----------------------------
# HEATMAPS
# -----------------------------
def save_heatmap(df, fname, title):
    plt.figure(figsize=(8,6))
    mat = df.astype(float).values
    plt.imshow(mat, aspect='auto', interpolation='nearest')
    plt.colorbar()
    plt.yticks(range(len(df.index)), df.index)
    plt.xticks(range(len(df.columns)), df.columns, rotation=90)
    plt.title(title)
    plt.tight_layout()
    plt.savefig(fname, bbox_inches='tight')
    plt.close()

save_heatmap(pearson_corr, os.path.join(output_dir, "pearson_heatmap.png"), "Pearson Correlation")
save_heatmap(spearman_corr, os.path.join(output_dir, "spearman_heatmap.png"), "Spearman Correlation")

print("\nDone! Check the 'analysis_output' folder for all results.")
