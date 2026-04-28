import { useState, useCallback } from 'react';
import axios from 'axios';
import { base_url } from '../api';
import Footer from '../components/footer';
import Navbar from '../components/navbar';

const HEALTH_CATEGORIES = [
  'Clinical & Patient Data',
  'Omics & Molecular Data',
  'Medical Imaging & Signals',
  'Public Health & Surveillance',
  'Biobank & Research Data',
  'Behavioral & Social Data',
  'Terminologies & Metadata',
];

const CAT_ICONS = {
  'Clinical & Patient Data':       '🏥',
  'Omics & Molecular Data':        '🧬',
  'Medical Imaging & Signals':     '🩻',
  'Public Health & Surveillance':  '🌍',
  'Biobank & Research Data':       '🧪',
  'Behavioral & Social Data':      '🧠',
  'Terminologies & Metadata':      '📚',
};

// ── Category URI map (used in KG mode queries) ────────────────────────────────
const CAT_URI = {
  'Clinical & Patient Data':       'http://blod.isislab.it/resource/category/Clinical___Patient_Data',
  'Omics & Molecular Data':        'http://blod.isislab.it/resource/category/Omics___Molecular_Data',
  'Medical Imaging & Signals':     'http://blod.isislab.it/resource/category/Medical_Imaging___Signals',
  'Public Health & Surveillance':  'http://blod.isislab.it/resource/category/Public_Health___Surveillance',
  'Biobank & Research Data':       'http://blod.isislab.it/resource/category/Biobank___Research_Data',
  'Behavioral & Social Data':      'http://blod.isislab.it/resource/category/Behavioral___Social_Data',
  'Terminologies & Metadata':      'http://blod.isislab.it/resource/category/Terminologies___Metadata',
};

// ── Example queries per mode ──────────────────────────────────────────────────
const EXAMPLES_MONGO = [
  {
    label: '📋 List 10 datasets',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier\n}\nLIMIT 10',
  },
  {
    label: '⭐ Top FAIR scores',
    query: 'SELECT ?title ?identifier ?fairScore WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s blod:fairScore ?fairScore .\n}\nORDER BY DESC(?fairScore)\nLIMIT 10',
  },
  {
    label: '🏥 Clinical & Patient Data',
    query: 'SELECT ?title ?identifier ?website WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s schema:url ?website .\n  ?s dcat:category "Clinical & Patient Data"\n}\nLIMIT 50',
  },
  {
    label: '🧬 Omics & Molecular Data',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Omics & Molecular Data"\n}\nLIMIT 50',
  },
  {
    label: '🔎 Search title (free text)',
    query: 'SELECT ?title ?website WHERE {\n  ?s dct:title ?title .\n  ?s schema:url ?website .\n  FILTER(REGEX(?title, "drug", "i"))\n}\nLIMIT 20',
  },
  {
    label: '📜 With license (A-Z)',
    query: 'SELECT ?title ?license WHERE {\n  ?s dct:title ?title .\n  ?s dct:license ?license\n}\nORDER BY ASC(?title)\nLIMIT 25',
  },
];

