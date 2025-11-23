const { connectToMongoDB } = require('../db');

// models/CHe_cloud_data.js
async function getAllIdsAndLinks() {
    try {
        const db = await connectToMongoDB();
        const collection = db.collection('BLOD');

        const items = await collection.find({}, {
            projection: {
                identifier: 1,
                title: 1,
                keywords: 1,
                links: 1
            }
        }).toArray();

        return items;
    } catch (error) {
        console.error('Error in getAllIdsAndLinks:', error);
        throw error;
    }
}

async function getAllJsonDataByID(dataset_id) {
    try {
        const db = await connectToMongoDB();
        const collection = db.collection('BLOD');

        const data = await collection.findOne({ identifier: dataset_id });
        return data;
    } catch (error) {
        console.error("Error during data recovering:", error);
        throw error;
    }
}

async function getAllJsonData() {
    try {
        const db = await connectToMongoDB();
        const collection = db.collection('BLOD');

        const data = await collection.find({}).toArray();;
        return data;
    } catch (error) {
        console.error("Error during data recovering:", error);
        throw error;
    }
}

async function getCollection() {
    const db = await connectToMongoDB();
    const collection = db.collection('BLOD');
    
    return collection
}

module.exports = { getAllIdsAndLinks, getAllJsonData, getAllJsonDataByID, getCollection};