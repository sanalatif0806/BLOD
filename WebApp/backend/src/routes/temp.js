const router = require('express').Router();
const { getAllIdsAndLinks, getAllJsonDataByID, getAllJsonData, getCollection } = require('../models/BLOD');
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const path = require('path');
const { parse } = require('json2csv');
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const fairness_page = 'fairness-info';

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

router.get('/all_ch_links', async (req, res) => {
    try {
        const items = await getAllIdsAndLinks();
        const allowedKeywords = ['Clinical & Patient Data', 'Omics & Molecular Data', 'Medical Imaging & Signals', 'Public Health & Surveillance', 'Biobank & Research Data', 'Behavioral & Social Data', 'Terminologies & Metadata'];
        if (!items.length) return res.status(404).json({ message: 'No elements found.' });
        const nodes = items.map(item => {
            const matchedKeyword = item.keywords?.find(kw => allowedKeywords.includes(kw));
            return {
                id: item.identifier,
                title: item.title,
                url: `${frontendUrl}/${fairness_page}?dataset_id=${item.identifier}`,
                category: matchedKeyword || 'Generic'
            };
        });
        const links = [];
        const nodeIds = new Set(nodes.map(n => n.id));
        items.forEach(item => {
            item.links?.filter(l => nodeIds.has(l.target)).forEach(l => {
                links.push({ source: item.identifier, target: l.target });
            });
        });
        res.json({ nodes, links });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/export_csv', async (req, res) => {
    try {
        const items = await getAllJsonData();
        if (!items.length) return res.status(404).json({ message: 'No elements found.' });
        const fields = [
            { label: 'Identifier', value: 'identifier' },
            { label: 'Title', value: 'title' },
            { label: 'Description', value: (row) => row.description?.en || '' },
            { label: 'Keywords', value: (row) => (row.keywords || []).join('; ') },
            { label: 'License', value: 'license' },
            { label: 'DOI', value: 'doi' },
            { label: 'Contact Point', value: (row) => `Name: ${row.contact_point?.name || ''} Email: ${row.contact_point?.email || ''}` },
            { label: 'Website', value: 'website' },
            { label: 'Triples', value: 'triples' },
            { label: 'SPARQL Endpoint', value: (row) => row.sparql_endpoint?.[0]?.access_url || '' },
            { label: 'RDF Dump', value: (row) => row.full_download?.map(i => i.download_url).join(' | ') || '' },
            ...Object.entries(keyMapping).map(([key, label]) => ({ label, value: `fairness.${key}` }))
        ];
        const csv = parse(items, { fields });
        res.setHeader('Content-Disposition', 'attachment; filename="BLOD.csv"');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.status(200).send(csv);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
