/**
 * BLOD Knowledge Graph — Fuseki Proxy Route
 * ==========================================
 * Proxies SPARQL queries to the Fuseki triplestore.
 * Handles both the native KG SPARQL syntax (with full URIs or prefixes)
 * and the simplified BLOD shorthand syntax (dct:title, blod:fairScore, etc.)
 *
 * Mount at: app.use('/kg', require('./routes/kg'));
 *
 * Endpoints:
 *   GET  /kg/sparql?query=...     — run SPARQL against Fuseki
 *   POST /kg/sparql               — run SPARQL against Fuseki (body: { query })
 *   GET  /kg/status               — Fuseki health + triple count
 *   GET  /kg/info                 — available prefixes and example queries
 */

const router = require('express').Router();
const axios  = require('axios');

const FUSEKI_URL     = process.env.FUSEKI_URL     || 'http://fuseki:3030';
const FUSEKI_DATASET = process.env.FUSEKI_DATASET || 'blod';
const FUSEKI_USER    = process.env.FUSEKI_USER    || 'admin';
const FUSEKI_PASS    = process.env.FUSEKI_PASS    || 'blod_admin';

const SPARQL_ENDPOINT = `${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`;

// ── Standard prefix declarations injected into every query ───────────────────
const PREFIXES = `
PREFIX blod:   <http://blod.isislab.it/ontology#>
PREFIX blodr:  <http://blod.isislab.it/resource/>
PREFIX fair:   <http://blod.isislab.it/fair#>
PREFIX dct:    <http://purl.org/dc/terms/>
PREFIX dcat:   <http://www.w3.org/ns/dcat#>
PREFIX void:   <http://rdfs.org/ns/void#>
PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
PREFIX schema: <https://schema.org/>
PREFIX owl:    <http://www.w3.org/2002/07/owl#>
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:    <http://www.w3.org/2001/XMLSchema#>
PREFIX skos:   <http://www.w3.org/2004/02/skos/core#>
PREFIX wd:     <http://www.wikidata.org/entity/>
`.trim();

// ── Inject prefixes if not already present ───────────────────────────────────
function injectPrefixes(query) {
  const q = query.trim();
  // Already has PREFIX declarations — don't double-inject
  if (/^PREFIX\s/i.test(q)) return q;
  return `${PREFIXES}\n\n${q}`;
}

// ── Proxy a SPARQL query to Fuseki ───────────────────────────────────────────
async function runSparql(query) {
  const fullQuery = injectPrefixes(query);
  const response = await axios.get(SPARQL_ENDPOINT, {
    params: { query: fullQuery },
    headers: { Accept: 'application/sparql-results+json' },
    auth: { username: FUSEKI_USER, password: FUSEKI_PASS },
    timeout: 30000,
  });
  return response.data;
}

// ── GET /kg/sparql ────────────────────────────────────────────────────────────
router.get('/sparql', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Missing ?query= parameter' });
  try {
    const results = await runSparql(query);
    res.json(results);
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data   || err.message;
    res.status(status).json({ error: message });
  }
});

// ── POST /kg/sparql ───────────────────────────────────────────────────────────
router.post('/sparql', async (req, res) => {
  const query = req.body?.query;
  if (!query) return res.status(400).json({ error: 'Missing { query } in request body' });
  try {
    const results = await runSparql(query);
    res.json(results);
  } catch (err) {
    const status  = err.response?.status || 500;
    const message = err.response?.data   || err.message;
    res.status(status).json({ error: message });
  }
});

// ── GET /kg/status ────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    // Ping Fuseki
    await axios.get(`${FUSEKI_URL}/$/ping`, {
      auth: { username: FUSEKI_USER, password: FUSEKI_PASS },
      timeout: 5000,
    });

    // Count triples
    const countResult = await runSparql('SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o }');
    const count = parseInt(countResult?.results?.bindings?.[0]?.count?.value || '0', 10);

    // Count datasets
    const dsResult = await runSparql('SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE { ?s a <http://blod.isislab.it/ontology#Dataset> }');
    const datasets = parseInt(dsResult?.results?.bindings?.[0]?.count?.value || '0', 10);

    res.json({
      status:   'online',
      fuseki:   SPARQL_ENDPOINT,
      triples:  count,
      datasets: datasets,
    });
  } catch (err) {
    res.status(503).json({ status: 'offline', error: err.message });
  }
});

// ── GET /kg/info ──────────────────────────────────────────────────────────────
router.get('/info', (req, res) => {
  res.json({
    endpoint:  SPARQL_ENDPOINT,
    prefixes: {
      blod:   'http://blod.isislab.it/ontology#',
      blodr:  'http://blod.isislab.it/resource/',
      fair:   'http://blod.isislab.it/fair#',
      dct:    'http://purl.org/dc/terms/',
      dcat:   'http://www.w3.org/ns/dcat#',
      void:   'http://rdfs.org/ns/void#',
      schema: 'https://schema.org/',
      owl:    'http://www.w3.org/2002/07/owl#',
    },
    properties: {
      'dct:title':          'Dataset name',
      'dct:identifier':     'Dataset unique ID',
      'dct:description':    'Description (lang: en)',
      'dct:license':        'License URI',
      'blod:fairScore':     'Overall FAIR score (0-4)',
      'blod:fScore':        'Findability score',
      'blod:aScore':        'Accessibility score',
      'blod:iScore':        'Interoperability score',
      'blod:rScore':        'Reusability score',
      'blod:healthCategory':'Health domain category URI',
      'void:triples':       'Number of RDF triples',
      'void:sparqlEndpoint':'SPARQL endpoint URL',
      'schema:url':         'Dataset website',
      'owl:sameAs':         'Wikidata URI',
    },
    health_categories: [
      'Clinical & Patient Data',
      'Omics & Molecular Data',
      'Medical Imaging & Signals',
      'Public Health & Surveillance',
      'Biobank & Research Data',
      'Behavioral & Social Data',
      'Terminologies & Metadata',
    ],
    example_queries: {
      top_fair: `SELECT ?title ?fairScore WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s blod:fairScore ?fairScore .
}
ORDER BY DESC(?fairScore)
LIMIT 10`,
      by_category: `SELECT ?title ?identifier WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s dct:identifier ?identifier .
  ?s blod:healthCategory <http://blod.isislab.it/resource/category/Clinical___Patient_Data> .
}
LIMIT 25`,
      all_scores: `SELECT ?title ?fairScore ?fScore ?aScore ?iScore ?rScore WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s blod:fairScore ?fairScore .
  ?s blod:fScore ?fScore .
  ?s blod:aScore ?aScore .
  ?s blod:iScore ?iScore .
  ?s blod:rScore ?rScore .
}
ORDER BY DESC(?fairScore)
LIMIT 25`,
      with_wikidata: `SELECT ?title ?wikidataUri WHERE {
  ?s a blod:Dataset .
  ?s dct:title ?title .
  ?s owl:sameAs ?wikidataUri .
}
LIMIT 20`,
    },
  });
});

module.exports = router;
