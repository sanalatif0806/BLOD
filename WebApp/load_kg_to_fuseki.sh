#!/bin/bash
# ============================================================
# load_kg_to_fuseki.sh
# Run this ONCE after starting docker-compose to load the
# BLOD Knowledge Graph into the Fuseki triplestore.
# ============================================================

FUSEKI_URL="${FUSEKI_URL:-http://localhost:3030}"
DATASET="blod"
KG_FILE="./fuseki/blod_knowledge_graph.nt"
ADMIN_PASSWORD="${FUSEKI_ADMIN_PASSWORD:-blod_admin}"

echo "============================================"
echo " BLOD Knowledge Graph Loader"
echo "============================================"
echo " Fuseki URL : $FUSEKI_URL"
echo " Dataset    : $DATASET"
echo " KG file    : $KG_FILE"
echo ""

# Check file exists
if [ ! -f "$KG_FILE" ]; then
    echo "ERROR: $KG_FILE not found."
    echo "Make sure blod_knowledge_graph.nt is in WebApp/fuseki/"
    exit 1
fi

# Wait for Fuseki to be ready
echo "Waiting for Fuseki to be ready..."
for i in $(seq 1 30); do
    if curl -sf "$FUSEKI_URL/$/ping" > /dev/null 2>&1; then
        echo "Fuseki is up!"
        break
    fi
    echo "  Attempt $i/30 — waiting 3s..."
    sleep 3
done

# Check if dataset already has data
COUNT=$(curl -sf \
    --user "admin:$ADMIN_PASSWORD" \
    "$FUSEKI_URL/$DATASET/sparql?query=SELECT+(COUNT(*)+AS+%3Fcount)+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D" \
    -H "Accept: application/sparql-results+json" \
    2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results']['bindings'][0]['count']['value'])" 2>/dev/null || echo "0")

echo "Current triple count in Fuseki: $COUNT"

if [ "$COUNT" -gt "1000" ]; then
    echo "Dataset already loaded ($COUNT triples). Skipping."
    echo "To force reload, run with: FORCE_RELOAD=1 ./load_kg_to_fuseki.sh"
    if [ "$FORCE_RELOAD" != "1" ]; then
        exit 0
    fi
    echo "Force reload enabled — clearing dataset first..."
    curl -sf -X POST \
        --user "admin:$ADMIN_PASSWORD" \
        "$FUSEKI_URL/$DATASET/update" \
        --data "update=CLEAR+ALL"
fi

# Upload the N-Triples file
echo ""
echo "Uploading blod_knowledge_graph.nt to Fuseki..."
echo "(This may take 30-60 seconds for 83,000+ triples)"

HTTP_STATUS=$(curl -s -o /tmp/fuseki_upload.log -w "%{http_code}" \
    -X POST \
    --user "admin:$ADMIN_PASSWORD" \
    "$FUSEKI_URL/$DATASET/data" \
    -H "Content-Type: application/n-triples" \
    --data-binary @"$KG_FILE")

if [ "$HTTP_STATUS" -eq "200" ] || [ "$HTTP_STATUS" -eq "201" ]; then
    echo ""
    echo "✅ Upload successful! (HTTP $HTTP_STATUS)"

    # Verify triple count
    NEW_COUNT=$(curl -sf \
        --user "admin:$ADMIN_PASSWORD" \
        "$FUSEKI_URL/$DATASET/sparql?query=SELECT+(COUNT(*)+AS+%3Fcount)+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D" \
        -H "Accept: application/sparql-results+json" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['results']['bindings'][0]['count']['value'])" 2>/dev/null || echo "unknown")

    echo "✅ Triples in Fuseki: $NEW_COUNT"
    echo ""
    echo "============================================"
    echo " Fuseki SPARQL endpoint ready at:"
    echo " $FUSEKI_URL/$DATASET/sparql"
    echo ""
    echo " Web UI:"
    echo " $FUSEKI_URL"
    echo "============================================"
else
    echo ""
    echo "❌ Upload failed (HTTP $HTTP_STATUS)"
    cat /tmp/fuseki_upload.log
    exit 1
fi
