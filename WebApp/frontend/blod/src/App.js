import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Cloud from './pages/cloud';
import FairnessInfo from './pages/fairness_info';
import 'bootstrap/dist/css/bootstrap.min.css';
import AddDataset from './pages/add_dataset';
import Search from './pages/search';
import Dashboard from './pages/dashboard';
import About from './pages/about';
import Sparql from './pages/sparql';
import Datasets from './pages/datasets';

function App() {
  return (
    <Router basename='/'>
      <Routes>
        <Route path='/fairness-info' element={<FairnessInfo />} />
        <Route path='/add-dataset' element={<AddDataset />} />
        <Route path='/search' element={<Search />} />
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/about' element={<About />} />
        <Route path='/sparql' element={<Sparql />} />
        <Route path='/datasets' element={<Datasets />} />
        <Route path='/' element={<Cloud />} />
        <Route path='*' element={<Cloud />} />
      </Routes>
    </Router>
  );
}

export default App;
