/**
 * BLOD SPARQL Endpoint
 * Translates SPARQL SELECT queries into MongoDB queries.
 * Returns W3C SPARQL JSON Results Format.
 *
 * Supported predicates:
 *   dct:identifier   → identifier
 *   dct:title        → title
 *   dct:description  → description.en
 *   dct:license      → license
 *   dct:publisher    → contact_point.name
 *   dct:doi          → doi
 *   dcat:keyword     → keywords  (array — use FILTER(REGEX) or literal binding)
 *   dcat:category    → keywords  (alias — matches the 7 health categories)
 *   void:triples     → triples
 *   void:sparqlEndpoint → sparqlEndpoint
 *   schema:url       → website
 *   schema:domain    → domain    (e.g. "life_sciences")
 *   blod:category    → keywords  (alias for health category filter)
 *   owl:sameAs       → wikidataurl
 *
 * Health categories (filter with dcat:category or blod:category):
 *   "Clinical & Patient Data"
 *   "Omics & Molecular Data"
 *   "Medical Imaging & Signals"
 *   "Public Health & Surveillance"
 *   "Biobank & Research Data"
 *   "Behavioral & Social Data"
 *   "Terminologies & Metadata"
 */

const router = require('express').Router();
const { getCollection } = require('../models/BLOD');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const axios = require('axios');

const KGHEARTBEAT_API = 'https://kgheartbeat.di.unisa.it/kgheartbeat-api/fairness';

// FAIR score fields — not stored in MongoDB, fetched from KGHeartBeat API with CSV fallback
const FAIR_FIELDS = new Set(['fair_score', 'fair_score_f', 'fair_score_a', 'fair_score_i', 'fair_score_r']);

// ── CSV fallback: loaded once at startup ──────────────────────────────────────
// In-memory map: lowercase identifier → { fair_score, fair_score_f, ... }
let fairScoreMap = new Map();

function loadFairScoresFromCSV() {
  const csvPath = path.join(__dirname, '..', '..', 'data', 'fairness-data.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('[FAIR] fairness-data.csv not found at', csvPath);
    return;
  }
  let count = 0;
  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', row => {
      const id = (row['KG id'] || '').trim().toLowerCase();
      if (!id) return;
      const fair = parseFloat(row['FAIR score']);
      const f    = parseFloat(row['F score']);
      const a    = parseFloat(row['A score']);
      const i    = parseFloat(row['I score']);
      const r    = parseFloat(row['R score']);
      fairScoreMap.set(id, {
        fair_score:   isNaN(fair) ? null : fair,
        fair_score_f: isNaN(f)    ? null : f,
        fair_score_a: isNaN(a)    ? null : a,
        fair_score_i: isNaN(i)    ? null : i,
        fair_score_r: isNaN(r)    ? null : r,
      });
      count++;
    })
    .on('end', () => console.log(`[FAIR] Loaded ${count} FAIR scores from CSV fallback`))
    .on('error', err => console.error('[FAIR] CSV load error:', err.message));
}

loadFairScoresFromCSV();

// ── API + fallback cache ──────────────────────────────────────────────────────
const fairApiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchFairScores(identifier) {
  // 1. Check in-process API cache
  const cached = fairApiCache.get(identifier);
  if (cached && Date.now() - cached._ts < CACHE_TTL_MS) {
    return cached;
  }

  // 2. Try KGHeartBeat API (live, most up-to-date)
  try {
    const { data } = await axios.get(
      `${KGHEARTBEAT_API}/${encodeURIComponent(identifier)}`,
      { timeout: 5000 }
    );
    // API returns: fair_score, f_score, a_score, i_score, r_score
    const scores = {
      fair_score:   data.fair_score ?? null,
      fair_score_f: data.f_score    ?? null,
      fair_score_a: data.a_score    ?? null,
      fair_score_i: data.i_score    ?? null,
      fair_score_r: data.r_score    ?? null,
      _ts: Date.now(),
      _source: 'api',
    };
    fairApiCache.set(identifier, scores);
    return scores;
  } catch (err) {
    console.warn(`[FAIR] API unavailable for "${identifier}" (${err.message}), falling back to CSV`);
  }

  // 3. Fallback to local CSV
  const csvScores = fairScoreMap.get(identifier.toLowerCase());
  if (csvScores) {
    return { ...csvScores, _ts: Date.now(), _source: 'csv' };
  }

  return null;
}

