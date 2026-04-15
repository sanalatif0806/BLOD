FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data

EXPOSE 5001

# Use 1 worker because GenerateWeatherStationData loads data at startup
# and must be shared across requests. Multiple workers would each load independently.
CMD ["gunicorn", "--workers", "1", "--timeout", "120", "--bind", "0.0.0.0:5001", "app:app"]
