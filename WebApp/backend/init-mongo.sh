#!/bin/bash
set -e

echo ">>> Seeding BLOD collection into healthcloud database..."

mongoimport \
  --host localhost \
  --username admin \
  --password password \
  --authenticationDatabase admin \
  --db healthcloud \
  --collection BLOD \
  --file /docker-entrypoint-initdb.d/BLOD.json \
  --jsonArray \
  --drop

echo ">>> Done seeding BLOD data."