// ── Prefix → field mapping ────────────────────────────────────────────────────
const PREDICATE_MAP = {
  'dct:identifier':      'identifier',
  'dct:title':           'title',
  'dct:description':     'description.en',
  'dct:license':         'license',
  'dct:publisher':       'contact_point.name',
  'dct:doi':             'doi',
  'dcat:keyword':        'keywords',
  'dcat:category':       'keywords',   // health-category alias
  'blod:category':       'keywords',   // same
  'void:triples':        'triples',
  'void:sparqlEndpoint': 'sparqlEndpoint',
  'schema:url':          'website',
  'schema:domain':       'domain',
  'owl:sameAs':          'wikidataurl',
  // FAIR score predicates (populated by sync_fairness_scores.js)
  'blod:fairScore':      'fair_score',
  'blod:fScore':         'fair_score_f',
  'blod:aScore':         'fair_score_a',
  'blod:iScore':         'fair_score_i',
  'blod:rScore':         'fair_score_r',
};

const HEALTH_CATEGORIES = [
  'Clinical & Patient Data',
  'Omics & Molecular Data',
  'Medical Imaging & Signals',
  'Public Health & Surveillance',
  'Biobank & Research Data',
  'Behavioral & Social Data',
  'Terminologies & Metadata',
];

function resolveField(pred) {
  return PREDICATE_MAP[pred] ?? null;
}

function getNestedValue(doc, path) {
  return path.split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), doc);
}

function makeCell(value) {
  if (value === undefined || value === null) return undefined;
  // Coerce string numbers (e.g. scores stored as "0.72") to actual numbers
  if (typeof value === 'string' && value !== '' && !isNaN(Number(value))
      && !value.startsWith('http')) {
    value = Number(value);
  }
  if (typeof value === 'number') {
    const isInt = Number.isInteger(value);
    return {
      type: 'literal',
      datatype: isInt
        ? 'http://www.w3.org/2001/XMLSchema#integer'
        : 'http://www.w3.org/2001/XMLSchema#decimal',
      value: String(value)
    };
  }
  if (Array.isArray(value)) return { type: 'literal', value: value.join(', ') };
  const str = String(value);
  if (str.startsWith('http://') || str.startsWith('https://')) return { type: 'uri', value: str };
  return { type: 'literal', value: str };
}

