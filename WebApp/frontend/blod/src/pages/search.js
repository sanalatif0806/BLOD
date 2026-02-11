import { useState } from 'react';
import axios from 'axios';
import { base_url } from '../api';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/footer';
import Navbar from '../components/navbar';

function Search() {
  const [name, setName] = useState('');
  const [fields, setFields] = useState({
    title: true,
    description: false,
    identifier: false,
    keywords: false
  });
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  const fetchData = async (nameQuery, pageQuery = 1) => {
    let selectedFieldArray = Object.keys(fields).filter(f => fields[f]);
    let queryFields;
    if (selectedFieldArray.length === 0 && name.trim() === '') {
      queryFields = ['title', 'description', 'identifier', 'keywords'].join(',');
    } else if (selectedFieldArray.length === 0) {
      queryFields = 'title';
    } else {
      queryFields = selectedFieldArray.join(',');
    }
    try {
      const res = await axios.get(`${base_url}/BLOD/search`, {
        params: {
          q: nameQuery,
          fields: queryFields,
          page: pageQuery,
          limit: 10
        }
      });
      setResults(res.data.results);
      setTotalPages(res.data.totalPages);
      setPage(res.data.page);
      setHasSearched(true);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchData(name, 1);
  };

  const handlePageChange = (newPage) => {
    fetchData(name, newPage);
  };

  const handleCheckboxChange = (field) => {
    setFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const generateDatasetLink = (id) => `/fairness-info?dataset_id=${id}`;

  // **Pagination window**
  const getVisiblePages = () => {
    const delta = 2; // pages before and after current
    let start = Math.max(1, page - delta);
    let end = Math.min(totalPages, page + delta);
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <>
      <div className="container-fluid mt-3 px-4">
        <Navbar />
      </div>

      <div className="container mt-3 pb-1 min-vh-100">
        <h3 className="mb-4 mt-4">Search into the BLOD CLOUD</h3>

        <form className="mb-4" onSubmit={handleSearch}>
          <div className="d-flex mb-2">
            <input
              type="text"
              className="form-control me-2"
              placeholder="Search term"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ backgroundColor: '#8da89f', border: 'none' }}
            >
              Search
            </button>
          </div>

          <div className="mb-3 d-flex flex-wrap">
            {['title', 'description', 'identifier', 'keywords'].map((f) => (
              <label key={f} className="form-check me-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={fields[f]}
                  onChange={() => handleCheckboxChange(f)}
                />
                {f === 'identifier' ? 'ID' : f.charAt(0).toUpperCase() + f.slice(1)}
              </label>
            ))}
          </div>
        </form>

        {results.length > 0 ? (
          <>
            <ul className="list-group mb-3">
              {results.map((item) => (
                <a
                  key={item.identifier}
                  href={generateDatasetLink(item.identifier)}
                  className="list-group-item list-group-item-action"
                  target="_blank"
                  rel="noreferrer"
                >
                  <strong>{item.title}</strong><br />
                  <small className="text-muted">ID: {item.identifier}</small>
                </a>
              ))}
            </ul>

            {/* Responsive Pagination */}
            <nav>
              <ul className="pagination mb-5 justify-content-center flex-wrap">
                {page > 1 && (
                  <li className="page-item">
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page - 1)}
                      style={{
                        backgroundColor: '#8da89f',
                        color: '#fff',
                        borderColor: '#8da89f',
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      &laquo;
                    </button>
                  </li>
                )}

                {getVisiblePages().map((p) => (
                  <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(p)}
                      disabled={p === page}
                      style={{
                        backgroundColor: p === page ? '#8da89f' : '#ffffff',
                        color: p === page ? '#fff' : '#000',
                        borderColor: '#8da89f',
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      {p}
                    </button>
                  </li>
                ))}

                {page < totalPages && (
                  <li className="page-item">
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(page + 1)}
                      style={{
                        backgroundColor: '#8da89f',
                        color: '#fff',
                        borderColor: '#8da89f',
                        transition: 'background-color 0.3s ease'
                      }}
                    >
                      &raquo;
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </>
        ) : (
          hasSearched && (
            <div className="alert alert-info">No results found.</div>
          )
        )}
      </div>

      <Footer />
    </>
  );
}

export default Search;