const EXAMPLES_KG = [
  {
    label: '📋 List 10 datasets',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n}\nLIMIT 10',
  },
  {
    label: '⭐ Top FAIR scores',
    query: 'SELECT ?title ?fairScore ?fScore ?aScore ?iScore ?rScore WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s blod:fairScore ?fairScore .\n  ?s blod:fScore ?fScore .\n  ?s blod:aScore ?aScore .\n  ?s blod:iScore ?iScore .\n  ?s blod:rScore ?rScore .\n}\nORDER BY DESC(?fairScore)\nLIMIT 10',
  },
  {
    label: '🏥 Clinical & Patient Data',
    query: `SELECT ?title ?identifier ?website WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s schema:url ?website .\n  ?s blod:healthCategory <${CAT_URI['Clinical & Patient Data']}> .\n}\nLIMIT 50`,
  },
  {
    label: '🧬 Omics & Molecular Data',
    query: `SELECT ?title ?identifier WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s blod:healthCategory <${CAT_URI['Omics & Molecular Data']}> .\n}\nLIMIT 50`,
  },
  {
    label: '🔗 Dataset interlinking',
    query: 'SELECT ?title ?targetTitle (SUM(?links) AS ?totalLinks) WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?linkset void:target ?s .\n  ?linkset void:target ?target .\n  ?linkset void:triples ?links .\n  ?target dct:title ?targetTitle .\n  FILTER(?s != ?target)\n}\nGROUP BY ?title ?targetTitle\nORDER BY DESC(?totalLinks)\nLIMIT 20',
  },
  {
    label: '🌐 With Wikidata links',
    query: 'SELECT ?title ?wikidataUri WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s owl:sameAs ?wikidataUri .\n  FILTER(STRSTARTS(STR(?wikidataUri), "http://www.wikidata.org"))\n}\nLIMIT 20',
  },
  {
    label: '📊 FAIR score distribution',
    query: 'SELECT ?title ?fairScore ?fScore ?aScore ?iScore ?rScore WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s blod:fairScore ?fairScore .\n  OPTIONAL { ?s blod:fScore ?fScore }\n  OPTIONAL { ?s blod:aScore ?aScore }\n  OPTIONAL { ?s blod:iScore ?iScore }\n  OPTIONAL { ?s blod:rScore ?rScore }\n  FILTER(?fairScore > 2.5)\n}\nORDER BY DESC(?fairScore)',
  },
  {
    label: '🔎 Search by title',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  FILTER(REGEX(?title, "drug", "i"))\n}\nLIMIT 20',
  },
];

const PREDICATES_MONGO = [
  { prefix: 'dct:identifier',      note: 'Dataset unique ID' },
  { prefix: 'dct:title',           note: 'Human-readable name' },
  { prefix: 'dct:description',     note: 'English description' },
  { prefix: 'dct:license',         note: 'License URI' },
  { prefix: 'dcat:category',       note: 'Health domain (use one of the 7 categories)' },
  { prefix: 'void:triples',        note: 'Triple count' },
  { prefix: 'schema:url',          note: 'Dataset website' },
  { prefix: 'blod:fairScore',      note: 'Overall FAIR score (0–4)' },
  { prefix: 'blod:fScore',         note: 'Findability sub-score' },
  { prefix: 'blod:aScore',         note: 'Accessibility sub-score' },
  { prefix: 'blod:iScore',         note: 'Interoperability sub-score' },
  { prefix: 'blod:rScore',         note: 'Reusability sub-score' },
];

const PREDICATES_KG = [
  { prefix: 'a blod:Dataset',       note: 'Type: BLOD Dataset (use in WHERE clause)' },
  { prefix: 'dct:title',            note: 'Human-readable name' },
  { prefix: 'dct:identifier',       note: 'Dataset unique ID' },
  { prefix: 'dct:description',      note: 'Description (lang-tagged)' },
  { prefix: 'dct:license',          note: 'License URI' },
  { prefix: 'blod:healthCategory',  note: 'Health domain URI (use CAT_URI for full URI)' },
  { prefix: 'blod:fairScore',       note: 'Overall FAIR score (0–4)' },
  { prefix: 'blod:fScore',          note: 'Findability score' },
  { prefix: 'blod:aScore',          note: 'Accessibility score' },
  { prefix: 'blod:iScore',          note: 'Interoperability score' },
  { prefix: 'blod:rScore',          note: 'Reusability score' },
  { prefix: 'fair:F1_M',            note: 'F1-M: Unique & persistent ID' },
  { prefix: 'fair:A1_D',            note: 'A1-D: Working access points' },
  { prefix: 'fair:I2',              note: 'I2: Use of FAIR vocabularies' },
  { prefix: 'void:triples',         note: 'Number of RDF triples' },
  { prefix: 'void:sparqlEndpoint',  note: 'SPARQL endpoint URL' },
  { prefix: 'void:subset',          note: 'Linkset to another dataset' },
  { prefix: 'schema:url',           note: 'Dataset website' },
  { prefix: 'owl:sameAs',           note: 'Wikidata entity URI' },
];

const ACCENT      = '#8da89f';
const ACCENT_DARK = '#6b8f86';
const KG_ACCENT   = '#6b68b8';
const KG_DARK     = '#4f4c9a';

