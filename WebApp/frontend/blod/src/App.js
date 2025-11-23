import logo from './logo.svg';
import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes, Link} from 'react-router-dom';
import Cloud from './pages/cloud';
import FairnessInfo from './pages/fairness_info';
import 'bootstrap/dist/css/bootstrap.min.css';
import AddDataset from './pages/add_dataset';
import Search from './pages/search';
import Dashboard from './pages/dashboard';
import About from './pages/about';
//import ReactGA from 'react-ga4'
//const GA_ID = process.env.REACT_APP_GA_ID

function App() {
 // ReactGA.initialize(GA_ID);
  
 // useEffect(() => {
 //   ReactGA.send({ hitType: "pageview", page: window.location.pathname });
 // }, []);
  
  return (
      <Router basename='/'>
        <Routes>
          <Route basename={'/'} path='*' element={<Cloud />} /> 
          <Route basename={'/'} path='/fairness-info' element={<FairnessInfo />} />
          <Route basename={'/'} path='/add-dataset' element={<AddDataset />} />
          <Route basename={'/'} path='/search' element={<Search />} />
          <Route basename={'/'} path='/dashboard' element={<Dashboard />} />
          <Route basename={'/'} path='/about' element={<About />} />
        </Routes>
      </Router>
  );
}


export default App;
