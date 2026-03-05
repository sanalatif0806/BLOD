import { Link } from 'react-router-dom';

function About() {
  return (
    <div className="container-fluid mt-3 px-4">
        <div className="d-flex justify-content-start gap-2 mb-4">
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
      <h1>About BLOD</h1>
      <p>
       BLOD is an open-source project aimed at creating the Health Linked Open Data (sub)cloud. For each resource indexed within the cloud it is possible to view its FAIRness and the main information contained in the resource metadata such as: description, license, SPARQL endpoint and Data Dump.
      </p>
        <p>
         The project is developed by Maria Angela Pellegrino and Sana Latif from the University of Salerno.
               </p>
      <h2>Contact Us</h2>
      <p>
        For any inquiries or support, please contact us at <a href="mailto:slatif@unisa.it">slatif@unisa.it</a>
      </p>
    </div>
  );
}

export default About;