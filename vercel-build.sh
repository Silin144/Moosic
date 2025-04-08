#!/bin/bash

# Install frontend dependencies
npm install

# Build frontend
npm run build

# Create output directory
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions

# Copy frontend build to output
cp -r dist/* .vercel/output/static/

# Copy Python files to functions
cp server.py .vercel/output/functions/
cp requirements.txt .vercel/output/functions/

# Install Python dependencies
python3 -m pip install -r requirements.txt

echo "Build completed successfully"