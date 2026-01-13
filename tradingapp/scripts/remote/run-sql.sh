#!/bin/bash
# Run SQL on remote TimescaleDB
# Usage: ./run-sql.sh <sql-file>

DB_HOST="10.7.3.21"
DB_USER="tradingapp"
DB_NAME="tradingapp"
DB_PORT="5432"

if [ -z "$1" ]; then
  echo "Usage: $0 <sql-file>"
  echo "  Runs a SQL file on the remote TimescaleDB server"
  echo ""
  echo "Example: $0 ../backend/src/database/migration-keepalive.sql"
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "Error: File not found: $1"
  exit 1
fi

echo "Running $1 on $DB_HOST..."
echo "Enter database password when prompted:"

PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$1"
