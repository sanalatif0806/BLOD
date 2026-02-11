const router = require('express').Router();
const { response } = require('express');
const { getAllIdsAndLinks, getAllJsonDataByID, getAllJsonData, getCollection } = require('../models/BLOD');
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const path = require('path');

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const fairness_page = 'fairness-info';
const kgheartbeatUrl = process.env.KGHEARTBEAT_API

const keyMapping = {
  f1M: 'F1-M Unique and persistent ID',
  f1D: 'F1-D URIs dereferenceability',
  f2aM: 'F2a-M - Metadata availability via standard primary sources',
  f2bM: 'F2b-M Metadata availability for all the attributes covered in the FAIR score computation',
  f3M: 'F3-M Data referrable via a DOI',
  f4M: 'F4-M Metadata registered in a searchable engine',
  f_score: 'F score',
  a1D: 'A1-D Working access point(s)',
  a1M: 'A1-M Metadata availability via working primary sources',
  a1_2: 'A1.2 Authentication & HTTPS support',
  a2M: 'A2-M Registered in search engines',
  a_score: 'A score',
  r1_1: 'R1.1 Machine- or human-readable license retrievable via any primary source',
  r1_2: 'R1.2 Publisher information, such as authors, contributors, publishers, and sources',
  r1_3D: 'R1.3-D Data organized in a standardized way',
  r1_3M: 'R1.3-M Metadata are described with VoID/DCAT predicates',
  r_score: 'R score',
  i1D: 'I1-D Standard & open representation format',
  i1M: 'I1-M Metadata are described with VoID/DCAT predicates',
  i2: 'I2 Use of FAIR vocabularies',
  i3D: 'I3-D Degree of connection',
  i_score: 'I score',
  fair_score: 'FAIR score',
  analysis_date: 'analysis_date'
};


