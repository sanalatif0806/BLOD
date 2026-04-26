/**
 * sync_fairness_scores.js
 *
 * Reads FAIR scores from the bundled CSV and writes them into MongoDB.
 * Uses case-insensitive ID matching (MongoDB has uppercase IDs like "BAO",
 * CSV has lowercase "bao" — without this fix, 944 datasets get no score).
 *
 * Run inside your backend container:
 *   node /app/src/sync_fairness_scores.js
 *
 * Or trigger via HTTP:
 *   curl -X POST http://localhost:5005/BLOD/sync-fairness
 *
 * Fields written to each MongoDB document:
 *   fair_score    – overall FAIR score (0–4 scale)
 *   fair_score_f  – Findable sub-score
 *   fair_score_a  – Accessible sub-score
 *   fair_score_i  – Interoperable sub-score
 *   fair_score_r  – Reusable sub-score
 */

const { connectToMongoDB } = require('./db');
const fs  = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();

const CSV_PATH = path.join(__dirname, '..', 'data', 'fairness-data.csv');

// CSV column → MongoDB field
const COL_MAP = {
  'FAIR score': 'fair_score',
  'F score':    'fair_score_f',
  'A score':    'fair_score_a',
  'I score':    'fair_score_i',
  'R score':    'fair_score_r',
};

function parseScore(val) {
  if (!val || val === '-') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function loadCSV() {
  return new Promise((resolve, reject) => {
    // Key: lowercase ID → scores. Allows case-insensitive lookup.
    const rows = {};
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', row => {
        const id = (row['KG id'] || '').trim().toLowerCase();
        if (!id) return;
        const scores = {};
        for (const [col, field] of Object.entries(COL_MAP)) {
          const val = parseScore(row[col]);
          if (val !== null) scores[field] = val;
        }
        if (Object.keys(scores).length) rows[id] = scores;
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function syncAll() {
  console.log(`Reading scores from: ${CSV_PATH}`);
  const scoreMap = await loadCSV();  // lowercase-keyed
  console.log(`Loaded scores for ${Object.keys(scoreMap).length} datasets from CSV.`);

  const db = await connectToMongoDB();
  const collection = db.collection('BLOD');

  const datasets = await collection
    .find({}, { projection: { identifier: 1 } })
    .toArray();
  console.log(`Found ${datasets.length} documents in MongoDB. Starting sync...`);

  let updated = 0, notFound = 0;

  for (const { identifier } of datasets) {
    // Case-insensitive lookup: "BAO" matches csv key "bao"
    const scores = scoreMap[identifier.toLowerCase()];
    if (!scores) { notFound++; continue; }

    await collection.updateOne(
      { identifier },
      { $set: { ...scores, fair_score_synced_at: new Date() } }
    );
    updated++;
  }

  console.log(`\nSync complete:`);
  console.log(`  Updated      : ${updated}`);
  console.log(`  No CSV match : ${notFound}`);
  process.exit(0);
}

syncAll().catch(err => { console.error('Fatal:', err); process.exit(1); });
