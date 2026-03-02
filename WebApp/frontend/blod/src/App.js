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
  return (
      <Router basename='/'>
        <Routes>
          {/* Put all specific routes FIRST */}
          <Route path='/fairness-info' element={<FairnessInfo />} />
          <Route path='/add-dataset' element={<AddDataset />} />
          <Route path='/search' element={<Search />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/about' element={<About />} />

          {/* Put the root path SECOND */}
          <Route path='/' element={<Cloud />} />

          {/* Put catch-all LAST (this will only match if no other routes match) */}
          <Route path='*' element={<Cloud />} />
        </Routes>
      </Router>
  );
}


export default App;
