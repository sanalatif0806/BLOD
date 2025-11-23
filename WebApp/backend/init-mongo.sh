#!/bin/bash
set -e

echo ">>> Creating healthcloud database and seeding data..."

# Create the user and import JSON
mongo <<EOF
use healthcloud
db.createUser({
  user: "admin",
  pwd: "password",
  roles: [ { role: "root", db: "admin" } ]
})
EOF

# Import the JSON directly into the DB
mongoimport \
  --db healthcloud \
  --collection BLOD \
  --file /docker-entrypoint-initdb.d/BLOD.json \
  --jsonArray
