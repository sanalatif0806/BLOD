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
  'Clinical & Patient Data': '🏥',
  'Omics & Molecular Data': '🧬',
  'Medical Imaging & Signals': '🩻',
  'Public Health & Surveillance': '🌍',
  'Biobank & Research Data': '🧪',
  'Behavioral & Social Data': '🧠',
  'Terminologies & Metadata': '📚',
};

const EXAMPLES = [
  {
    label: '📋 List 10 datasets',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier\n}\nLIMIT 10',
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
    label: '🩻 Medical Imaging & Signals',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Medical Imaging & Signals"\n}\nLIMIT 50',
  },
  {
    label: '🌍 Public Health & Surveillance',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Public Health & Surveillance"\n}\nLIMIT 50',
  },
  {
    label: '🧪 Biobank & Research Data',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Biobank & Research Data"\n}\nLIMIT 50',
  },
  {
    label: '🧠 Behavioral & Social Data',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Behavioral & Social Data"\n}\nLIMIT 50',
  },
  {
    label: '📚 Terminologies & Metadata',
    query: 'SELECT ?title ?identifier WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s dcat:category "Terminologies & Metadata"\n}\nLIMIT 50',
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

const PREDICATES = [
  { prefix: 'dct:identifier',      field: 'identifier',         note: 'Dataset unique ID' },
  { prefix: 'dct:title',           field: 'title',              note: 'Human-readable name' },
  { prefix: 'dct:description',     field: 'description.en',     note: 'English description' },
  { prefix: 'dct:license',         field: 'license',            note: 'License URI' },
  { prefix: 'dct:publisher',       field: 'contact_point.name', note: 'Publisher / contact name' },
  { prefix: 'dct:doi',             field: 'doi',                note: 'DOI reference' },
  { prefix: 'dcat:keyword',        field: 'keywords',           note: 'All keyword tags (array)' },
  { prefix: 'dcat:category',       field: 'keywords',           note: 'Health domain — use one of the 7 BLOD categories' },
  { prefix: 'blod:category',       field: 'keywords',           note: 'Alias for dcat:category' },
  { prefix: 'void:triples',        field: 'triples',            note: 'Triple count' },
  { prefix: 'void:sparqlEndpoint', field: 'sparqlEndpoint',     note: 'Live SPARQL endpoint URL' },
  { prefix: 'schema:url',          field: 'website',            note: 'Dataset website' },
  { prefix: 'schema:domain',       field: 'domain',             note: 'LOD-Cloud domain (e.g. life_sciences)' },
  { prefix: 'owl:sameAs',          field: 'wikidataurl',        note: 'Wikidata entity URI' },
];

const ACCENT = '#8da89f';
const ACCENT_DARK = '#6b8f86';

export default function SparqlPage() {
  const [query, setQuery] = useState(EXAMPLES[0].query);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);

  const runQuery = useCallback(async (q) => {
    const queryToRun = typeof q === 'string' ? q : query;
    if (!queryToRun.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await axios.get(`${base_url}/sparql`, {
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
  }, [query]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runQuery();
  };

  const selectCategory = (cat) => {
    setActiveCategory(cat);
    const q = `SELECT ?title ?identifier ?website WHERE {\n  ?s dct:title ?title .\n  ?s dct:identifier ?identifier .\n  ?s schema:url ?website .\n  ?s dcat:category "${cat}"\n}\nLIMIT 50`;
    setQuery(q);
    runQuery(q);
  };

  const selectExample = (ex) => {
    setActiveCategory(null);
    setQuery(ex.query);
  };

  const vars = results?.head?.vars ?? [];
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
              Query the BLOD catalogue &nbsp;·&nbsp;
              <code style={{ fontSize: '0.82rem' }}>{base_url}/sparql</code>
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-sm"
              style={{ backgroundColor: ACCENT, color: '#fff', border: 'none' }}
              onClick={() => setShowRef(v => !v)}
            >
              {showRef ? 'Hide' : 'Show'} Predicates
            </button>
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => navigator.clipboard.writeText(`${base_url}/sparql?query=${encodeURIComponent(query)}`)}
            >
              📋 Copy URL
            </button>
          </div>
        </div>

        {/* Health domain pills */}
        <div className="mb-3">
          <p className="fw-semibold mb-2" style={{ fontSize: '0.85rem' }}>Quick Filter by Health Domain</p>
          <div className="d-flex flex-wrap gap-2">
            {HEALTH_CATEGORIES.map(cat => (
              <button
                key={cat}
                className="btn btn-sm"
                style={{
                  backgroundColor: activeCategory === cat ? ACCENT : '#f0f4f3',
                  color: activeCategory === cat ? '#fff' : '#333',
                  border: `1px solid ${activeCategory === cat ? ACCENT : '#cde0db'}`,
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
                onClick={() => { setActiveCategory(null); setResults(null); setQuery(EXAMPLES[0].query); }}
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
              <strong>Supported predicates</strong>
              <div className="alert alert-info py-1 px-2 mt-1 mb-2" style={{ fontSize: '0.78rem' }}>
                <strong>Tip:</strong> BLOD health domains are stored in the <code>keywords</code> array.
                Use <code>dcat:category "Clinical & Patient Data"</code> — not <code>schema:domain</code> — to filter by health domain.
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-borderless mb-0">
                  <thead><tr><th>Predicate</th><th>Field</th><th>Notes</th></tr></thead>
                  <tbody>
                    {PREDICATES.map(p => (
                      <tr key={p.prefix}>
                        <td><code>{p.prefix}</code></td>
                        <td><code style={{ color: '#5a7a71' }}>{p.field}</code></td>
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
                  {EXAMPLES.map(ex => (
                    <button
                      key={ex.label}
                      className="btn btn-sm text-start"
                      style={{
                        backgroundColor: query === ex.query && !activeCategory ? ACCENT : '#f8f9fa',
                        color: query === ex.query && !activeCategory ? '#fff' : '#333',
                        border: `1px solid ${query === ex.query && !activeCategory ? ACCENT : '#dee2e6'}`,
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
                <p className="text-muted mb-1">GET:</p>
                <code className="d-block text-break" style={{ background: '#f4f4f4', padding: '4px 6px', borderRadius: 4 }}>
                  GET {base_url}/sparql?query=SELECT…
                </code>
                <p className="text-muted mt-2 mb-1">POST (JSON):</p>
                <code className="d-block" style={{ background: '#f4f4f4', padding: '4px 6px', borderRadius: 4 }}>
                  {'{ "query": "SELECT …" }'}
                </code>
                <p className="text-muted mt-2 mb-0">
                  Returns <strong>W3C SPARQL JSON</strong> format.&nbsp;
                  <a href={`${base_url}/sparql/info`} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>
                    /sparql/info
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="col-12 col-lg-8">
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body py-2 px-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-semibold" style={{ fontSize: '0.85rem' }}>Query Editor</span>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>Ctrl+Enter to run</span>
                </div>
                <textarea
                  className="form-control font-monospace"
                  style={{
                    minHeight: '200px', fontSize: '0.82rem', resize: 'vertical',
                    backgroundColor: '#1e1e2e', color: '#cdd6f4',
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
                    style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', minWidth: 120 }}
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
                        <span className="ms-2 badge" style={{ background: ACCENT, fontSize: '0.72rem' }}>
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
                          <tr>{vars.map(v => <th key={v} style={{ whiteSpace: 'nowrap' }}>?{v}</th>)}</tr>
                        </thead>
                        <tbody>
                          {bindings.map((row, i) => (
                            <tr key={i}>
                              {vars.map(v => {
                                const cell = row[v];
                                const val = cell?.value ?? '';
                                return (
                                  <td key={v} style={{ maxWidth: '260px', wordBreak: 'break-all' }}>
                                    {cell?.type === 'uri' ? (
                                      <a href={val} target="_blank" rel="noreferrer" style={{ color: ACCENT_DARK, fontSize: '0.78rem' }}>
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
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
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
