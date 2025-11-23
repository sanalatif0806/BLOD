import React from 'react';
import { Navbar, Container, Nav, Offcanvas } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa';

function NavBar() {
  return (
    <Navbar bg="light" expand="md" className="mb-4 shadow-sm">
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className="fw-bold fs-4" style={{color:"#3380af"}}>
          CHeCLOUD
        </Navbar.Brand>
        <Link to="/">
          <img
            src="/favicon.png"
            alt="Cloud Logo"
            style={{ height: "40px", width: "40px", marginRight: "7px" }}
          />
        </Link>
        <Navbar.Toggle aria-controls="offcanvas-navbar" />
        <Navbar.Offcanvas
          id="offcanvas-navbar"
          aria-labelledby="offcanvas-navbar-label"
          placement="start"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title id="offcanvas-navbar-label">
              Menu
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Nav className="me-auto"> {/* horizontal on desktop */}
              <Nav.Link as={Link} to="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/search">Search</Nav.Link>
              <Nav.Link as={Link} to="/add-dataset">Add a Dataset</Nav.Link>
              <Nav.Link as={Link} to="/dashboard">Dashboard</Nav.Link>
              <Nav.Link as={Link} to="/about">About</Nav.Link>
            </Nav>
                            <button
                    onClick={() => window.open('https://github.com/GabrieleT0/CHe-CLOUD', '_blank')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 1rem',
                        fontSize: '0.9rem',
                        backgroundColor: '#333',
                        color: '#fff',
                        border: 'none',
                        marginBottom: '10px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease',
                        marginRight: '10px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#24292e'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#333'}
                >
                    <FaGithub size={18} />
                    GitHub
                </button>
                <button
                    onClick={() => window.open('https://gabrielet0.github.io/CHe-CLOUD/fair_mapping.html', '_blank')}
                    style={{
                        padding: '0.4rem 1rem',
                        fontSize: '0.9rem',
                        backgroundColor: '#4a90e2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#3a7dc1'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#4a90e2'}
                >
                    FAIR principles calculation
                </button>
          </Offcanvas.Body>
        </Navbar.Offcanvas>
      </Container>
    </Navbar>
  );
}

export default NavBar;
