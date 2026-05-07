# BLOD Cloud — Biomedical Linked Open Datasets

A web platform for exploring, searching, and assessing FAIR quality of biomedical linked open datasets.

## Architecture

```
BLOD/
├── WebApp/
│   ├── docker-compose.yml        ← orchestrates all services
│   ├── backend/                  ← Node.js / Express API (port 5005)
│   │   ├── Dockerfile
│   │   ├── .env                  ← copy and fill in secrets
│   │   ├── BLOD.json             ← MongoDB seed data
│   │   ├── init-mongo.sh         ← runs on first Mongo startup
│   │   └── src/
│   │       ├── server.js
│   │       ├── db.js
│   │       ├── models/BLOD.js
│   │       └── routes/
│   │           ├── BLOD.js           ← /BLOD/* catalogue endpoints
│   │           ├── sparql.js         ← /sparql SPARQL endpoint (MongoDB)
│   │           ├── llm.js            ← /llm AI classification
│   │           ├── monitoring_requests.js ← /monitoring_requests
│   │           └── temp.js
│   └── frontend/blod/            ← React app (port 3000)
│       ├── Dockerfile
│       ├── .env
│       └── src/
│           ├── pages/
│           │   ├── cloud.js          ← knowledge graph visualisation
│           │   ├── search.js         ← full-text search
│           │   ├── sparql.js         ← SPARQL query explorer ← NEW
│           │   ├── dashboard.js      ← FAIR stats dashboard
│           │   ├── fairness_info.js  ← per-dataset FAIR detail
│           │   ├── add_dataset.js    ← submit new dataset
│           │   └── about.js
│           └── components/
└── python_service/               ← Flask quality service (port 5001)
    ├── Dockerfile
    ├── .env
    ├── app.py                    ← Flask routes + SPARQL blueprint
    ├── sparql_query.py           ← SPARQL engine over quality DataFrame ← NEW
    ├── generate_weather_station_data.py
    ├── punctual_quality_evaluation.py
    └── recover_last_analysis.py
```

## Quick Start

### 1. Configure environment

```bash
# Backend secrets
cp WebApp/backend/.env WebApp/backend/.env.local
# Fill in: GIT_TOKEN, GEMINI_API_KEY / OPENAI_API_KEY, REPO_URL

# Python service (already set for Docker networking)
# python_service/.env is pre-configured
```

### 2. Run with Docker Compose

```bash
cd WebApp
docker compose up --build
```



### 3. Development (without Docker)

**Backend:**
```bash
cd WebApp/backend/src
npm install
cp ../.env .env
node server.js
```

**Frontend:**
```bash
cd WebApp/frontend/blod
npm install
npm start
```

**Python service:**
```bash
cd python_service
pip install -r requirements.txt
cp env-example .env
flask run --port 5001
```

## SPARQL Endpoints

**Example:**
```sparql
SELECT ?title ?identifier WHERE {
  ?s dct:title ?title .
  ?s dct:identifier ?identifier .
  FILTER(REGEX(?title, "drug", "i"))
}
LIMIT 20
```

**Example:**
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

Both return **W3C SPARQL JSON Results Format**.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /BLOD/all_ch_links | Knowledge graph nodes & links |
| GET | /BLOD/get_all | All datasets (full JSON) |
| GET | /BLOD/search?q=term | Full-text search |
| GET | /BLOD/dataset_metadata/:id | Single dataset metadata |
| GET | /BLOD/fairness_data/:id | FAIR scores from KGHeartBeat |
| GET | /sparql?query=... | SPARQL over catalogue (MongoDB) |
| GET | /sparql/info | SPARQL endpoint documentation |
| POST | /llm/llm_topic | LLM health category classification |
| POST | /llm/llm_explain_fair | LLM FAIR score explanation |
| POST | /monitoring_requests/submit | Submit new dataset PR |
| GET | /health | Backend health check |

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /sparql_endpoint | SPARQL endpoint availability stats |
| GET | /rdf_dump | RDF dump availability stats |
| GET | /fair_stats | FAIR score box-plot statistics |
| GET | /datasets_stats | Dataset category counts |
| GET | /all_single_fair_score | Per-dataset FAIR scores |
| GET | /sparql/query?query=... | SPARQL over quality DataFrame |
| GET | /sparql/info | SPARQL predicate reference |
| GET | /sparql/columns | Available DataFrame columns |
| GET | /health | Python service health check |
