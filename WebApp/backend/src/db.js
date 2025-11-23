// db.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

let dbInstance = null;
let clientInstance = null;

async function connectToMongoDB() {
  if (!dbInstance) {
    try {
      console.log('🔗 Connecting to MongoDB:', process.env.MONGO_URI);

      const client = new MongoClient(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,

      });

      await client.connect();

      // Test the connection
      await client.db().admin().ping();
      console.log('✅ MongoDB connected successfully');

      clientInstance = client;
      dbInstance = client.db(process.env.DB_NAME);

    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);

      // Fallback: Create a mock database connection
      console.log('⚠️ Using mock database connection');
      dbInstance = {
        collection: (name) => ({
          find: (query = {}) => ({
            toArray: () => {
              console.log(`📊 Mock: Finding documents in ${name}`);
              return Promise.resolve([]);
            }
          }),
          findOne: (query = {}) => {
            console.log(`📊 Mock: Finding one document in ${name}`);
            return Promise.resolve(null);
          },
          countDocuments: (query = {}) => {
            console.log(`📊 Mock: Counting documents in ${name}`);
            return Promise.resolve(0);
          }
        })
      };
    }
  }
  return dbInstance;
}

module.exports = { connectToMongoDB };