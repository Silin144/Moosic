#!/bin/bash

# Create SSL directory if it doesn't exist
sudo mkdir -p /opt/moosic/ssl

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /opt/moosic/ssl/privkey.pem \
    -out /opt/moosic/ssl/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=3.148.173.124"

# Set proper permissions
sudo chown -R ubuntu:ubuntu /opt/moosic/ssl
sudo chmod 600 /opt/moosic/ssl/* 