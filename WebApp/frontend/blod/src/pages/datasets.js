import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { base_url } from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/navbar';
import Footer from '../components/footer';

const CATEGORIES = [
  'Clinical & Patient Data','Omics & Molecular Data','Medical Imaging & Signals',
  'Public Health & Surveillance','Biobank & Research Data','Behavioral & Social Data','Terminologies & Metadata',
];
const CAT_COLORS = {
  'Clinical & Patient Data':'#e8f4f8','Omics & Molecular Data':'#f0f8e8',
  'Medical Imaging & Signals':'#f8f0e8','Public Health & Surveillance':'#f8e8f0',
  'Biobank & Research Data':'#e8e8f8','Behavioral & Social Data':'#f8f8e8','Terminologies & Metadata':'#e8f8f4',
};
const CAT_ICONS = {
  'Clinical & Patient Data':'🏥','Omics & Molecular Data':'🧬','Medical Imaging & Signals':'🩻',
  'Public Health & Surveillance':'🌍','Biobank & Research Data':'🧪','Behavioral & Social Data':'🧠','Terminologies & Metadata':'📚',
};
const ACCENT = '#8da89f';

export default function Datasets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inputQ, setInputQ] = useState('');

  const category = searchParams.get('category') || '';
  const q        = searchParams.get('q')        || '';
  const page     = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => { setInputQ(q); }, [q]);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await axios.get(`${base_url}/BLOD/datasets`, { params: { category, q, page, limit: 20 } });
      setResults(res.data.results || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setCounts(res.data.categoryCounts || {});
    } catch (err) { setError('Failed to load datasets. ' + (err.message || '')); }
    finally { setLoading(false); }
  }, [category, q, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1'); setSearchParams(next);
  };
  const setPage = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p)); setSearchParams(next);
  };
  const handleSearch = (e) => { e.preventDefault(); setParam('q', inputQ.trim()); };
  const getcat = (kws = []) => CATEGORIES.find(c => kws.includes(c)) || null;

  const delta = 2;
  const pageStart = Math.max(1, page - delta);
  const pageEnd   = Math.min(totalPages, page + delta);
  const pageNums  = Array.from({ length: pageEnd - pageStart + 1 }, (_, i) => pageStart + i);

  return (
    <>
      <div className="container-fluid mt-3 px-4"><Navbar /></div>
      <div className="container-fluid px-4 pb-5 min-vh-100">

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h3 className="fw-bold mb-0">Browse Datasets</h3>
            <p className="text-muted mb-0" style={{fontSize:'0.88rem'}}>
              {total > 0 ? `${total.toLocaleString()} datasets` : 'All biomedical linked open datasets'}
              {category && <> · <strong>{category}</strong></>}
              {q && <> · search: <em>"{q}"</em></>}
            </p>
          </div>
          <button onClick={() => { setSearchParams({}); setInputQ(''); }}
            className="btn btn-sm btn-outline-secondary" style={{fontSize:'0.8rem'}}>
            Clear filters
          </button>
        </div>

        <div className="row g-3">
          {/* Sidebar */}
          <div className="col-12 col-md-3 col-xl-2">
            <form onSubmit={handleSearch} className="mb-3">
              <div className="input-group input-group-sm">
                <input type="text" className="form-control" placeholder="Search…"
                  value={inputQ} onChange={e => setInputQ(e.target.value)} />
                <button className="btn" type="submit"
                  style={{backgroundColor:ACCENT,color:'#fff',border:'none'}}>🔍</button>
              </div>
            </form>
            <div className="card border-0 shadow-sm">
              <div className="card-body p-2">
                <p className="fw-semibold mb-2 text-uppercase" style={{fontSize:'0.72rem',color:'#888',letterSpacing:'0.05em'}}>Category</p>
                <button className="btn btn-sm w-100 text-start mb-1" onClick={() => setParam('category','')}
                  style={{backgroundColor:!category?ACCENT:'#f8f9fa',color:!category?'#fff':'#333',border:'none',fontSize:'0.78rem'}}>
                  All datasets <span className="float-end text-muted" style={{fontSize:'0.7rem'}}>{total.toLocaleString()}</span>
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat} className="btn btn-sm w-100 text-start mb-1" onClick={() => setParam('category', cat)}
                    style={{
                      backgroundColor: category===cat ? ACCENT : CAT_COLORS[cat],
                      color: category===cat?'#fff':'#333',
                      border:`1px solid ${category===cat?ACCENT:'#ddd'}`,
                      fontSize:'0.74rem', lineHeight:1.4,
                    }}>
                    {CAT_ICONS[cat]} {cat}
                    <span className="float-end" style={{fontSize:'0.68rem',opacity:0.8}}>{counts[cat]!=null?counts[cat].toLocaleString():''}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="col-12 col-md-9 col-xl-10">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border" style={{color:ACCENT}} role="status"/>
                <p className="mt-2 text-muted">Loading…</p>
              </div>
            ) : results.length === 0 ? (
              <div className="alert alert-info">No datasets found.</div>
            ) : (
              <>
                <div className="row g-2">
                  {results.map(ds => {
                    const cat = getcat(ds.keywords||[]);
                    return (
                      <div key={ds.identifier} className="col-12 col-lg-6 col-xl-4">
                        <div className="card h-100 border-0 shadow-sm"
                          style={{backgroundColor:cat?CAT_COLORS[cat]:'#f9f9f9',borderLeft:`3px solid ${ACCENT}`,cursor:'pointer'}}
                          onClick={() => navigate(`/fairness-info?dataset_id=${ds.identifier}`)}
                          onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.12)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'}>
                          <div className="card-body py-2 px-3">
                            <div className="d-flex align-items-start gap-2 mb-1">
                              <span style={{fontSize:'1rem',flexShrink:0,marginTop:'2px'}}>{cat?CAT_ICONS[cat]:'📦'}</span>
                              <div className="flex-grow-1 overflow-hidden">
                                <p className="fw-semibold mb-0 text-truncate" style={{fontSize:'0.84rem'}} title={ds.title}>{ds.title}</p>
                                <p className="text-muted mb-0" style={{fontSize:'0.71rem'}}>{ds.identifier}</p>
                              </div>
                            </div>
                            {ds.description?.en && (
                              <p className="text-muted mb-1" style={{
                                fontSize:'0.73rem',lineHeight:1.4,
                                display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'
                              }}>{ds.description.en}</p>
                            )}
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-1">
                              {cat && <span className="badge rounded-pill" style={{backgroundColor:ACCENT,color:'#fff',fontSize:'0.62rem',fontWeight:400}}>{cat}</span>}
                              <div className="d-flex gap-2 ms-auto">
                                {ds.triples && <span style={{fontSize:'0.67rem',color:'#999'}}>{Number(ds.triples).toLocaleString()} triples</span>}
                                {ds.website && (
                                  <a href={ds.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                                    style={{fontSize:'0.67rem',color:ACCENT}}>site ↗</a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="d-flex justify-content-center mt-4">
                    <ul className="pagination flex-wrap mb-0">
                      {page > 1 && <li className="page-item"><button className="page-link" onClick={()=>setPage(page-1)} style={{color:ACCENT}}>‹</button></li>}
                      {pageStart > 1 && <>
                        <li className="page-item"><button className="page-link" onClick={()=>setPage(1)} style={{color:ACCENT}}>1</button></li>
                        {pageStart > 2 && <li className="page-item disabled"><span className="page-link">…</span></li>}
                      </>}
                      {pageNums.map(p => (
                        <li key={p} className={`page-item${p===page?' active':''}`}>
                          <button className="page-link" onClick={()=>setPage(p)}
                            style={p===page?{backgroundColor:ACCENT,borderColor:ACCENT,color:'#fff'}:{color:ACCENT}}>{p}</button>
                        </li>
                      ))}
                      {pageEnd < totalPages && <>
                        {pageEnd < totalPages-1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
                        <li className="page-item"><button className="page-link" onClick={()=>setPage(totalPages)} style={{color:ACCENT}}>{totalPages}</button></li>
                      </>}
                      {page < totalPages && <li className="page-item"><button className="page-link" onClick={()=>setPage(page+1)} style={{color:ACCENT}}>›</button></li>}
                    </ul>
                  </nav>
                )}
                <p className="text-center text-muted mt-2" style={{fontSize:'0.77rem'}}>
                  Page {page} of {totalPages} · {total.toLocaleString()} datasets
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
