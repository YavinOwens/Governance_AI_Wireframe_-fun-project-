#!/bin/bash

echo "🚀 Starting Governance Workshop Platform Development Servers..."
echo ""

# Kill any existing processes on these ports
echo "🔄 Stopping any existing servers..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true  
pkill -f "node server.js" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

echo "✅ Starting WebSocket server on port 3001..."
npm run dev:server &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "✅ Starting Next.js frontend on port 3000..."
npm run dev:next &
FRONTEND_PID=$!

echo ""
echo "🎉 Development servers started!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 WebSocket: ws://localhost:3001"
echo "🏥 Health Check: http://localhost:3001/health"
echo ""
echo "To stop servers, press Ctrl+C or run: pkill -f 'npm run dev'"
echo ""

# Wait for user to stop
wait $SERVER_PID $FRONTEND_PID 