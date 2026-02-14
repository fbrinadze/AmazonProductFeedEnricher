#!/bin/bash

# Script to download AWS RDS SSL certificate bundle

set -e

echo "📥 Downloading AWS RDS SSL certificate bundle..."
echo ""

# Create certs directory if it doesn't exist
mkdir -p certs

# Download the global bundle
CERT_URL="https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem"
CERT_PATH="certs/global-bundle.pem"

if [ -f "$CERT_PATH" ]; then
    echo "⚠️  Certificate already exists at $CERT_PATH"
    read -p "Do you want to re-download it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
fi

curl -o "$CERT_PATH" "$CERT_URL"

if [ -f "$CERT_PATH" ]; then
    echo ""
    echo "✅ Certificate downloaded successfully to $CERT_PATH"
    echo ""
    echo "📝 Certificate details:"
    openssl x509 -in "$CERT_PATH" -text -noout | grep -A 2 "Issuer:"
    echo ""
    echo "🎉 You can now connect to AWS RDS with SSL!"
else
    echo ""
    echo "❌ Failed to download certificate"
    exit 1
fi