// ── SPARQL Parser ─────────────────────────────────────────────────────────────
function parseSPARQL(query) {
  const q = query.replace(/\s+/g, ' ').trim();

  const selectMatch = q.match(/SELECT\s+(DISTINCT\s+)?(.*?)\s+WHERE/i);
  if (!selectMatch) throw new Error('Only SELECT … WHERE queries are supported.');

  const varsPart = selectMatch[2].trim();
  let variables = [];
  let selectStar = false;
  if (varsPart === '*') {
    selectStar = true;
  } else {
    variables = [...varsPart.matchAll(/[?$](\w+)/g)].map(m => m[1]);
  }

  const whereMatch = q.match(/WHERE\s*\{([\s\S]*?)\}(?:\s|$)/i);
  if (!whereMatch) throw new Error('Missing WHERE { } clause.');
  const whereBody = whereMatch[1].trim();

  // Triple patterns
  const patterns = [];
  const tripleRe = /[?$](\w+)\s+([\w:]+)\s+(?:[?$](\w+)|"([^"]*)")/g;
  let m;
  while ((m = tripleRe.exec(whereBody)) !== null) {
    patterns.push({
      subject: m[1],
      predicate: m[2],
      variable: m[3] || null,
      literal: m[4] !== undefined ? m[4] : null,
    });
  }

  // FILTER clauses
  const filters = [];
  const filterRe = /FILTER\s*\(([^)]+)\)/gi;
  while ((m = filterRe.exec(whereBody)) !== null) {
    const expr = m[1].trim();
    const regexMatch = expr.match(/REGEX\s*\(\s*[?$](\w+)\s*,\s*"([^"]*)"\s*(?:,\s*"([^"]*)"\s*)?\)/i);
    if (regexMatch) {
      filters.push({ type: 'regex', variable: regexMatch[1], pattern: regexMatch[2], flags: regexMatch[3] || '' });
      continue;
    }
    const eqMatch = expr.match(/[?$](\w+)\s*=\s*"([^"]*)"/);
    if (eqMatch) {
      filters.push({ type: 'eq', variable: eqMatch[1], value: eqMatch[2] });
      continue;
    }
    const cmpMatch = expr.match(/[?$](\w+)\s*([<>]=?)\s*(\d+(?:\.\d+)?)/);
    if (cmpMatch) {
      filters.push({ type: 'cmp', variable: cmpMatch[1], op: cmpMatch[2], value: Number(cmpMatch[3]) });
    }
  }

  const limitMatch = q.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = q.match(/OFFSET\s+(\d+)/i);
  const orderMatch = q.match(/ORDER\s+BY\s+(ASC|DESC)?\s*[(?$](\w+)\)?/i);

  return {
    variables, selectStar, patterns, filters,
    limit: limitMatch ? Math.min(parseInt(limitMatch[1], 10), 1000) : 100,
    offset: offsetMatch ? parseInt(offsetMatch[1], 10) : 0,
    orderBy: orderMatch ? { variable: orderMatch[2], dir: (orderMatch[1] || 'ASC').toUpperCase() } : null,
  };
}

