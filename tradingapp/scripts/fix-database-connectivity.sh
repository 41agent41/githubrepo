#!/bin/bash

# Fix Database Connectivity Issues
# This script runs the database fixes to resolve connectivity test issues

set -e

echo "🔧 Fixing Database Connectivity Issues..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Database connection parameters (adjust as needed)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-tradingapp}"
DB_USER="${DB_USER:-postgres}"

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

# Run the connectivity fix script
echo "🔨 Running database connectivity fixes..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$PROJECT_ROOT/backend/src/database/fix-connectivity-issues.sql"

if [ $? -eq 0 ]; then
    echo "✅ Database connectivity fixes completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Run the database connectivity test in the web interface"
    echo "   2. Verify all tests pass"
    echo "   3. Monitor performance improvements"
    echo ""
    echo "🎉 Database schema is now properly optimized!"
else
    echo "❌ Error: Database connectivity fixes failed!"
    echo "Please check the error messages above and try again."
    exit 1
fi
