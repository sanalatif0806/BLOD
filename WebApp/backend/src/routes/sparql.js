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
  if (typeof value === 'number') {
    return { type: 'literal', datatype: 'http://www.w3.org/2001/XMLSchema#integer', value: String(value) };
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
    const cmpMatch = expr.match(/[?$](\w+)\s*([<>]=?)\s*(\d+)/);
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
      // Special handling: keywords is an array field — use $elemMatch
      if (field === 'keywords') {
        mongoQuery['keywords'] = { $elemMatch: { $regex: `^${p.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
      } else {
        mongoQuery[field] = p.literal;
      }
    }
  }

  // Apply FILTER clauses
  for (const f of filters_loop(parsed.filters, varToField)) {
    Object.assign(mongoQuery, f);
  }

  // SELECT * — expose all fields
  let fieldsNeeded;
  if (parsed.selectStar) {
    fieldsNeeded = [...new Set(Object.values(PREDICATE_MAP))];
    parsed.variables = Object.keys(varToField).length
      ? Object.keys(varToField)
      : Object.keys(PREDICATE_MAP).map(k => k.replace(':', '_'));
  } else {
    fieldsNeeded = parsed.variables.map(v => varToField[v]).filter(Boolean);
  }

  const projection = { _id: 0, identifier: 1 };
  fieldsNeeded.forEach(f => { projection[f.split('.')[0]] = 1; });

  let sortOpt = {};
  if (parsed.orderBy) {
    const sortField = varToField[parsed.orderBy.variable] || parsed.orderBy.variable;
    sortOpt[sortField] = parsed.orderBy.dir === 'DESC' ? -1 : 1;
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

  const bindings = docs.map(doc => {
    const row = {};
    for (const v of resultVars) {
      const field = varToField[v];
      if (!field) continue;
      const val = getNestedValue(doc, field);
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
    ],
  });
});

module.exports = router;
