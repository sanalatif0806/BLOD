# Reusing the KG Pipeline for a Different Project

> `kg_pipeline.py` is designed to convert **any** MongoDB JSON export into a
> proper RDF Knowledge Graph and load it into Fuseki automatically.
> This guide walks you through every change needed to adapt it for a new dataset.

---

## Overview of what to change

There are **4 configuration blocks** at the top of `kg_pipeline.py` (lines 68–130).
You only need to edit these — the rest of the script works automatically.

```
kg_pipeline.py
├── BASE_URI          ← your namespace (1 line)
├── FIELD_MAP         ← your JSON field names (edit/add/remove entries)
├── FAIR_SCORE_COLUMNS← your CSV column names (optional, remove if no FAIR CSV)
└── HEALTH_CATEGORIES ← your domain categories (optional, remove if not needed)
```

---

## Step 1 — Change BASE_URI

This becomes the namespace for all URIs in your Knowledge Graph.

```python
# CURRENT (BLOD)
BASE_URI     = "http://blod.isislab.it"
ONTOLOGY_URI = f"{BASE_URI}/ontology#"   # → http://blod.isislab.it/ontology#
RESOURCE_URI = f"{BASE_URI}/resource/"   # → http://blod.isislab.it/resource/
FAIR_URI     = f"{BASE_URI}/fair#"       # → http://blod.isislab.it/fair#

# EXAMPLE — for a new project called "MyKG"
BASE_URI     = "http://mykg.example.org"
ONTOLOGY_URI = f"{BASE_URI}/ontology#"   # → http://mykg.example.org/ontology#
RESOURCE_URI = f"{BASE_URI}/resource/"   # → http://mykg.example.org/resource/
FAIR_URI     = f"{BASE_URI}/fair#"       # → http://mykg.example.org/fair#
```

---

## Step 2 — Change FIELD_MAP

This tells the pipeline which field in your JSON maps to which RDF predicate.

### Current BLOD mapping

```python
FIELD_MAP = {
    "identifier":  ("DCTERMS", "identifier",  "literal"),
    "title":       ("DCTERMS", "title",        "lang_literal"),
    "license":     ("DCTERMS", "license",      "uri"),
    "doi":         ("DCTERMS", "identifier",   "literal"),
    "website":     ("SCHEMA",  "url",          "uri"),
    "triples":     ("VOID",    "triples",      "integer"),
    "namespace":   ("VOID",    "uriSpace",     "literal"),
    "domain":      ("BLOD",    "domain",       "literal"),
    "wikidataurl": ("OWL",     "sameAs",       "uri"),
}
```

### Format explained

```python
"your_json_field": ("NAMESPACE", "rdf_predicate", "type")
```

**Available namespaces:**

| Key | Prefix | URI |
|---|---|---|
| `"DCTERMS"` | `dct:` | `http://purl.org/dc/terms/` |
| `"DCAT"` | `dcat:` | `http://www.w3.org/ns/dcat#` |
| `"SCHEMA"` | `schema:` | `https://schema.org/` |
| `"VOID"` | `void:` | `http://rdfs.org/ns/void#` |
| `"FOAF"` | `foaf:` | `http://xmlns.com/foaf/0.1/` |
| `"OWL"` | `owl:` | `http://www.w3.org/2002/07/owl#` |
| `"BLOD"` | `blod:` | your custom ontology namespace |

**Available types:**

| Type | Use for | Example value |
|---|---|---|
| `"literal"` | plain text strings | `"bio2rdf-chembl"` |
| `"lang_literal"` | text with language tag (`@en`) | `"ChEMBL database"` |
| `"uri"` | HTTP URLs | `"http://creativecommons.org/licenses/by/4.0/"` |
| `"integer"` | whole numbers | `"409942525"` |
| `"decimal"` | decimal numbers | `"3.32"` |

### Example — adapting for a clinical trials dataset

