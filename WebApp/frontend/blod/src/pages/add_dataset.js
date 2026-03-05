import React from 'react';
import FormComponent from '../components/add_dataset_form';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/footer';
import { Link } from 'react-router-dom';

const AddDataset = () => {
  const navigate = useNavigate();
  const handleCheCloud = () => {
    navigate('/'); 
}
  return (
    <>
      <div className="container-fluid mt-3 px-4">
        <div className="d-flex justify-content-start gap-2 mb-3">
                <Link to="/" className="fw-bold fs-4 text-decoration-none" style={{color: '#8da89f'}}>BLOD</Link>
                <Link to="/" className="d-flex align-items-center">
                <img 
                    src="favicon.png" 
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
    <div style={{ textAlign: 'left', marginLeft: '3rem', marginTop: '1.5rem', marginBottom: '1.5rem' }}>
  </div>
    <main className="container mt-5">
      <section className="bg-light p-5 rounded shadow-sm">
        <h1 className="mb-4 text-success">  
          Add a New Dataset into the  <span className="fw-bold">BLOD</span>
        </h1>
        <p className="mb-4 text-muted">
          Please fill out the form below to submit a new dataset to the BLOD Cloud (CHe Cloud). This will create a Pull Request in the BLOD GitHub repository, and an operator will check it and merge it if everything is correct.
        </p>
        <p className="mb-4 text-muted"><span className="fw-bold">N.B:</span> If you fill in all the fields, your dataset will have a better chance of having a higher FAIRness score.</p>
        <FormComponent />
      </section>
      <Footer />
    </main>
    </>
  );
};

export default AddDataset;