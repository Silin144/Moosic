#!/bin/bash

# Install frontend dependencies
npm install

# Build frontend
npm run build

# Install Python dependencies
pip install -r requirements.txt

# Make server.py executable
chmod +x server.py