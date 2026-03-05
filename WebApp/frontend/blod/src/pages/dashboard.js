import React, { useEffect, useState } from 'react';
import { dahboard_backend_url } from '../api';
import { Row, Col } from 'react-bootstrap';
import PieChart from '../components/pie_chart';
import axios, { all } from 'axios';
import { Link } from 'react-router-dom';
import BoxPlot from '../components/boxplot';
import DonutChart from '../components/donut_chart';
import MinimalTable from '../components/minimal_table';
import { renderValueAsLink } from '../utils';
import MaterialTable from '../components/material_table';
import Footer from '../components/footer';

function Dashboard() {
    const [sparql_data, setSparqlData] = useState({});
    const [rdf_dump_data, setRdfDumpData] = useState({});
    const [license_data, setLicenseData] = useState({});
    const [mediatype_data, setMediaTypeData] = useState({});
    const [fair_stats_data, setFairStatsData] = useState({});
    const [only_fair_stats, setOnlyFairStats] = useState({});
    const [datasets_stats, setDatasetsStats] = useState({});
    const [datasets_ontologies, setDatasetsOntologies] = useState({});
    const [license_table, setLicenseTable] = useState(false);
    const [sparql_table, setSparqlTable] = useState(false);
    const [rdf_table, setRdfTable] = useState(false);
    const [media_table, setMediaTable] = useState(false);
    const [vocab_data, setVocabData] = useState(false);
    const [vocab_table, setVocabTable] = useState(false);
    const [all_fair_score, setAllFairScore] = useState(false);
    const [all_single_fair_score, setAllSingleFairScore] = useState(false);
    const [single_fair_tab, setSingleFairTab] = useState(false);


    useEffect(() => {
        async function fetchData() {
            try {
                const [
                    sparqlRes,
                    rdfRes,
                    statsRes,
                    fairRes,
                    licenseRes,
                    mediaRes,
                    vocabRes,
                    allSingleFairScoreRes
                ] = await Promise.all([
                    axios.get(`${dahboard_backend_url}/sparql_endpoint`),
                    axios.get(`${dahboard_backend_url}/rdf_dump`),
                    axios.get(`${dahboard_backend_url}/datasets_stats`),
                    axios.get(`${dahboard_backend_url}/fair_stats`),
                    axios.get(`${dahboard_backend_url}/license`),
                    axios.get(`${dahboard_backend_url}/media_type`),
                    axios.get(`${dahboard_backend_url}/vocabularies_used`),
                    axios.get(`${dahboard_backend_url}/all_single_fair_score`)
                ]);

                setSparqlData(sparqlRes.data);
                setRdfDumpData(rdfRes.data);
                setDatasetsOntologies({
                    datasets: statsRes.data.datasets,
                    ontologies: statsRes.data.ontologies,
                });
                delete statsRes.data.datasets
                delete statsRes.data.ontologies
                setDatasetsStats(statsRes.data);
                const fairOnly = { 'FAIR score': fairRes.data['FAIR score'] };
                delete fairRes.data['FAIR score'];
                setOnlyFairStats(fairOnly);
                setFairStatsData(fairRes.data);

                setLicenseData(licenseRes.data);
                setMediaTypeData(mediaRes.data);
                setVocabData(vocabRes.data);
                setAllSingleFairScore(allSingleFairScoreRes.data);
            } catch (error) {
                console.error("Data fetch error:", error);
            }
        }

        fetchData();
    }, []);

    useEffect(() => {
        if (license_data) {
            const data = Object.entries(license_data).filter(([k]) => k !== 'False').map(([key, value]) => ({
                license: renderValueAsLink(key),
                count: value
            }));
            setLicenseTable(<MaterialTable columns_value={[
                { accessorKey: 'license', header: 'Machine-Readable License', size: 50 },
                { accessorKey: 'count', header: 'Count', size: 5 }
            ]} data_table={data} />);
        }

        if (sparql_data) {
            const data = Object.entries(sparql_data).filter(([k]) => k !== 'False').map(([key, value]) => {
                let label = key;
                if (key === '-') label = 'Not indicated';
                else if (key === 'offline') label = 'Offline';
                else if (key === 'Available') label = 'Online';
                else if (key === 'Restricted access to the endpoint') label = 'Access protected';
                return { sparql: label, count: value };
            });

            setSparqlTable(<MinimalTable columns_value={[
                { accessorKey: 'sparql', header: 'SPARQL Endpoint Status', size: 50 },
                { accessorKey: 'count', header: 'Count', size: 5 }
            ]} data_table={data} />);
        }

        if (rdf_dump_data) {
            const data = Object.entries(rdf_dump_data).filter(([k]) => k !== 'False').map(([key, value]) => {
                let label = key;
                if (key === '1') label = 'Online';
                else if (key === '0') label = 'Offline';
                else if (key === '-1') label = 'Not indicated';
                return { rdf: label, count: value };
            });

            setRdfTable(<MinimalTable columns_value={[
                { accessorKey: 'rdf', header: 'RDF Dump Status', size: 50 },
                { accessorKey: 'count', header: 'Count', size: 5 }
            ]} data_table={data} />);
        }

        if(all_single_fair_score){
            const data = all_single_fair_score.map(item => ({
                count: (
                <a
                href={`./fairness-info?dataset_id=${item['KG id']}`}
                target="_blank"   
                rel="noopener noreferrer"
                style={{ color: '#1976d2', textDecoration: 'none' }}
                >
                {item['KG name']}
                </a>
            ),
                fair: parseFloat(item['FAIR score']),
                f: parseFloat(item['F score']),
                a: parseFloat(item['A score']),
                i: parseFloat(item['I score']),
                r: parseFloat(item['R score']),

            }));
            setSingleFairTab(<MaterialTable columns_value={[
                { accessorKey: 'count', header: 'Dataset Name', size: 50 },
                { accessorKey: 'fair', header: 'FAIR score', size: 5 },
                { accessorKey: 'f', header: 'F score', size: 5 },
                { accessorKey: 'a', header: 'A score', size: 5 },
                { accessorKey: 'i', header: 'I score', size: 5 },
                { accessorKey: 'r', header: 'R score', size: 5 }
            ]} data_table={data} />);
        }
        if (mediatype_data) {
            const data = Object.entries(mediatype_data).filter(([k]) => k !== 'False').map(([key, value]) => ({
                media: key,
                count: value
            }));

            setMediaTable(<MaterialTable columns_value={[
                { accessorKey: 'media', header: 'Media Type', size: 50 },
                { accessorKey: 'count', header: 'Count', size: 5 }
            ]} data_table={data} />);
        }

        if(vocab_data){
            const data = Object.entries(vocab_data).filter(([k]) => k !== 'False').map(([key, value]) => ({
                ontology: renderValueAsLink(key),
                count: value
            }));
            setVocabTable(<MaterialTable columns_value={[
                { accessorKey: 'ontology', header: 'Ontology', size: 50 },
                { accessorKey: 'count', header: 'Count', size: 5 }
            ]} data_table={data} />);
        }
    }, [license_data, sparql_data, rdf_dump_data, mediatype_data, vocab_data]);

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

            <div className="card shadow p-4 mb-5 bg-light">
                <Row className="gy-4">
                    <Col md={4}>
                        <div className="card h-100 shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">Resources in the BLOD</h6>
                            <DonutChart categories={Object.keys(datasets_ontologies)} seriesData={Object.values(datasets_ontologies)} height={200} />
                        </div>
                    </Col>
                    <Col md={5}>
                        <div className="card h-100 shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">Datasets by Health Subcategory</h6>
                            <PieChart categories={Object.keys(datasets_stats)} seriesData={Object.values(datasets_stats)} height={200} />
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">SPARQL Endpoints</h6>
                            {sparql_table}
                        </div>
                    </Col>
                </Row>

                <hr className="my-5" />

                <Row className="gy-4">
                    <Col md={4}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">FAIR Score Distribution</h6>
                            <BoxPlot categories={Object.keys(only_fair_stats)} seriesData={only_fair_stats} height={250}/>
                        </div>
                    </Col>
                    <Col md={5}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">F-A-I-R Score Distribution</h6>
                            <BoxPlot seriesData={fair_stats_data} height={250}/>
                        </div>
                    </Col>
                    <Col md={3}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">RDF Dumps</h6>
                            {rdf_table}
                        </div>
                    </Col>
                </Row>

                <hr className="my-5" />

                <Row className="gy-4">
                    <Col md={6}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">Licensing Overview</h6>
                            {license_table}
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">Media Types</h6>
                            {media_table}
                        </div>
                    </Col>
                </Row>

                <hr className="my-5" />
                    <Row className="gy-4">
                        <Col md={8}>
                        <div className="card shadow-sm border-0 p-3 bg-white">
                            <h6 className="text-center fw-bold">(F-A-I-R) score per Dataset</h6>
                            {single_fair_tab}
                        </div>
                        </Col>
                        <Col md={4}>
                            <div className="card shadow-sm border-0 p-3 bg-white">
                                <h6 className="text-center fw-bold">Ontologies used</h6>
                                {vocab_table}
                            </div>
                        </Col>
                    </Row>
                <hr className="my-5" />
            </div>
            <Footer />
        </div>
    );
}

export default Dashboard;