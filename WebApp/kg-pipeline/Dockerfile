FROM python:3.11-slim

WORKDIR /app

# Install system tools + Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir rdflib pandas requests

# Copy pipeline script and entrypoint
COPY kg_pipeline.py .
COPY kg_entrypoint.sh .
RUN chmod +x kg_entrypoint.sh

ENTRYPOINT ["./kg_entrypoint.sh"]
