#!/bin/bash

# Install frontend dependencies
npm install

# Build frontend
npm run build

# Install Python dependencies
pip install -r requirements-prod.txt

# Make server.py executable
chmod +x server.py

# Create .vercel directory if it doesn't exist
mkdir -p .vercel/output/static
mkdir -p .vercel/output/functions

# Copy static files
cp -r dist/* .vercel/output/static/

# Copy server files
cp server.py .vercel/output/functions/
cp requirements-prod.txt .vercel/output/functions/