// routes/CHe_cloud_data.js - Update the /all_ch_links route
router.get('/all_ch_links', async (req, res) => {
    try {
        console.log('📊 Fetching all Health links data from healthcloud database');

        let items = [];
        try {
            // Try to get data from MongoDB
            items = await getAllIdsAndLinks();
            console.log(`✅ Found ${items.length} items in healthcloud database`);
        } catch (dbError) {
            console.log('⚠️ Database error, using mock data:', dbError.message);
            // Fall through to use mock data
        }

        // If no items from DB, use mock data
        if (!items || items.length === 0) {
            console.log('📋 Using mock data - no items found in healthcloud database');
            const mockResponse = {
                nodes: [
                    { id: 1, title: "Europeana", category: "Tangible", url: "https://www.europeana.eu" },
                    { id: 2, title: "DBpedia", category: "Generic", url: "http://dbpedia.org" },
                    { id: 3, title: "Wikidata", category: "Generic", url: "https://www.wikidata.org" },
                    { id: 4, title: "Digital Public Library of America", category: "Tangible", url: "https://dp.la" },
                    { id: 5, title: "British Museum", category: "Tangible", url: "https://www.britishmuseum.org" }
                ],
                links: [
                    { source: 1, target: 2 },
                    { source: 1, target: 3 },
                    { source: 2, target: 4 },
                    { source: 3, target: 5 }
                ],
                source: "mock-data",
                database: "healthcloud",
                timestamp: new Date().toISOString()
            };
            return res.json(mockResponse);
        }

        // Process real data from healthcloud database
       // "Clinical & Patient Data", "Omics & Molecular Data" ,"Medical Imaging & Signals", "Public Health & Surveillance", "Biobank & Research Data","Behavioral & Social Data","Terminologies & Metadata"
        const allowedKeywords = [ "Clinical & Patient Data", "Omics & Molecular Data" ,"Medical Imaging & Signals", "Public Health & Surveillance", "Biobank & Research Data","Behavioral & Social Data","Terminologies & Metadata"];
        const nodes = items.map(item => {
            let matchedKeyword = item.keywords?.find(kw => allowedKeywords.includes(kw));

            const categoryMap = {
                'Clinical & Patient Data': 'Clinical & Patient Data',
    'Omics & Molecular Data': 'Omics & Molecular Data',
    'Medical Imaging & Signals': 'Medical Imaging & Signals',
    'Public Health & Surveillance': 'Public Health & Surveillance',
   'Biobank & Research Data': 'Biobank & Research Data',
    'Behavioral & Social Data': 'Behavioral & Social Data',
    'Terminologies & Metadata': 'Terminologies & Metadata'
            };

            return {
                "id": item.identifier,
                "title": item.title,
                "url": `${frontendUrl}/${fairness_page}?dataset_id=${item.identifier}`,
                "category": categoryMap[matchedKeyword] || 'Generic'
            };
        });

        const links = [];
        const nodeIds = new Set(nodes.map(node => node.id));

        items.forEach(item => {
            item.links?.forEach(link => {
                if (nodeIds.has(link.target)) {
                    links.push({
                        "source": item.identifier,
                        "target": link.target,
                    });
                }
            });
        });

        const response = {
            "nodes": nodes,
            "links": links,
            "source": "healthcloud",
           // "source": "healthcloud-database",
            "timestamp": new Date().toISOString()
        };

        console.log(`✅ Sending data from healthcloud: ${nodes.length} nodes, ${links.length} links`);
        res.json(response);

    } catch (error) {
        console.error('❌ Error in /all_ch_links:', error);
        res.status(500).json({
            error: "Server error",
            message: error.message,
            database: "healthcloud"
        });
    }
});
router.get('/fairness_data/:id', async (req, res) => {
    try{
        const targetId = req.params.id;
        const response = await fetch(`https://kgheartbeat.di.unisa.it/kgheartbeat-api/fairness/${targetId}`);
        const data = await response.json();
        const mappedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
            keyMapping[key] || key, // fallback to original key if no mapping
            value
            ])
        );

        if (mappedData) {
            return res.json(mappedData);
        } else {
            return res.status(404).json({ message: "Dataset not found" });
        }

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/dataset_metadata/:id', async (req, res) => {
    try{
        const dataset_id = req.params.id;
        const json_data = await getAllJsonDataByID(dataset_id);
        if (json_data){
            res.status(200).json(json_data);
        } else {
            res.status(404).json({ message: "Dataset not found" });
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({ åmessage: "Server error" });
    }
});

router.get('/get_all', async (req, res) => {
    try {
        const items = await getAllJsonData();
        if (!items.length) {
            return res.status(404).json({ message: "No elements founded." });
        }
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

router.get('/search', async (req, res) => {
  const searchTerm = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const allowedFields = ['title', 'description', 'identifier', 'keywords'];

  // Normalize selected fields
  let selectedFields = [];
  const rawFields = req.query.fields;

  if (typeof rawFields === 'string') {
    selectedFields = rawFields.split(',').map(f => f.trim());
  } else if (Array.isArray(rawFields)) {
    selectedFields = rawFields.flatMap(f => f.split(',').map(f => f.trim()));
  }

  // Only keep allowed fields
  selectedFields = selectedFields.filter(f => allowedFields.includes(f));

  // If no fields selected AND no query, search all
  if (selectedFields.length === 0 && searchTerm === '') {
    selectedFields = allowedFields;
  }

  // If fields not selected but there's a search term, fallback to ['title']
  if (selectedFields.length === 0) {
    selectedFields = ['title'];
  }

  try {
    const collection = await getCollection();
    let query = {};

    if (searchTerm && selectedFields.length > 0) {
      query.$or = selectedFields.map(field => {
        if (field === 'description') {
          return { 'description.en': { $regex: searchTerm, $options: 'i' } };
        } else if (field === 'keywords') {
          return { keywords: { $elemMatch: { $regex: searchTerm, $options: 'i' } } };
        } else {
          return { [field]: { $regex: searchTerm, $options: 'i' } };
        }
      });
    }

    const projection = { title: 1, identifier: 1, _id: 0 };

    const [results, total] = await Promise.all([
      collection.find(query, { projection }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query)
    ]);

    res.json({
      results,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;