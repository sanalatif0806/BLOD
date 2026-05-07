# BLOD Update Guide

---

## 🔴 NEW FILES — Must Add (don't exist in old version)

| File Path | Description |
|---|---|
| `WebApp/backend/src/routes/sparql.js` | The entire SPARQL endpoint (Node.js) |
| `WebApp/backend/src/sync_fairness_scores.js` | Utility to sync FAIR scores to MongoDB |
| `WebApp/frontend/blod/src/pages/sparql.js` | The SPARQL UI page (React) |
| `WebApp/frontend/blod/src/pages/datasets.js` | New datasets browsing page (React) |
| `python_service/sparql_query.py` | SPARQL engine for python service |
| `start.sh` | Startup script |

---

## 🟡 MODIFIED FILES — Copy new version over old

### Backend

#### `WebApp/backend/src/server.js`
Registers the new `/sparql` route and adds URL-encoded body parser.

Add these lines:
```js
const sparqlRoutes = require('./routes/sparql');
app.use(express.urlencoded({ extended: true }));  // add after express.json()
app.use('/sparql', sparqlRoutes);                 // add with other routes
```

Also adds a health check endpoint:
```js
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
```

---

#### `WebApp/backend/src/routes/BLOD.js`
Adds two new endpoints:
- `GET /BLOD/datasets` — browse all datasets with pagination and category filter
- `POST /BLOD/sync-fairness` — syncs FAIR scores from CSV into MongoDB

Replace the entire file with the new version.

---

#### `WebApp/backend/src/package.json`
Dependency changes:

New version has:
```json
"@anthropic-ai/sdk": "^0.52.0",
"@google/generative-ai": "^0.21.0",
"json2csv": "^6.0.0-alpha.2",
"openai": "^4.0.0"
```

Old version had langchain packages instead:
```json
"@langchain/core": "^0.3.62",
"@langchain/google-genai": "^0.2.14",
"@langchain/openai": "^0.5.18"
```

Replace the file and run `npm install` inside the container.

---

#### `WebApp/backend/Dockerfile`
- Changed base image from `node:22` → `node:22-slim` (smaller image)
- Changed `npm install` → `npm install --production`

---

### Frontend

#### `WebApp/frontend/blod/src/App.js`
Adds imports and routes for the two new pages:
```js
import Sparql from './pages/sparql';
import Datasets from './pages/datasets';

// Add inside <Routes>:
<Route path='/sparql' element={<Sparql />} />
<Route path='/datasets' element={<Datasets />} />
```

---

#### `WebApp/frontend/blod/src/components/navbar.js`
Adds the **SPARQL** link to the navigation menu:
```js
// Add this line inside <Nav>:
<Nav.Link as={Link} to="/sparql">SPARQL</Nav.Link>
```

---

#### `WebApp/frontend/blod/src/pages/fairness_info.js`
- Adds `import Navbar from '../components/navbar'` at the top
- Improved LLM error handling (shows error message instead of crashing)
- Adds "Request Metadata Modification" button

Replace the entire file with the new version.

---

#### `WebApp/frontend/blod/src/pages/add_dataset.js`
Minor UI changes — navigation links updated.
Replace the entire file with the new version.

---

#### `WebApp/frontend/blod/src/pages/cloud.js`
Line ending changes only (CRLF → LF), logic is the same.
Replace the entire file with the new version to keep consistent line endings.

---

#### `WebApp/frontend/blod/src/api.js`
No functional change — just line ending cleanup.
Replace the entire file with the new version.

---

#### `WebApp/frontend/blod/Dockerfile`
Changed to a multi-stage build using `node:22-slim`:
```dockerfile
FROM node:22-slim AS builder
# Accepts build-time env vars:
ARG REACT_APP_API_URL=http://localhost:5005
ARG REACT_APP_DASHBOARD_BACKEND=http://localhost:5001
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_DASHBOARD_BACKEND=$REACT_APP_DASHBOARD_BACKEND
```

Replace the entire file with the new version.

---

### Docker Compose

#### `WebApp/docker-compose.yml`
Key fixes — internal Docker service URLs were broken in the old version:

```yaml
# OLD (broken inside Docker network):
- REACT_APP_API_URL=http://localhost:5005
- REACT_APP_DASHBOARD_BACKEND=http://localhost:5001

# NEW (correct Docker service names):
- REACT_APP_API_URL=http://backend:5005
- REACT_APP_DASHBOARD_BACKEND=http://python-service:5001
```

Other changes:
- MongoDB image downgraded from `mongo:6.0` → `mongo:4.4.6`
- Removed MongoDB healthcheck (simpler `depends_on`)
- Backend now loads `env_file: ./backend/.env`
- Python service now loads `env_file: ../python_service/.env`

> ⚠️ **Important for isislab deployment:** Change the URLs to your live domain:
> ```yaml
> - REACT_APP_API_URL=http://isislab.it:12280/blod
> - REACT_APP_DASHBOARD_BACKEND=http://isislab.it:12280/blod
> ```

---

### Python Service

#### `python_service/app.py`
Registers the SPARQL blueprint and adds a `/health` endpoint:
```python
from sparql_query import make_sparql_blueprint

# Add after creating weather_station_data:
sparql_bp = make_sparql_blueprint(weather_station_data)
app.register_blueprint(sparql_bp)

@app.route("/health")
def health():
    df = getattr(weather_station_data, 'checloud_df', None)
    return jsonify({
        "status": "ok",
        "data_loaded": df is not None and hasattr(df, 'analysis_data'),
    })
```

---

## 🚀 Deployment Order

```bash
# Step 1 — Copy all modified/new files to the server

# Step 2 — Install new backend npm dependencies
docker exec BLOD-backend npm install --prefix /app/src

# Step 3 — Rebuild frontend (has new pages — must rebuild, not just restart)
docker-compose up --build frontend -d

# Step 4 — Restart backend to pick up new routes
docker restart BLOD-backend

# Step 5 — Restart python service (new sparql_query.py)
docker restart BLOD-python-service
```

---

## ✅ Quick Verification After Deploy

```bash
# Backend health
curl http://localhost:5005/health

# SPARQL endpoint working
curl "http://localhost:5005/sparql/info"

# FAIR score lookup working
curl "http://localhost:5005/sparql/debug-fair?id=bio2rdf-chembl"
```

Expected responses:
- `/health` → `{"status":"ok",...}`
- `/sparql/info` → JSON with predicates and example queries
- `/debug-fair` → `{"scores":{"fair_score":3.32,...},"source":"csv"}`

---

## 📝 Notes

- The `sparql.js` backend route has the FAIR score fix applied (CSV fallback + correct path)
- The `sparql.js` frontend page has the column header fix applied (no `?` prefix, camelCase formatted)
- Do NOT replace `WebApp/backend/data/fairness-data.csv` — it is the same in both versions
- Do NOT replace `WebApp/backend/mongo_data/BLOD.json` — it is the same in both versions
