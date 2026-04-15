#!/bin/bash
# BLOD Web App - Quick Start (no MongoDB required)
set -e

echo "=== BLOD Quick Start ==="

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/WebApp/backend/src"
FRONTEND_DIR="$SCRIPT_DIR/WebApp/frontend/blod"

# Ensure enriched JSON is in place
if [ ! -f "$BACKEND_DIR/BLOD_with_fairness.json" ]; then
  echo "Copying BLOD_with_fairness.json..."
  cp "$SCRIPT_DIR/WebApp/backend/data/BLOD_with_fairness.json" "$BACKEND_DIR/" 2>/dev/null || \
  cp "$SCRIPT_DIR/WebApp/backend/BLOD.json" "$BACKEND_DIR/BLOD.json" 2>/dev/null || true
fi

# Install backend deps
echo "📦 Installing backend dependencies..."
cd "$BACKEND_DIR" && npm install --silent

# Start backend
echo "🚀 Starting backend on port 5005..."
MONGO_URI="" node server.js &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 2

# Install & start frontend
echo "📦 Installing frontend dependencies..."
cd "$FRONTEND_DIR" && npm install --silent

echo "🌐 Starting frontend on port 3000..."
REACT_APP_API_URL=http://localhost:5005 npm start

# Cleanup
kill $BACKEND_PID 2>/dev/null || true
