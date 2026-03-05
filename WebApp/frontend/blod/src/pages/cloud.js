import Graph from "../components/Graph";
import { base_url } from '../api';
//base_url='http://localhost:5000'
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGithub } from 'react-icons/fa';
//const API_BASE_URL = 'http://localhost:5005'; // Adjust based on your backend
// Mock data fallback for when API is unavailable
const mockGraphData = {
  nodes: [
    { id: 1, title: "Europeana", category: "Tangible", url: "https://www.europeana.eu" },
    { id: 2, title: "DBpedia", category: "Generic", url: "http://dbpedia.org" },
    { id: 3, title: "Wikidata", category: "Generic", url: "https://www.wikidata.org" },
    { id: 4, title: "Digital Public Library of America", category: "Tangible", url: "https://dp.la" },
    { id: 5, title: "British Museum", category: "Tangible", url: "https://www.britishmuseum.org" },
    { id: 6, title: "Library of Congress", category: "Tangible", url: "https://www.loc.gov" },
    { id: 7, title: "Cultural Heritage API", category: "Intangible", url: "#" },
    { id: 8, title: "Art Research Database", category: "Intangible", url: "#" }
  ],
  links: [
    { source: 1, target: 2 },
    { source: 1, target: 3 },
    { source: 2, target: 4 },
    { source: 3, target: 5 },
    { source: 4, target: 6 },
    { source: 5, target: 7 },
    { source: 6, target: 8 },
    { source: 7, target: 8 }
  ]
};


function Cloud(){
    const [data, setData] = useState({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usingMockData, setUsingMockData] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetchGraphData();
    }, []);

    // Add this function to your Cloud.js
const transformDataForGraph = (apiData) => {
    if (!apiData || !apiData.nodes || !apiData.links) {
        console.error('Invalid API data structure:', apiData);
        return { nodes: [], links: [] };
    }

    // Transform nodes to match Graph.js expectations
    const transformedNodes = apiData.nodes.map((node, index) => {
        // Ensure each node has the required properties
        return {
            id: node.id || index + 1, // Use existing id or create numeric one
            title: node.title || `Node ${index + 1}`,
            category: node.category || 'Generic',
            url: node.url || '#',
            // Preserve any additional properties
            ...node
        };
    });

    // Transform links to ensure source/target are properly formatted
    const transformedLinks = apiData.links.map((link, index) => {
        // Ensure source and target are properly referenced
        return {
            source: link.source || null,
            target: link.target || null,
            // Preserve any additional properties
            ...link
        };
    }).filter(link => link.source && link.target); // Remove invalid links

    console.log('Transformed data:', {
        nodes: transformedNodes.length,
        links: transformedLinks.length,
        sampleNode: transformedNodes[0],
        sampleLink: transformedLinks[0]
    });

    return {
        nodes: transformedNodes,
        links: transformedLinks
    };
};