Say your JSON looks like this:
```json
{
  "trial_id": "NCT12345678",
  "study_title": "Effect of Drug X on...",
  "sponsor": "University of Example",
  "phase": "Phase 3",
  "status": "Completed",
  "start_date": "2020-01-01",
  "registry_url": "https://clinicaltrials.gov/ct2/show/NCT12345678",
  "conditions": ["Diabetes", "Hypertension"],
  "publications_count": 12
}
```

Your FIELD_MAP would be:
```python
FIELD_MAP = {
    "trial_id":          ("DCTERMS", "identifier",   "literal"),
    "study_title":       ("DCTERMS", "title",         "lang_literal"),
    "sponsor":           ("DCTERMS", "publisher",     "literal"),
    "phase":             ("BLOD",    "trialPhase",    "literal"),
    "status":            ("BLOD",    "trialStatus",   "literal"),
    "start_date":        ("DCTERMS", "date",          "literal"),
    "registry_url":      ("SCHEMA",  "url",           "uri"),
    "publications_count":("BLOD",    "publications",  "integer"),
}
```

---

## Step 3 — Change the identifier field

The pipeline uses `record.get("identifier")` to build each dataset's URI.
If your JSON uses a different field name for the unique ID, update this line:

```python
# In the build_graph() function, around line 195:

# CURRENT
identifier = (record.get("identifier") or "").strip()

# CHANGE TO your field name, e.g.:
identifier = (record.get("trial_id") or "").strip()
# or:
identifier = (record.get("id") or record.get("_id") or "").strip()
```

---

## Step 4 — Change FAIR_SCORE_COLUMNS (or remove it)

### If your project has NO FAIR scores

Remove the `--fair` argument when running and set `FAIR_SCORE_COLUMNS = {}`:
```python
FAIR_SCORE_COLUMNS = {}
```

### If your project has quality scores with different column names

Say your CSV has columns: `Dataset ID`, `Quality Score`, `Completeness`, `Accuracy`:

```python
FAIR_SCORE_COLUMNS = {
    "Dataset ID":    "__id__",          # ← always keep this, it's the join key
    "Quality Score": "quality_score",
    "Completeness":  "completeness",
    "Accuracy":      "accuracy",
}
```

The pipeline will then create RDF triples like:
```turtle
<http://mykg.example.org/fair/dataset-123>
    a blod:FAIRAssessment ;
    fair:quality_score 0.87 ;
    fair:completeness 0.92 ;
    fair:accuracy 0.85 .
```

The `__id__` value tells the pipeline which column to use to join the CSV row to the JSON record. It must match the value returned by `record.get("identifier")` (or whatever field you set in Step 3), lowercased.

---

## Step 5 — Change HEALTH_CATEGORIES (or remove it)

### If your project has NO categories

Set it to an empty list:
```python
HEALTH_CATEGORIES = []
```

### If your project has different categories

Replace the list with your own:
```python
# Example — clinical trials categorisation
HEALTH_CATEGORIES = [
    "Oncology",
    "Cardiovascular",
    "Neurology",
    "Infectious Disease",
    "Rare Diseases",
    "Metabolic Disorders",
    "Mental Health",
]
```

The pipeline creates a URI for each category automatically:
- `"Oncology"` → `http://mykg.example.org/resource/category/Oncology`
- `"Cardiovascular"` → `http://mykg.example.org/resource/category/Cardiovascular`

To assign a category to a record, your JSON must include the category name in an array field. The pipeline checks the `keywords` field by default. If your field is named differently (e.g. `"therapeutic_area"`), update this section in `build_graph()`:

```python
# CURRENT — checks record["keywords"]
for kw in (record.get("keywords") or []):

# CHANGE TO your field name:
for kw in (record.get("therapeutic_area") or []):
```

---

## Step 6 — Change the docker-compose paths

If you're using the Docker automation, update the volume mounts in `docker-compose.yml`:

