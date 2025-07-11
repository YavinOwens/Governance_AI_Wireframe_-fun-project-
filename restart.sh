#!/bin/bash

echo "🔄 Restarting Governance Workshop Platform..."

# Kill any existing processes
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true  
pkill -f "node server.js" 2>/dev/null || true

# Wait for processes to stop
sleep 3

echo "🚀 Starting servers with start-dev.sh..."
./start-dev.sh 