#!/bin/bash

# Complete Database Setup Script
# This script sets up the complete database schema for the TradingApp

set -e

echo "🚀 Setting up TradingApp Database..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Database connection parameters (adjust as needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tradingapp}"
DB_USER="${DB_USER:-tradingapp}"

echo "📊 Database connection parameters:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Test database connection
echo "🔍 Testing database connection..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
    echo "❌ Error: Cannot connect to database. Please check your connection parameters."
    echo "   Make sure the database exists and the user has proper permissions."
    exit 1
fi
echo "✅ Database connection successful!"

# Run the complete schema setup
echo "🔨 Setting up complete database schema..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$PROJECT_ROOT/backend/src/database/complete-schema-setup.sql"

if [ $? -eq 0 ]; then
    echo "✅ Database schema setup completed successfully!"
    echo ""
    echo "📋 Database setup summary:"
    echo "   - All tables created with proper structure"
    echo "   - All required indexes created"
    echo "   - All foreign key constraints added"
    echo "   - TimescaleDB hypertables configured (if available)"
    echo "   - Triggers and functions created"
    echo "   - Initial data inserted"
    echo "   - Views created for data access"
    echo ""
    echo "🎉 Database is now ready for the TradingApp!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Start the backend service"
    echo "   2. Run the database connectivity test in the web interface"
    echo "   3. Verify all tests pass"
    echo "   4. Begin data collection and trading operations"
else
    echo "❌ Error: Database schema setup failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi
