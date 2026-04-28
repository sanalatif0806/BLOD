#!/bin/bash
# ============================================================
# kg_entrypoint.sh
# ============================================================

set -e

FUSEKI_URL="${FUSEKI_URL:-http://fuseki:3030}"
FUSEKI_DATASET="${FUSEKI_DATASET:-blod}"
FUSEKI_PASSWORD="${FUSEKI_PASSWORD:-blod_admin}"
FUSEKI_USER="${FUSEKI_USER:-admin}"
JSON_PATH="${JSON_PATH:-/data/BLOD.json}"
FAIR_PATH="${FAIR_PATH:-/data/fairness-data.csv}"
FORCE_RELOAD="${FORCE_RELOAD:-false}"
OUT_DIR="/output"

echo ""
echo "============================================================"
echo "  BLOD Knowledge Graph Pipeline — Auto Mode"
echo "============================================================"
echo "  Fuseki URL  : $FUSEKI_URL"
echo "  Dataset     : $FUSEKI_DATASET"
echo "  JSON source : $JSON_PATH"
echo "  FAIR source : $FAIR_PATH"
echo "  Force reload: $FORCE_RELOAD"
echo "============================================================"
echo ""

# ── Check data files exist ───────────────────────────────────
if [ ! -f "$JSON_PATH" ]; then
    echo "❌ ERROR: JSON file not found at $JSON_PATH"
    exit 1
fi
echo "✅ JSON file found: $JSON_PATH"

if [ ! -f "$FAIR_PATH" ]; then
    echo "⚠️  FAIR CSV not found — skipping FAIR enrichment"
    FAIR_ARG=""
else
    echo "✅ FAIR CSV found: $FAIR_PATH"
    FAIR_ARG="--fair $FAIR_PATH"
fi

# ── Debug: show network info ─────────────────────────────────
echo ""
echo "🔍 Network debug:"
echo "   Hostname: $(hostname)"
echo "   /etc/hosts fuseki entry: $(grep fuseki /etc/hosts || echo 'not found')"
echo "   Trying to resolve fuseki..."
python3 -c "import socket; print('   fuseki IP:', socket.gethostbyname('fuseki'))" 2>/dev/null || echo "   Could not resolve fuseki"

# ── Wait for Fuseki using Python (avoids curl dependency) ───
echo ""
echo "⏳ Waiting for Fuseki..."

python3 << PYEOF
import urllib.request, urllib.error, base64, time, sys

url      = "${FUSEKI_URL}/\$/ping"
user     = "${FUSEKI_USER}"
password = "${FUSEKI_PASSWORD}"
creds    = base64.b64encode(f"{user}:{password}".encode()).decode()
headers  = {"Authorization": f"Basic {creds}"}

max_wait = 120
waited   = 0
interval = 5

while waited < max_wait:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as r:
            if r.status == 200:
                print(f"✅ Fuseki is ready! (after {waited}s)")
                sys.exit(0)
    except urllib.error.URLError as e:
        print(f"   ... still waiting ({waited}/{max_wait}s) — {e.reason}")
    except Exception as e:
        print(f"   ... still waiting ({waited}/{max_wait}s) — {e}")
    time.sleep(interval)
    waited += interval

print(f"❌ Fuseki did not respond within {max_wait}s")
sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
    exit 1
fi

# ── Check existing triple count ──────────────────────────────
TRIPLE_COUNT=$(python3 << PYEOF
import urllib.request, urllib.error, base64, json, sys

url      = "${FUSEKI_URL}/${FUSEKI_DATASET}/sparql"
query    = "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }"
user     = "${FUSEKI_USER}"
password = "${FUSEKI_PASSWORD}"
creds    = base64.b64encode(f"{user}:{password}".encode()).decode()

import urllib.parse
full_url = f"{url}?query={urllib.parse.quote(query)}"
req = urllib.request.Request(full_url, headers={
    "Authorization": f"Basic {creds}",
    "Accept": "application/sparql-results+json"
})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.load(r)
        print(d["results"]["bindings"][0]["count"]["value"])
except:
    print("0")
PYEOF
)

echo ""
echo "ℹ️  Current triple count in Fuseki: $TRIPLE_COUNT"

if [ "$TRIPLE_COUNT" -gt "1000" ] && [ "$FORCE_RELOAD" != "true" ]; then
    echo "✅ Knowledge Graph already loaded ($TRIPLE_COUNT triples). Skipping."
    echo "   Set FORCE_RELOAD=true to reload."
    echo ""
    echo "============================================================"
    echo "  Pipeline skipped — KG already loaded"
    echo "  SPARQL endpoint: $FUSEKI_URL/$FUSEKI_DATASET/sparql"
    echo "============================================================"
    exit 0
fi

FORCE_FLAG=""
if [ "$FORCE_RELOAD" = "true" ]; then
    FORCE_FLAG="--force"
fi

# ── Run pipeline ─────────────────────────────────────────────
echo ""
echo "🔷 Running KG pipeline..."
echo ""

python3 /app/kg_pipeline.py \
    --json "$JSON_PATH" \
    $FAIR_ARG \
    --out-dir "$OUT_DIR" \
    --fuseki-url "$FUSEKI_URL" \
    --fuseki-dataset "$FUSEKI_DATASET" \
    --fuseki-user "$FUSEKI_USER" \
    --fuseki-password "$FUSEKI_PASSWORD" \
    $FORCE_FLAG

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "============================================================"
    echo "  ✅ KG Pipeline complete!"
    echo "  SPARQL endpoint: $FUSEKI_URL/$FUSEKI_DATASET/sparql"
    echo "  Web UI:          $FUSEKI_URL"
    echo "  Output files:    $OUT_DIR/"
    echo "============================================================"
else
    echo "============================================================"
    echo "  ❌ KG Pipeline failed (exit code $EXIT_CODE)"
    echo "============================================================"
fi

exit $EXIT_CODE