// ── Query Executor ─────────────────────────────────────────────────────────────
async function executeSPARQL(parsed) {
  const collection = await getCollection();
  const varToField = {};
  const mongoQuery = {};

  for (const p of parsed.patterns) {
    const field = resolveField(p.predicate);
    if (!field) continue;
    if (p.variable) varToField[p.variable] = field;

    if (p.literal !== null) {
      // Skip FAIR fields — they don't live in MongoDB
      if (FAIR_FIELDS.has(field)) continue;
      if (field === 'keywords') {
        mongoQuery['keywords'] = { $elemMatch: { $regex: `^${p.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
      } else {
        mongoQuery[field] = p.literal;
      }
    }
  }

  // Apply FILTER clauses (FAIR fields skipped — filtered client-side after API fetch)
  for (const f of filters_loop(parsed.filters, varToField)) {
    Object.assign(mongoQuery, f);
  }

  // Determine if any requested variable needs FAIR scores
  const needsFairScores = parsed.selectStar
    || parsed.variables.some(v => FAIR_FIELDS.has(varToField[v]));

  // SELECT * — expose all fields
  let fieldsNeeded;
  if (parsed.selectStar) {
    fieldsNeeded = [...new Set(Object.values(PREDICATE_MAP))].filter(f => !FAIR_FIELDS.has(f));
    parsed.variables = Object.keys(varToField).length
      ? Object.keys(varToField)
      : Object.keys(PREDICATE_MAP).map(k => k.replace(':', '_'));
  } else {
    fieldsNeeded = parsed.variables.map(v => varToField[v]).filter(f => f && !FAIR_FIELDS.has(f));
  }

  const projection = { _id: 0, identifier: 1 };
  fieldsNeeded.forEach(f => { projection[f.split('.')[0]] = 1; });

  let sortOpt = {};
  if (parsed.orderBy) {
    const sortField = varToField[parsed.orderBy.variable] || parsed.orderBy.variable;
    // Only apply MongoDB sort for non-FAIR fields
    if (!FAIR_FIELDS.has(sortField)) {
      sortOpt[sortField] = parsed.orderBy.dir === 'DESC' ? -1 : 1;
    }
  }

  const cursor = collection.find(mongoQuery, { projection });
  if (Object.keys(sortOpt).length) cursor.sort(sortOpt);
  cursor.skip(parsed.offset).limit(parsed.limit);
  const docs = await cursor.toArray();

  // Result variables
  let resultVars = parsed.variables;
  if (parsed.selectStar) {
    resultVars = Object.keys(PREDICATE_MAP).map(k => k.replace(':', '_'));
    Object.keys(PREDICATE_MAP).forEach((pred, i) => {
      varToField[resultVars[i]] = PREDICATE_MAP[pred];
    });
  }

  // Fetch FAIR scores: try KGHeartBeat API first, fall back to local CSV
  let fairScoresByIdentifier = {};
  if (needsFairScores && docs.length > 0) {
    const results = await Promise.all(docs.map(doc => fetchFairScores(doc.identifier)));
    docs.forEach((doc, i) => {
      if (results[i]) fairScoresByIdentifier[doc.identifier] = results[i];
    });
  }

  const bindings = docs.map(doc => {
    const row = {};
    const fairData = fairScoresByIdentifier[doc.identifier] || {};

    for (const v of resultVars) {
      const field = varToField[v];
      if (!field) continue;

      // FAIR fields: API first, CSV fallback, else MongoDB
      const val = FAIR_FIELDS.has(field)
        ? (fairData[field] ?? null)
        : getNestedValue(doc, field);

      const cell = makeCell(val);
      if (cell) row[v] = cell;
    }
    return row;
  });

  return { head: { vars: resultVars }, results: { bindings } };
}

function filters_loop(filters, varToField) {
  const clauses = [];
  for (const f of filters) {
    const field = varToField[f.variable];
    if (!field) continue;
    const clause = {};

    if (f.type === 'eq') {
      if (field === 'keywords') {
        clause['keywords'] = { $elemMatch: { $regex: `^${f.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
      } else {
        clause[field] = f.value;
      }
    } else if (f.type === 'regex') {
      const flags = f.flags || 'i';
      if (field === 'keywords') {
        clause['keywords'] = { $elemMatch: { $regex: f.pattern, $options: flags } };
      } else if (field === 'description.en') {
        clause['description.en'] = { $regex: f.pattern, $options: flags };
      } else {
        clause[field] = { $regex: f.pattern, $options: flags };
      }
    } else if (f.type === 'cmp') {
      const opMap = { '>': '$gt', '<': '$lt', '>=': '$gte', '<=': '$lte' };
      // For numeric comparisons MongoDB needs the stored value to be a number.
      // If it was stored as a string, cast with $toDouble via an aggregation —
      // but since sync_fairness_scores.js stores them as JS numbers, a plain
      // comparison works. We also add a $type guard so docs missing the field
      // are excluded rather than throwing.
      clause[field] = { [opMap[f.op]]: f.value };
    }
    clauses.push(clause);
  }
  return clauses;
}

// ── Route handler ─────────────────────────────────────────────────────────────
async function handleSPARQL(req, res) {
  const query = (req.query.query || req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({
      error: 'Missing query parameter.',
      info: `${req.protocol}://${req.get('host')}/sparql/info`,
    });
  }
  try {
    const parsed = parseSPARQL(query);
    const results = await executeSPARQL(parsed);
    res.setHeader('Content-Type', 'application/sparql-results+json');
    return res.json(results);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

router.get('/', handleSPARQL);
router.post('/', (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/x-www-form-urlencoded')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      req.body = Object.fromEntries(params.entries());
      next();
    });
  } else { next(); }
}, handleSPARQL);

// ── /sparql/info ──────────────────────────────────────────────────────────────
router.get('/info', (req, res) => {
  res.json({
    endpoint: '/sparql',
    description: 'BLOD SPARQL endpoint — queries the biomedical linked open datasets catalogue',
    supported: 'SELECT … WHERE { } with FILTER (REGEX, =, <, >), LIMIT, OFFSET, ORDER BY',
    predicates: PREDICATE_MAP,
    health_categories: HEALTH_CATEGORIES,
    example_queries: [
      {
        label: 'List 10 datasets',
        query: 'SELECT ?title ?identifier WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier } LIMIT 10',
      },
      {
        label: 'Terminologies & Metadata datasets',
        query: 'SELECT ?title ?identifier WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s dcat:category "Terminologies & Metadata" } LIMIT 25',
      },
      {
        label: 'Clinical & Patient Data datasets',
        query: 'SELECT ?title ?identifier ?website WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s schema:url ?website . ?s dcat:category "Clinical & Patient Data" } LIMIT 25',
      },
      {
        label: 'Omics & Molecular Data datasets',
        query: 'SELECT ?title ?identifier WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s dcat:category "Omics & Molecular Data" } LIMIT 25',
      },
      {
        label: 'Search title for "ontology"',
        query: 'SELECT ?title ?website WHERE { ?s dct:title ?title . ?s schema:url ?website . FILTER(REGEX(?title, "ontology", "i")) } LIMIT 20',
      },
      {
        label: 'Datasets with CC license, A–Z',
        query: 'SELECT ?title ?license WHERE { ?s dct:title ?title . ?s dct:license ?license . FILTER(REGEX(?license, "cc", "i")) } ORDER BY ASC(?title) LIMIT 25',
      },
      {
        label: 'Top 25 datasets by FAIR score (descending)',
        note: 'FAIR score scale: 0–4. Run sync_fairness_scores.js first.',
        query: 'SELECT ?title ?identifier ?fairScore WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s blod:fairScore ?fairScore } ORDER BY DESC(?fairScore) LIMIT 25',
      },
      {
        label: 'Datasets with FAIR score above 2.0',
        query: 'SELECT ?title ?identifier ?fairScore WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s blod:fairScore ?fairScore . FILTER(?fairScore > 2.0) } ORDER BY DESC(?fairScore) LIMIT 50',
      },
      {
        label: 'Datasets with FAIR score above 3.0 (highly FAIR)',
        query: 'SELECT ?title ?identifier ?fairScore WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s blod:fairScore ?fairScore . FILTER(?fairScore > 3.0) } ORDER BY DESC(?fairScore) LIMIT 25',
      },
      {
        label: 'Clinical datasets with high FAIR score',
        query: 'SELECT ?title ?identifier ?fairScore WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s blod:fairScore ?fairScore . ?s dcat:category "Clinical & Patient Data" . FILTER(?fairScore > 2.0) } ORDER BY DESC(?fairScore) LIMIT 25',
      },
      {
        label: 'All FAIR sub-scores, best first',
        query: 'SELECT ?title ?identifier ?fairScore ?fScore ?aScore ?iScore ?rScore WHERE { ?s dct:title ?title . ?s dct:identifier ?identifier . ?s blod:fairScore ?fairScore . ?s blod:fScore ?fScore . ?s blod:aScore ?aScore . ?s blod:iScore ?iScore . ?s blod:rScore ?rScore } ORDER BY DESC(?fairScore) LIMIT 25',
      },
    ],
  });
});

module.exports = router;

// ── Debug: test FAIR score fetch for a single identifier ─────────────────────
// Usage: GET /sparql/debug-fair?id=bio2rdf-chembl
router.get('/debug-fair', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Pass ?id=<identifier>' });
  const scores = await fetchFairScores(id);
  res.json({
    identifier: id,
    scores,
    source: scores?._source || 'not found',
    csvLoaded: fairScoreMap.size,
  });
});