```yaml
# CURRENT (BLOD paths)
kg-pipeline:
  environment:
    - JSON_PATH=/data/BLOD.json
    - FAIR_PATH=/data/fairness-data.csv
  volumes:
    - ./backend/mongo_data/BLOD.json:/data/BLOD.json:ro
    - ./backend/data/fairness-data.csv:/data/fairness-data.csv:ro

# CHANGE TO your paths
kg-pipeline:
  environment:
    - JSON_PATH=/data/datasets.json          ← your JSON filename
    - FAIR_PATH=/data/quality-scores.csv     ← your CSV filename (or remove line)
  volumes:
    - ./data/datasets.json:/data/datasets.json:ro
    - ./data/quality-scores.csv:/data/quality-scores.csv:ro
```

---

## Step 7 — Change the Fuseki dataset name (optional)

If you want a different Fuseki dataset name instead of `blod`:

```yaml
# docker-compose.yml
fuseki:
  environment:
    - FUSEKI_DATASET_1=myproject        ← dataset name in Fuseki

kg-pipeline:
  environment:
    - FUSEKI_DATASET=myproject          ← must match above

backend:
  environment:
    - FUSEKI_DATASET=myproject          ← must match above
```

Then update `kg.js` (the backend proxy):
```js
// Line 8
const FUSEKI_DATASET = process.env.FUSEKI_DATASET || 'myproject';
```

---

## Complete example — adapting for a new project

Say you have a project called **MOLD** (Medical Ontology Linked Datasets) at `http://mold.example.org`:

### 1. `kg_pipeline.py` — configuration section only

```python
BASE_URI        = "http://mold.example.org"
ONTOLOGY_URI    = f"{BASE_URI}/ontology#"
RESOURCE_URI    = f"{BASE_URI}/resource/"
FAIR_URI        = f"{BASE_URI}/fair#"

FIELD_MAP = {
    "id":          ("DCTERMS", "identifier",  "literal"),
    "name":        ("DCTERMS", "title",        "lang_literal"),
    "homepage":    ("SCHEMA",  "url",          "uri"),
    "license_url": ("DCTERMS", "license",      "uri"),
    "triple_count":("VOID",    "triples",      "integer"),
    "wikidata":    ("OWL",     "sameAs",       "uri"),
}

FAIR_SCORE_COLUMNS = {
    "Ontology ID":    "__id__",
    "FAIR score":     "fair_score",
    "F score":        "f_score",
    "A score":        "a_score",
    "I score":        "i_score",
    "R score":        "r_score",
}

HEALTH_CATEGORIES = [
    "Clinical Terminology",
    "Molecular Biology",
    "Phenotype & Disease",
    "Drug & Chemical",
    "Anatomy",
]
```

### 2. In `build_graph()` — change the identifier field

```python
identifier = (record.get("id") or "").strip()    # was "identifier"
```

### 3. In `build_graph()` — change the keywords field

```python
for kw in (record.get("domains") or []):          # was "keywords"
```

### 4. `docker-compose.yml`

```yaml
kg-pipeline:
  environment:
    - FUSEKI_DATASET=mold
    - JSON_PATH=/data/ontologies.json
    - FAIR_PATH=/data/fair-scores.csv
  volumes:
    - ./data/ontologies.json:/data/ontologies.json:ro
    - ./data/fair-scores.csv:/data/fair-scores.csv:ro

fuseki:
  environment:
    - FUSEKI_DATASET_1=mold
```

### 5. Run

```bash
docker-compose up --build -d
```

The KG pipeline runs automatically, loads your data into Fuseki, and the SPARQL endpoint is ready at `http://localhost:3030/mold/sparql`.

---

## Quick reference — minimum changes checklist

```
[ ] BASE_URI                    → set to your project's namespace
[ ] FIELD_MAP                   → match your JSON field names
[ ] identifier field in build_graph() → match your unique ID field name  
[ ] FAIR_SCORE_COLUMNS          → match your CSV columns (or set to {})
[ ] HEALTH_CATEGORIES           → your categories (or set to [])
[ ] keywords field in build_graph() → match your array field (or remove)
[ ] docker-compose volumes      → point to your JSON and CSV files
[ ] FUSEKI_DATASET              → your dataset name (optional)
```

That's all that needs to change. Everything else — the RDF serialization,
Fuseki loading, healthchecks, retry logic, and output files — works automatically.
