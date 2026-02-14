#!/bin/bash

# Database setup script for Amazon Product Enrichment Tool
# This script creates the PostgreSQL database and user

set -e

echo "🚀 Setting up PostgreSQL database for Amazon Product Enrichment Tool"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first:"
    echo "   macOS: brew install postgresql@16"
    echo "   Ubuntu: sudo apt install postgresql-16"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start it:"
    echo "   macOS: brew services start postgresql@16"
    echo "   Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

echo "✅ PostgreSQL is installed and running"
echo ""

# Database configuration
DB_NAME="amazon_enrichment"
DB_USER="enrichment_user"
DB_PASSWORD="password"

echo "📦 Creating database and user..."
echo ""

# Create database and user
psql postgres << EOF
-- Drop database if exists (for clean setup)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo ""
echo "✅ Database '$DB_NAME' and user '$DB_USER' created successfully"
echo ""

# Run Prisma migrations
echo "🔄 Running Prisma migrations..."
npm run prisma:migrate

echo ""
echo "✅ Database setup complete!"
echo ""
echo "📝 Default admin credentials:"
echo "   Email: admin@bcibrands.com"
echo "   Password: admin123"
echo ""
echo "🎉 You can now start the backend server with: npm run dev"
echo "💡 To view the database, run: npm run prisma:studio"
