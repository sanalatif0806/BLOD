# create_fallback_csv.py
import pandas as pd
import numpy as np
from datetime import datetime

# Create sample data with the same structure as KGHeartBeat
data = {
    'KG id': [f'kg_{i:03d}' for i in range(1, 31)],
    'KG name': [f'Health Dataset {i}' for i in range(1, 31)],
    'Sparql endpoint': np.random.choice(['Available', 'offline', '-', 'Restricted access to the endpoint'], 30, p=[0.3, 0.3, 0.2, 0.2]),
    'Availability of RDF dump (metadata)': np.random.choice([1, 0, -1], 30, p=[0.4, 0.4, 0.2]),
    'License machine redeable (metadata)': np.random.choice(['CC-BY-4.0', 'MIT', 'GPL-3.0', '-', 'False', 'ODbL-1.0'], 30),
    'metadata-media-type': np.random.choice(['["application/json"]', '["application/rdf+xml"]', '["text/csv"]', '["application/json", "application/rdf+xml"]'], 30),
    'F score': np.round(np.random.uniform(0.3, 1.0, 30), 2),
    'A score': np.round(np.random.uniform(0.2, 1.0, 30), 2),
    'I score': np.round(np.random.uniform(0.4, 1.0, 30), 2),
    'R score': np.round(np.random.uniform(0.3, 1.0, 30), 2),
    'FAIR score': np.round(np.random.uniform(0.4, 0.95, 30), 2),
    'Vocabularies': np.random.choice(['["foaf"]', '["dcterms", "foaf"]', '["schema", "dcterms"]', '["obo"]'], 30)
}

df = pd.DataFrame(data)

# Save with the specific filename
filename = f"2025-11-30.csv"
df.to_csv(filename, index=False)
print(f"Created {filename} with {len(df)} rows")

# Also save as latest_quality_snapshot.csv for caching
df.to_csv("latest_quality_snapshot.csv", index=False)
print("Also saved as latest_quality_snapshot.csv")