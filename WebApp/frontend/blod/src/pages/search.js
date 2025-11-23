import { useState } from 'react';
import axios from 'axios';
import { base_url } from '../api';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/footer';
import { Link } from 'react-router-dom';

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
      // Search all fields when nothing selected and search is empty
      queryFields = ['title', 'description', 'identifier', 'keywords'].join(',');
    } else if (selectedFieldArray.length === 0) {
      // Fallback to 'title' if nothing selected and query is present
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

  const handleCheCloud = () => {
    navigate('/');
  };

  const generateDatasetLink = (id) => `/fairness-info?dataset_id=${id}`;

  return (
    <>
          <div className="container-fluid mt-3 px-4">
            <div className="d-flex justify-content-start gap-2 mb-3">
                <Link to="/" className="fw-bold fs-4 text-decoration-none" style={{color: '#8da89f'}}>BLOD</Link>
                <Link to="/" className="d-flex align-items-center">
                <img 
                    src="/favicon.png" 
                    alt="Cloud Logo" 
                    style={{ height: "40px", width: "40px", marginRight: "7px" }} 
                />
                </Link>
                <Link to="/search" className="btn btn-outline-success">Search</Link>
                <Link to="/add-dataset" className="btn btn-outline-success">Add a Dataset</Link>
                <Link to="/dashboard" className="btn btn-outline-success">Dashboard</Link>
                <Link to="/about" className="btn btn-outline-success">About</Link>
          </div>
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
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#8da89f', border: 'none' }}>
              Search
            </button>
          </div>

          <div className="mb-3 d-flex flex-wrap">
            <label className="form-check me-3">
              <input type="checkbox" className="form-check-input" checked={fields.title} onChange={() => handleCheckboxChange('title')} />
              Title
            </label>
            <label className="form-check me-3">
              <input type="checkbox" className="form-check-input" checked={fields.description} onChange={() => handleCheckboxChange('description')} />
              Description
            </label>
            <label className="form-check me-3">
              <input type="checkbox" className="form-check-input" checked={fields.identifier} onChange={() => handleCheckboxChange('identifier')} />
              ID
            </label>
            <label className="form-check">
              <input type="checkbox" className="form-check-input" checked={fields.keywords} onChange={() => handleCheckboxChange('keywords')} />
              Keywords
            </label>
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

            <nav>
              <ul className="pagination mb-5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => handlePageChange(p)} disabled={p === page}           
                      style={{
                        backgroundColor: p === page ? '#8da89f' : '#ffffff',
                        color: p === page ? '#fff' : '#000',
                        borderColor: '#8da89f',
                        transition: 'background-color 0.3s ease'
                      }}>
                      {p}
                    </button>
                  </li>
                ))}
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