// Update your fetch function to use the transformer
const fetchGraphData = async () => {
    try {
        // ADD THESE DEBUG LINES:
        console.log('=== DEBUG CLOUD.JS ===');
        console.log('base_url:', base_url);
        console.log('Full API URL:', `${base_url}/blod/all_ch_links`);
        console.log('=====================');

        const response = await fetch(`${base_url}/blod/all_ch_links`);

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }

        const apiData = await response.json();
        console.log('API data received:', apiData);

        // Transform the data for the graph
        const transformedData = transformDataForGraph(apiData);

        setData(transformedData);
        setUsingMockData(false);
        setError(null);
        console.log('API data loaded and transformed successfully');

    } catch (error) {
        console.warn('API fetch failed, using mock data:', error.message);
        setData(mockGraphData);
        setUsingMockData(true);
        setError(error.message);
    } finally {
        setLoading(false);
    }
};

    const handleInsertResource = () => {
        navigate('/add-dataset');
    }

    const handleSearch = () => {
        navigate('/search');
    }

    const handleDash = () => {
        navigate('/dashboard')
    }

    const handleAbout = () => {
        navigate('/about')
    }

    const handleRetry = () => {
        fetchGraphData();
    }

    return (
        <div>
            {/* Status Banner */}
            {usingMockData && (
                <div style={{
                    background: '#fff3cd',
                    padding: '10px 20px',
                    textAlign: 'center',
                    borderBottom: '1px solid #ffeaa7',
                    color: '#856404',
                    fontSize: '14px',
                    fontWeight: 'bold'
                }}>
                    ⚠️ Displaying Sample Data (Backend Server Unavailable)
                    <button
                        onClick={handleRetry}
                        style={{
                            marginLeft: '15px',
                            padding: '2px 10px',
                            backgroundColor: '#856404',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Retry Connection
                    </button>
                </div>
            )}

            {error && !usingMockData && (
                <div style={{
                    background: '#f8d7da',
                    padding: '10px 20px',
                    textAlign: 'center',
                    borderBottom: '1px solid #f5c6cb',
                    color: '#721c24',
                    fontSize: '14px'
                }}>
                    ❌ Error: {error}
                </div>
            )}

            {/* GitHub and FAIR buttons */}
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                display: 'flex',
                gap: '1rem',
                zIndex: 1000
            }}>
                <button
                    onClick={() => window.open('https://github.com/sanalatif0806/BLOD', '_blank')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 1rem',
                        fontSize: '0.9rem',
                        backgroundColor: '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
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
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    zIndex: 1000,
                    background: 'rgba(255,255,255,0.9)',
                    padding: '20px',
                    borderRadius: '10px'
                }}>
                    <div style={{ fontSize: '18px', marginBottom: '10px' }}>Loading Health  Data...</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Connecting to backend server</div>
                </div>
            )}

            <h1 style={{
                textAlign: 'center',
                fontSize: '3rem',
                margin: '1rem 0',
                color: '#141414',
                fontFamily: 'Segoe UI, sans-serif',
                letterSpacing: '1px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                animation: 'fadeIn 1s ease-in-out'
            }}>
            BLOD
            <img
                    src="/favicon.png"
                    alt="Cloud Logo"
                    style={{ height: "50px", width: "50px", marginLeft: "20px", marginBottom: "2px" }}
            />
            </h1>
            <h3 style={{
                textAlign: 'center',
                fontSize: '2.3rem',
                margin: '1rem 0',
                color: '#141414',
                fontFamily: 'Segoe UI, sans-serif',
                letterSpacing: '1px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                animation: 'fadeIn 1s ease-in-out'
            }}>
                The Health Linked Open Data (sub)cloud
            </h3>

            {/* Navigation Buttons */}
            <div style={{ textAlign: 'left', marginBottom: '1.5rem', marginLeft: '2rem' }}>
                <button
                    onClick={handleSearch}
                    style={{
                        padding: '0.5rem 1.3rem',
                        marginRight: '1rem',
                        fontSize: '1rem',
                        backgroundColor: '#8da89f',
                        color: '#141414',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#7b978c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#8da89f'}
                >
                    Search
                </button>

                <button
                    onClick={handleDash}
                    style={{
                        padding: '0.5rem 1.3rem',
                        marginRight: '1rem',
                        fontSize: '1rem',
                        backgroundColor: '#8da89f',
                        color: '#141414',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#7b978c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#8da89f'}
                >
                    Dashboard
                </button>

                <button
                    onClick={handleInsertResource}
                    style={{
                        padding: '0.5rem 1.3rem',
                        fontSize: '1rem',
                        backgroundColor: '#8da89f',
                        marginRight: '1rem',
                        color: '#141414',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#7b978c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#8da89f'}
                >
                    Ask to insert a new dataset
                </button>

                <button
                    onClick={handleAbout}
                    style={{
                        padding: '0.5rem 1.3rem',
                        marginRight: '1rem',
                        fontSize: '1rem',
                        backgroundColor: '#8da89f',
                        color: '#141414',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'background-color 0.3s ease'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#7b978c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#8da89f'}
                >
                    About
                </button>
            </div>

            {/* Graph Component */}
            <Graph data={data}/>
        </div>
    )
}

export default Cloud;