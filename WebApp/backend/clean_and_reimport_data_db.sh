#!/bin/bash

# Stop and remove MongoDB container
docker stop blod-mongodb
docker rm blod-mongodb

# Clear old data
rm -rf mongo_data
mkdir mongo_data

# Start containers
docker compose up -d

# Copy JSON file into the Mongo data directory
cp ./BLOD.json ./mongo_data

# Import into the correct DB and collection with authentication
docker exec -it blod-mongodb mongoimport \
  --db healthcloud \
  --collection BLOD \
  --file ./mongo_data/BLOD.json \
  --jsonArray \
  --upsert \
  -u admin -p password --authenticationDatabase admin