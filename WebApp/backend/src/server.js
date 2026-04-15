const express = require('express');
const cors = require('cors');
const { connectToMongoDB } = require('./db');
const blodRoutes = require('./routes/BLOD');
const monitoringRoutes = require('./routes/monitoring_requests');
const llmRoutes = require('./routes/llm');
const sparqlRoutes = require('./routes/sparql');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach DB to every request
app.use(async (req, res, next) => {
    try {
        req.db = await connectToMongoDB();
        next();
    } catch (error) {
        console.error('DB middleware error:', error);
        res.status(500).json({ error: 'Error connecting to database' });
    }
});

// Routes
app.use('/BLOD', blodRoutes);
app.use('/monitoring_requests', monitoringRoutes);
app.use('/llm', llmRoutes);
app.use('/sparql', sparqlRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(port, () => {
    console.log('BLOD Backend running on port: ' + port);
});