export default function SparqlPage() {
  const [mode, setMode]                 = useState('mongo'); // 'mongo' | 'kg'
  const [query, setQuery]               = useState(EXAMPLES_MONGO[0].query);
  const [results, setResults]           = useState(null);
  const [error, setError]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [showRef, setShowRef]           = useState(false);
  const [elapsed, setElapsed]           = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [kgStatus, setKgStatus]         = useState(null); // null | 'online' | 'offline'
  const [kgTriples, setKgTriples]       = useState(null);

  const isKG      = mode === 'kg';
  const examples  = isKG ? EXAMPLES_KG  : EXAMPLES_MONGO;
  const predicates = isKG ? PREDICATES_KG : PREDICATES_MONGO;
  const accentColor = isKG ? KG_ACCENT : ACCENT;
  const accentDark  = isKG ? KG_DARK   : ACCENT_DARK;

  // Check KG status when switching to KG mode
  const switchMode = async (newMode) => {
    setMode(newMode);
    setResults(null);
    setError(null);
    setActiveCategory(null);
    setQuery(newMode === 'kg' ? EXAMPLES_KG[0].query : EXAMPLES_MONGO[0].query);

    if (newMode === 'kg' && kgStatus === null) {
      try {
        const res = await axios.get(`${base_url}/kg/status`);
        setKgStatus(res.data.status === 'online' ? 'online' : 'offline');
        setKgTriples(res.data.triples);
      } catch {
        setKgStatus('offline');
      }
    }
  };

  const runQuery = useCallback(async (q) => {
    const queryToRun = typeof q === 'string' ? q : query;
    if (!queryToRun.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const endpoint = isKG ? `${base_url}/kg/sparql` : `${base_url}/sparql`;
      const res = await axios.get(endpoint, {
        params: { query: queryToRun },
        headers: { Accept: 'application/sparql-results+json' },
      });
      setResults(res.data);
      setElapsed(Date.now() - t0);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [query, isKG]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runQuery();
  };

  const selectCategory = (cat) => {
    setActiveCategory(cat);
    let q;
    if (isKG) {
      const uri = CAT_URI[cat] || '';
      q = `SELECT ?title ?identifier ?website WHERE {\n  ?s a blod:Dataset .\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  OPTIONAL { ?s schema:url ?website }\n  ?s blod:healthCategory <${uri}> .\n}\nLIMIT 50`;
    } else {
      q = `SELECT ?title ?identifier ?website WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s schema:url ?website .\n  ?s dcat:category "${cat}"\n}\nLIMIT 50`;
    }
    setQuery(q);
    runQuery(q);
  };

  const selectExample = (ex) => {
    setActiveCategory(null);
    setQuery(ex.query);
  };

  const vars     = results?.head?.vars      ?? [];
  const bindings = results?.results?.bindings ?? [];

  return (
    <>
      <div className="container-fluid mt-3 px-4">
        <Navbar />
      </div>

      <div className="container mt-2 pb-5 min-vh-100">

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="mb-0 fw-bold">SPARQL Endpoint</h3>
            <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
              {isKG
                ? <>Query the <strong>BLOD Knowledge Graph</strong> &nbsp;·&nbsp;
                    <code style={{ fontSize: '0.82rem' }}>{base_url}/kg/sparql</code>
                  </>
                : <>Query the BLOD catalogue &nbsp;·&nbsp;
                    <code style={{ fontSize: '0.82rem' }}>{base_url}/sparql</code>
                  </>
              }
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            {/* Mode toggle */}
            <div className="btn-group" role="group">
              <button
                className="btn btn-sm"
                style={{
                  backgroundColor: isKG ? KG_ACCENT : '#f0f0ff',
                  color: isKG ? '#fff' : '#555',
                  border: `1px solid ${KG_ACCENT}`,
                  fontSize: '0.78rem',
                }}
                onClick={() => switchMode('kg')}
              >
                🔷 Knowledge Graph
              </button>
            </div>
            <button
              className="btn btn-sm"
              style={{ backgroundColor: accentColor, color: '#fff', border: 'none' }}
              onClick={() => setShowRef(v => !v)}
            >
              {showRef ? 'Hide' : 'Show'} Predicates
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => {
                const endpoint = isKG ? `${base_url}/kg/sparql` : `${base_url}/sparql`;
                navigator.clipboard.writeText(`${endpoint}?query=${encodeURIComponent(query)}`);
              }}
            >
              📋 Copy URL
            </button>
          </div>
        </div>

        {/* KG status banner */}
        {isKG && (
          <div
            className="alert py-2 px-3 mb-3 d-flex align-items-center gap-3"
            style={{
              backgroundColor: kgStatus === 'online' ? '#eef6f4' : kgStatus === 'offline' ? '#fdf0f0' : '#f5f5ff',
              border: `1px solid ${kgStatus === 'online' ? '#b2d8d0' : kgStatus === 'offline' ? '#f5c6c6' : '#c8c6f0'}`,
              fontSize: '0.83rem',
            }}
          >
            <span>
              {kgStatus === 'online'  && <span>✅ <strong>Fuseki online</strong> — {kgTriples?.toLocaleString()} triples loaded · Real native SPARQL</span>}
              {kgStatus === 'offline' && <span>❌ <strong>Fuseki offline</strong> — Start Fuseki with <code>docker-compose up -d fuseki</code> then load the KG</span>}
              {kgStatus === null      && <span>⏳ Checking Knowledge Graph status…</span>}
            </span>
            {kgStatus === 'online' && (
              <a href={`${base_url}/kg/info`} target="_blank" rel="noreferrer" style={{ color: KG_ACCENT, fontSize: '0.78rem', marginLeft: 'auto' }}>
                /kg/info ↗
              </a>
            )}
          </div>
        )}

        {/* Health domain pills */}
        <div className="mb-3">
          <p className="fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>Quick Filter by Health Domain</p>
          <div className="d-flex flex-wrap gap-2">
            {HEALTH_CATEGORIES.map(cat => (
              <button
                key={cat}
                className="btn btn-sm"
                style={{
                  backgroundColor: activeCategory === cat ? accentColor : '#f0f4f3',
                  color: activeCategory === cat ? '#fff' : '#333',
                  border: `1px solid ${activeCategory === cat ? accentColor : '#cde0db'}`,
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  transition: 'all 0.15s',
                }}
                onClick={() => selectCategory(cat)}
              >
                {CAT_ICONS[cat]} {cat}
              </button>
            ))}
            {activeCategory && (
              <button
                className="btn btn-sm btn-outline-secondary"
                style={{ borderRadius: '20px', fontSize: '0.78rem' }}
                onClick={() => { setActiveCategory(null); setResults(null); setQuery(examples[0].query); }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* Predicate reference */}
        {showRef && (
          <div className="card mb-3 border-0 shadow-sm" style={{ fontSize: '0.82rem' }}>
            <div className="card-body py-2 px-3">
              <strong>{isKG ? '🔷 Knowledge Graph Predicates' : '🗄 MongoDB Predicates'}</strong>
              {isKG && (
                <div className="alert alert-info py-1 px-2 mt-1 mb-2" style={{ fontSize: '0.78rem' }}>
                  <strong>KG mode:</strong> Always start with <code>?s a blod:Dataset .</code> — this is real SPARQL against the RDF triplestore.
                  All prefixes are injected automatically.
                </div>
              )}
              <div className="table-responsive">
                <table className="table table-sm table-borderless mb-0">
                  <thead><tr><th>Predicate</th><th>Notes</th></tr></thead>
                  <tbody>
                    {predicates.map(p => (
                      <tr key={p.prefix}>
                        <td><code>{p.prefix}</code></td>
                        <td className="text-muted">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="row g-3">
          {/* Left panel */}
          <div className="col-12 col-lg-4">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body py-2 px-3">
                <p className="fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>Example Queries</p>
                <div className="d-flex flex-column gap-1" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {examples.map(ex => (
                    <button
                      key={ex.label}
                      className="btn btn-sm text-start"
                      style={{
                        backgroundColor: query === ex.query && !activeCategory ? accentColor : '#f8f9fa',
                        color: query === ex.query && !activeCategory ? '#fff' : '#333',
                        border: `1px solid ${query === ex.query && !activeCategory ? accentColor : '#dee2e6'}`,
                        fontSize: '0.8rem',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => selectExample(ex)}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm" style={{ fontSize: '0.78rem' }}>
              <div className="card-body py-2 px-3">
                <p className="fw-semibold mb-1">API Access</p>
                {isKG ? (
                  <>
                    <p className="text-muted mb-1">GET (KG):</p>
                    <code className="d-block text-break" style={{ background: '#f0f0ff', padding: '4px 6px', borderRadius: 4 }}>
                      GET {base_url}/kg/sparql?query=SELECT…
                    </code>
                    <p className="text-muted mt-2 mb-1">Status:</p>
                    <code className="d-block" style={{ background: '#f0f0ff', padding: '4px 6px', borderRadius: 4 }}>
                      GET {base_url}/kg/status
                    </code>
                  </>
                ) : (
                  <>
                    <p className="text-muted mb-1">GET:</p>
                    <code className="d-block text-break" style={{ background: '#f4f4f4', padding: '4px 6px', borderRadius: 4 }}>
                      GET {base_url}/sparql?query=SELECT…
                    </code>
                    <p className="text-muted mt-2 mb-1">POST (JSON):</p>
                    <code className="d-block" style={{ background: '#f4f4f4', padding: '4px 6px', borderRadius: 4 }}>
                      {'{ "query": "SELECT …" }'}
                    </code>
                  </>
                )}
                <p className="text-muted mt-2 mb-0">
                  Returns <strong>W3C SPARQL JSON</strong> format.&nbsp;
                  <a
                    href={isKG ? `${base_url}/kg/info` : `${base_url}/sparql/info`}
                    target="_blank" rel="noreferrer"
                    style={{ color: accentDark }}
                  >
                    {isKG ? '/kg/info' : '/sparql/info'} ↗
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm mb-3">
              <div
                className="card-body py-2 px-3"
                style={{ borderTop: `3px solid ${accentColor}`, borderRadius: '8px' }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                    Query Editor
                    <span
                      className="ms-2 badge"
                      style={{
                        background: isKG ? KG_ACCENT : ACCENT,
                        fontSize: '0.65rem',
                        verticalAlign: 'middle',
                      }}
                    >
                      {isKG ? '🔷 KG' : '🗄 MongoDB'}
                    </span>
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>Ctrl+Enter to run</span>
                </div>
                <textarea
                  className="form-control font-monospace"
                  style={{
                    minHeight: '200px', fontSize: '0.82rem', resize: 'vertical',
                    backgroundColor: isKG ? '#1a1a2e' : '#1e1e2e',
                    color: isKG ? '#c8c6f8' : '#cdd6f4',
                    border: 'none', borderRadius: '6px', lineHeight: 1.6,
                  }}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setActiveCategory(null); }}
                  onKeyDown={handleKeyDown}
                  spellCheck={false}
                />
                <div className="d-flex justify-content-end mt-2">
                  <button
                    className="btn"
                    style={{ backgroundColor: accentColor, color: '#fff', border: 'none', minWidth: 120 }}
                    onClick={() => runQuery()}
                    disabled={loading}
                  >
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Running…</>
                      : '▶ Run Query'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2 px-3" style={{ fontSize: '0.85rem' }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {results && (
              <div className="card border-0 shadow-sm">
                <div className="card-body py-2 px-3">
                  <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-1">
                    <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>
                      Results
                      {activeCategory && (
                        <span className="ms-2 badge" style={{ background: accentColor, fontSize: '0.72rem' }}>
                          {CAT_ICONS[activeCategory]} {activeCategory}
                        </span>
                      )}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {bindings.length} row{bindings.length !== 1 ? 's' : ''}
                      {elapsed != null && ` · ${elapsed} ms`}
                    </span>
                  </div>

                  {bindings.length === 0 ? (
                    <div className="alert alert-info py-2 mb-0" style={{ fontSize: '0.85rem' }}>
                      No results returned.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ maxHeight: '420px' }}>
                      <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light sticky-top">
                          <tr>
                            {vars.map(v => (
                              <th key={v} style={{ whiteSpace: 'nowrap' }}>
                                {v.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bindings.map((row, i) => (
                            <tr key={i}>
                              {vars.map(v => {
                                const cell = row[v];
                                const val  = cell?.value ?? '';
                                return (
                                  <td key={v} style={{ maxWidth: '260px', wordBreak: 'break-all' }}>
                                    {cell?.type === 'uri' ? (
                                      <a href={val} target="_blank" rel="noreferrer" style={{ color: accentDark, fontSize: '0.78rem' }}>
                                        {val.length > 55 ? val.slice(0, 55) + '…' : val}
                                      </a>
                                    ) : (
                                      <span title={val}>{val.length > 90 ? val.slice(0, 90) + '…' : val}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-2 text-end">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href = url; a.download = 'sparql-results.json'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      ⬇ Download JSON
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}
