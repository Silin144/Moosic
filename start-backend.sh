#!/bin/bash

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
source venv/bin/activate
pip install -r requirements.txt

# Kill any process using port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start the Python server
python3 server.py