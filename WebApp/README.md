# BLOD — Biomedical Linked Open Datasets

> A web platform for exploring, querying, and assessing FAIR quality of biomedical linked open datasets — backed by MongoDB, a native RDF Knowledge Graph, and a SPARQL triplestore.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Services](#services)
- [SPARQL Endpoints](#sparql-endpoints)
- [Knowledge Graph](#knowledge-graph)
- [KG Pipeline](#kg-pipeline)
- [API Reference](#api-reference)
- [Deployment — isislab](#deployment--isislab)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Authors](#authors)

---

## Overview

BLOD catalogues **1,386 biomedical linked open datasets** across 7 health domains and provides:

- 🔍 **Full-text search** across dataset titles, descriptions, and keywords
- 📊 **FAIR score dashboard** — Findability, Accessibility, Interoperability, Reusability
- 🔷 **RDF Knowledge Graph** — 83,000+ triples, queryable via real native SPARQL
- 🗄 **MongoDB-backed SPARQL** — simplified query syntax for catalogue exploration
- 🤖 **LLM integration** — AI-powered FAIR score explanation and topic classification
- 🌐 **Knowledge graph visualisation** — D3.js force-directed graph of dataset interlinking

### Health Domains

| Domain | Description |
|---|---|
| 🏥 Clinical & Patient Data | EHR, clinical trials, patient registries |
| 🧬 Omics & Molecular Data | Genomics, proteomics, metabolomics |
| 🩻 Medical Imaging & Signals | DICOM, radiology, biosignals |
| 🌍 Public Health & Surveillance | Epidemiology, disease surveillance |
| 🧪 Biobank & Research Data | Biobanks, research cohorts |
| 🧠 Behavioral & Social Data | Mental health, social determinants |
| 📚 Terminologies & Metadata | Ontologies, vocabularies, standards |

---

## Architecture

```
BLOD/
├── WebApp/
│   ├── docker-compose.yml         ← orchestrates all 6 services
│   ├── backend/                   ← Node.js / Express API  (port 5005)
│   ├── frontend/blod/             ← React app              (port 3000)
│   └── kg-pipeline/               ← Python RDF converter   (runs once)
├── python_service/                ← Flask quality service  (port 5001)
└── README.md
```

### Service dependency order

```
MongoDB ──healthy──► Backend ──────────────► Frontend
                                              
Fuseki ──healthy──►  KG Pipeline (exits ✓)
       └──healthy──► Backend
```

---

## Quick Start

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- Git

### 1. Clone and configure

```bash
git clone https://github.com/sanalatif0806/BLOD.git
cd BLOD/WebApp
```

Edit `backend/.env` and fill in your API keys (see [Environment Variables](#environment-variables)).

### 2. Run everything

```bash
docker-compose up --build -d
```

This single command:
1. Starts **MongoDB** and seeds it with 1,386 datasets
2. Starts **Fuseki** triplestore
3. Runs the **KG Pipeline** — converts data to RDF and loads 83,000+ triples into Fuseki automatically
4. Starts the **Backend** API
5. Starts the **Frontend**
6. Starts the **Python quality service**

### 3. Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5005 |
| Fuseki UI | http://localhost:3030 |
| Python Service | http://localhost:5001 |

> **First run takes 3–5 minutes** — the KG pipeline converts and loads 83,000 RDF triples into Fuseki. Subsequent starts skip this step automatically.

---

## Services

### Frontend (React — port 3000)

| Page | URL | Description |
|---|---|---|
| Home / Graph | `/` | D3.js force-directed dataset graph |
| Search | `/search` | Full-text search across all datasets |
| Datasets | `/datasets` | Browse by health category |
| SPARQL | `/sparql` | Query editor (MongoDB + KG modes) |
| Dashboard | `/dashboard` | FAIR score statistics |
| Dataset detail | `/fairness-info?dataset_id=...` | Per-dataset FAIR assessment |
| Add dataset | `/add-dataset` | Submit a new dataset via GitHub PR |
| About | `/about` | Project information |

### Backend (Node.js / Express — port 5005)

Handles all API calls, proxies to Fuseki for KG queries, fetches FAIR scores from KGHeartBeat with CSV fallback.

### Fuseki Triplestore (port 3030)

Apache Jena Fuseki — real native SPARQL 1.1 endpoint over the BLOD RDF Knowledge Graph.

- Web UI: http://localhost:3030
- Credentials: `admin` / `blod_admin`
- Dataset: `blod`

### KG Pipeline (runs once, then exits)

Automatically converts `BLOD.json` + `fairness-data.csv` into 83,000+ RDF triples and loads them into Fuseki. Skips if already loaded.

To force a reload:
```bash
# Set FORCE_RELOAD=true in docker-compose.yml, then:
docker-compose up kg-pipeline
```

---

## SPARQL Endpoints

### Mode 1 — MongoDB SPARQL (simplified syntax)

Translates a simplified SPARQL-like syntax into MongoDB queries. No PREFIX declarations needed.

```
GET  http://localhost:5005/sparql?query=SELECT ...
POST http://localhost:5005/sparql   body: { "query": "SELECT ..." }
GET  http://localhost:5005/sparql/info
```

**Available predicates:**

| Predicate | Description |
|---|---|
| `dct:title` | Dataset name |
| `dct:identifier` | Unique dataset ID |
| `dct:description` | English description |
| `dct:license` | License URI |
| `dcat:category` | Health domain (use one of the 7 categories) |
| `void:triples` | Number of RDF triples |
| `schema:url` | Dataset website |
| `blod:fairScore` | Overall FAIR score (0–4) |
| `blod:fScore` | Findability sub-score |
| `blod:aScore` | Accessibility sub-score |
| `blod:iScore` | Interoperability sub-score |
| `blod:rScore` | Reusability sub-score |

**Example queries:**

```sparql
-- Top datasets by FAIR score
SELECT ?title ?identifier ?fairScore WHERE {
  ?s dct:title ?title .
  ?s dct:identifier ?identifier .
  ?s blod:fairScore ?fairScore .
}
ORDER BY DESC(?fairScore)
LIMIT 10

-- Filter by health category
SELECT ?title ?identifier WHERE {
  ?s dct:title ?title .
  ?s dct:identifier ?identifier .
  ?s dcat:category "Omics & Molecular Data"
}
LIMIT 25

-- Search by title
SELECT ?title ?website WHERE {
  ?s dct:title ?title .
  ?s schema:url ?website .
  FILTER(REGEX(?title, "drug", "i"))
}
LIMIT 20
```

---

### Mode 2 — Knowledge Graph SPARQL (native RDF)

Real SPARQL 1.1 over the RDF triplestore. All standard prefixes are injected automatically.

```
GET  http://localhost:5005/kg/sparql?query=SELECT ...
POST http://localhost:5005/kg/sparql   body: { "query": "SELECT ..." }
GET  http://localhost:5005/kg/status
GET  http://localhost:5005/kg/info
```

Or query Fuseki directly:
```
GET  http://localhost:3030/blod/sparql?query=...
```

**Auto-injected prefixes:**

```sparql
PREFIX blod:   <http://blod.isislab.it/ontology#>
PREFIX blodr:  <http://blod.isislab.it/resource/>
PREFIX fair:   <http://blod.isislab.it/fair#>
PREFIX dct:    <http://purl.org/dc/terms/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX void:   <http://rdfs.org/ns/void#>
PREFIX schema: <https://schema.org/>
PREFIX owl:    <http://www.w3.org/2002/07/owl#>
PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
```

**Example queries:**

```sparql
-- Top FAIR scores with all sub-scores
SELECT ?title ?fairScore ?fScore ?aScore ?iScore ?rScore WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s blod:fairScore ?fairScore .
  ?s blod:fScore ?fScore .
  ?s blod:aScore ?aScore .
  ?s blod:iScore ?iScore .
  ?s blod:rScore ?rScore .
}
ORDER BY DESC(?fairScore)
LIMIT 10

-- Datasets in Omics category
SELECT ?title ?identifier WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s dct:identifier ?identifier .
  ?s blod:healthCategory <http://blod.isislab.it/resource/category/Omics___Molecular_Data> .
}
LIMIT 25

-- Dataset interlinking (who links to whom)
SELECT ?title ?targetTitle ?links WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?linkset void:target ?s .
  ?linkset void:target ?target .
  ?linkset void:triples ?links .
  ?target dct:title ?targetTitle .
  FILTER(?s != ?target)
}
ORDER BY DESC(?links)
LIMIT 20

-- Datasets with Wikidata links
SELECT ?title ?wikidataUri WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s owl:sameAs ?wikidataUri .
  FILTER(STRSTARTS(STR(?wikidataUri), "http://www.wikidata.org"))
}
LIMIT 20
```

---

### Mode 3 — Python Quality SPARQL

```
GET  http://localhost:5001/sparql/query?query=SELECT ...
GET  http://localhost:5001/sparql/info
GET  http://localhost:5001/sparql/columns
```

```sparql
SELECT ?kg_id ?kg_name ?fair_score WHERE {
  ?s blod:kg_id ?kg_id .
  ?s blod:kg_name ?kg_name .
  ?s blod:fair_score ?fair_score .
  FILTER(?fair_score > 3)
}
ORDER BY DESC(?fair_score)
LIMIT 20
```

---

## Knowledge Graph

The BLOD Knowledge Graph contains **83,000+ RDF triples** representing 1,386 biomedical datasets with full FAIR assessments.

### Ontology

| Class | URI | Description |
|---|---|---|
| `blod:Dataset` | `http://blod.isislab.it/ontology#Dataset` | A biomedical linked dataset |
| `blod:FAIRAssessment` | `http://blod.isislab.it/ontology#FAIRAssessment` | FAIR quality assessment |
| `blod:HealthCategory` | `http://blod.isislab.it/ontology#HealthCategory` | Health domain category |

### Health Category URIs

| Category | URI |
|---|---|
| Clinical & Patient Data | `http://blod.isislab.it/resource/category/Clinical___Patient_Data` |
| Omics & Molecular Data | `http://blod.isislab.it/resource/category/Omics___Molecular_Data` |
| Medical Imaging & Signals | `http://blod.isislab.it/resource/category/Medical_Imaging___Signals` |
| Public Health & Surveillance | `http://blod.isislab.it/resource/category/Public_Health___Surveillance` |
| Biobank & Research Data | `http://blod.isislab.it/resource/category/Biobank___Research_Data` |
| Behavioral & Social Data | `http://blod.isislab.it/resource/category/Behavioral___Social_Data` |
| Terminologies & Metadata | `http://blod.isislab.it/resource/category/Terminologies___Metadata` |

### KG Statistics

| Metric | Value |
|---|---|
| Total triples | 83,003 |
| Datasets | 1,386 |
| FAIR-enriched datasets | 1,366 |
| Inter-dataset links | 3,561 |
| Wikidata links | 1,367 |
| Formats | Turtle (.ttl), N-Triples (.nt) |

---

## KG Pipeline

The `kg-pipeline` service automates the full conversion. It runs automatically on `docker-compose up` and exits when done.

### Manual usage

```bash
# Install dependencies (once)
pip install rdflib pandas requests

# Full pipeline — convert + load into Fuseki
python kg_pipeline.py \
  --json WebApp/backend/mongo_data/BLOD.json \
  --fair WebApp/backend/data/fairness-data.csv

# Convert only, don't load to Fuseki
python kg_pipeline.py --json BLOD.json --fair fairness-data.csv --no-load

# Force reload (Fuseki already has data)
python kg_pipeline.py --json BLOD.json --fair fairness-data.csv --force

# Load existing .nt file to Fuseki
python kg_pipeline.py --load-only blod_knowledge_graph.nt

# Custom Fuseki settings
python kg_pipeline.py \
  --json BLOD.json \
  --fair fairness-data.csv \
  --fuseki-url http://isislab.it:3030 \
  --fuseki-password yourpassword
```

### Pipeline output

| File | Format | Description |
|---|---|---|
| `blod_knowledge_graph.ttl` | Turtle | Human-readable, version control |
| `blod_knowledge_graph.nt` | N-Triples | Triplestore import format |

---

## API Reference

### Backend (port 5005)

#### Catalogue

| Method | Endpoint | Description |
|---|---|---|
| GET | `/BLOD/all_ch_links` | Graph nodes & links for visualisation |
| GET | `/BLOD/get_all` | All datasets (full JSON) |
| GET | `/BLOD/search?q=term&fields=title,description` | Full-text search |
| GET | `/BLOD/dataset_metadata/:id` | Single dataset metadata |
| GET | `/BLOD/fairness_data/:id` | FAIR scores (KGHeartBeat API + CSV fallback) |
| GET | `/BLOD/datasets?category=...&page=1&limit=20` | Paginated dataset browser |
| POST | `/BLOD/sync-fairness` | Sync FAIR scores from CSV into MongoDB |
| GET | `/health` | Health check |

#### SPARQL

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sparql?query=...` | MongoDB-backed SPARQL |
| POST | `/sparql` | MongoDB-backed SPARQL (body: `{ query }`) |
| GET | `/sparql/info` | Predicate reference |
| GET | `/sparql/debug-fair?id=...` | Debug FAIR score lookup |
| GET | `/kg/sparql?query=...` | Knowledge Graph SPARQL (Fuseki proxy) |
| POST | `/kg/sparql` | Knowledge Graph SPARQL (body: `{ query }`) |
| GET | `/kg/status` | Fuseki status + triple count |
| GET | `/kg/info` | KG prefixes and example queries |

#### LLM

| Method | Endpoint | Description |
|---|---|---|
| POST | `/llm/llm_topic` | Classify dataset health category |
| POST | `/llm/llm_explain_fair` | Explain FAIR score in natural language |
| POST | `/llm/llm_explain_fair_over_time` | FAIR score trend explanation |

### Python Service (port 5001)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/sparql_endpoint` | SPARQL endpoint availability stats |
| GET | `/rdf_dump` | RDF dump availability stats |
| GET | `/fair_stats` | FAIR score box-plot statistics |
| GET | `/datasets_stats` | Dataset category counts |
| GET | `/all_single_fair_score` | Per-dataset FAIR scores |
| GET | `/sparql/query?query=...` | SPARQL over quality DataFrame |
| GET | `/sparql/info` | SPARQL predicate reference |
| GET | `/sparql/columns` | Available columns |
| GET | `/health` | Health check |

---

## Deployment — isislab

To deploy at `http://isislab.it:12280/blod`:

### 1. Update URLs before pushing

**`WebApp/frontend/blod/.env`:**
```
REACT_APP_API_URL=http://isislab.it:5005
REACT_APP_DASHBOARD_BACKEND=http://isislab.it:5001
```

**`WebApp/backend/.env`** — add:
```
FRONTEND_URL=http://isislab.it:12280/blod
```

**`WebApp/frontend/blod/src/App.js`:**
```js
<Router basename='/blod'>   {/* change from '/' */}
```

**`WebApp/docker-compose.yml`** — update frontend build args:
```yaml
frontend:
  build:
    context: ./frontend/blod
    args:
      - REACT_APP_API_URL=http://isislab.it:5005
      - REACT_APP_DASHBOARD_BACKEND=http://isislab.it:5001
```

### 2. Deploy on the server

```bash
git pull origin master_updated
cd BLOD/WebApp
docker-compose up --build -d
```

### 3. Verify

```bash
curl http://isislab.it:5005/health
curl http://isislab.it:5005/kg/status
```

---

## Environment Variables

### Backend (`WebApp/backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `MONGO_URI` | MongoDB connection string | `mongodb://admin:password@mongodb:27017/healthcloud?authSource=admin` |
| `DB_NAME` | MongoDB database name | `healthcloud` |
| `PORT` | Backend port | `5005` |
| `FRONTEND_URL` | Frontend base URL | `http://localhost:3000` |
| `FUSEKI_URL` | Fuseki triplestore URL | `http://fuseki:3030` |
| `FUSEKI_DATASET` | Fuseki dataset name | `blod` |
| `FUSEKI_USER` | Fuseki admin username | `admin` |
| `FUSEKI_PASS` | Fuseki admin password | `blod_admin` |
| `LLM_PROVIDER` | LLM provider | `gemini` \| `openai` \| `claude` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |
| `LLM_MODEL` | Model name | `gemini-2.0-flash` |
| `GIT_TOKEN` | GitHub token for dataset PRs | `ghp_...` |
| `REPO_URL` | GitHub repository URL | `https://github.com/your-username/BLOD.git` |
| `KGHEARTBEAT_API` | KGHeartBeat API base URL | `https://kgheartbeat.di.unisa.it/kgheartbeat-api` |

### Frontend (`WebApp/frontend/blod/.env`)

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_URL` | Backend base URL | `http://localhost:5005` |
| `REACT_APP_DASHBOARD_BACKEND` | Python service URL | `http://localhost:5001` |

### KG Pipeline (docker-compose environment)

| Variable | Description | Default |
|---|---|---|
| `FUSEKI_URL` | Fuseki URL (internal Docker) | `http://fuseki:3030` |
| `FUSEKI_DATASET` | Dataset name | `blod` |
| `FUSEKI_PASSWORD` | Fuseki password | `blod_admin` |
| `JSON_PATH` | Path to BLOD.json inside container | `/data/BLOD.json` |
| `FAIR_PATH` | Path to fairness-data.csv | `/data/fairness-data.csv` |
| `FORCE_RELOAD` | Re-run even if KG already loaded | `false` |

---

## Project Structure

```
BLOD/
├── README.md
├── WebApp/
│   ├── docker-compose.yml
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── .env                          ← fill in secrets
│   │   ├── BLOD.json                     ← MongoDB seed (symlink)
│   │   ├── init-mongo.sh                 ← MongoDB init script
│   │   ├── data/
│   │   │   ├── fairness-data.csv         ← FAIR scores (1,391 datasets)
│   │   │   └── llms_prompts.json         ← LLM prompt templates
│   │   ├── mongo_data/
│   │   │   └── BLOD.json                 ← Full dataset catalogue (1,386 entries)
│   │   └── src/
│   │       ├── server.js                 ← Express app entry point
│   │       ├── db.js                     ← MongoDB connection
│   │       ├── models/BLOD.js            ← Mongoose model
│   │       ├── sync_fairness_scores.js   ← FAIR score sync utility
│   │       └── routes/
│   │           ├── BLOD.js               ← /BLOD/* catalogue endpoints
│   │           ├── sparql.js             ← /sparql MongoDB SPARQL
│   │           ├── kg.js                 ← /kg Fuseki KG SPARQL proxy
│   │           ├── llm.js                ← /llm AI endpoints
│   │           └── monitoring_requests.js
│   ├── frontend/blod/
│   │   ├── Dockerfile
│   │   ├── .env                          ← API URLs
│   │   └── src/
│   │       ├── App.js                    ← Routes
│   │       ├── api.js                    ← Base URLs
│   │       ├── pages/
│   │       │   ├── sparql.js             ← SPARQL explorer (MongoDB + KG modes)
│   │       │   ├── cloud.js              ← Graph visualisation
│   │       │   ├── search.js             ← Full-text search
│   │       │   ├── datasets.js           ← Dataset browser
│   │       │   ├── dashboard.js          ← FAIR stats
│   │       │   ├── fairness_info.js      ← Per-dataset FAIR detail
│   │       │   ├── add_dataset.js        ← Submit dataset
│   │       │   └── about.js
│   │       └── components/
│   │           ├── navbar.js
│   │           ├── Graph.js              ← D3.js force graph
│   │           ├── gauge_chart.js
│   │           ├── radar_chart.js
│   │           └── ...
│   └── kg-pipeline/
│       ├── Dockerfile                    ← Python 3.11 slim
│       ├── kg_pipeline.py                ← Reusable RDF converter
│       └── kg_entrypoint.sh              ← Auto-run entrypoint
└── python_service/
    ├── Dockerfile
    ├── .env
    ├── app.py                            ← Flask routes
    ├── sparql_query.py                   ← DataFrame SPARQL engine
    ├── generate_weather_station_data.py
    ├── punctual_quality_evaluation.py
    └── recover_last_analysis.py
```

---

## Authors

**Maria Angela Pellegrino** and **Sana Latif**
© 2026 BLOD Cloud. All rights reserved.

---

## License

This project is for academic research purposes.
Dataset metadata sourced from the LOD Cloud, KGHeartBeat, BioPortal, and other public catalogues.
