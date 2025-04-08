#!/bin/bash

# Kill any process using ports 3001 and 5173-5176
lsof -ti:3001,5173,5174,5175,5176 | xargs kill -9 2>/dev/null || true

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt

# Set Spotify redirect URI
export SPOTIPY_REDIRECT_URI="http://localhost:3001/api/callback"

# Start the Python server in the background
python3 server.py &
SERVER_PID=$!

# Start the frontend
npm run dev

# If npm exits, kill the server
kill $SERVER_PID 2>/dev/null