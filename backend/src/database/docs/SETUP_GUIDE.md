# TradingApp Database Setup Guide

## 🎯 Overview

This guide provides detailed instructions for setting up the TradingApp database. The database stores **only raw market data** from IB Gateway, with all technical indicators calculated by TradingView Lightweight Charts on the frontend.

## 🚀 Quick Setup

### **Option 1: TimescaleDB (Recommended)**
```bash
# 1. Set up TimescaleDB instance
# 2. Run the schema
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f timescaledb-schema.sql
```

### **Option 2: Standard PostgreSQL**
```bash
# 1. Set up PostgreSQL instance
# 2. Run the schema
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f postgresql-schema.sql
```

### **Option 3: Migration from Existing Database**
```bash
# Migrate existing database to raw data schema
psql -h YOUR_DB_HOST -U tradingapp -d tradingapp -f migration-script.sql
```

## 📋 Prerequisites

### **System Requirements**
- **PostgreSQL**: 13+ (15+ recommended)
- **TimescaleDB**: 2.8+ (if using TimescaleDB option)
- **Memory**: 4GB+ RAM (8GB+ for production)
- **Storage**: SSD recommended for time-series data

### **Database User Setup**
```sql
-- Create dedicated user
CREATE USER tradingapp WITH PASSWORD 'your_secure_password';
CREATE DATABASE tradingapp OWNER tradingapp;
GRANT ALL PRIVILEGES ON DATABASE tradingapp TO tradingapp;
```

## 🔧 Detailed Setup Instructions

### **Step 1: Database Instance Setup**

#### **TimescaleDB Cloud (Easiest)**
1. Sign up at [TimescaleDB Cloud](https://cloud.timescale.com/)
2. Create a new service with PostgreSQL 15+
3. Note the connection details

#### **Self-Hosted TimescaleDB**
```bash
# Using Docker
docker run -d \
  --name timescaledb \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=tradingapp \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15
```

#### **Standard PostgreSQL**
```bash
# Using Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=tradingapp \
  -p 5432:5432 \
  postgres:15
```

### **Step 2: Environment Configuration**

Create or update your `.env` file:
```bash
# Database Configuration
POSTGRES_HOST=your-db-host.com
POSTGRES_PORT=5432
POSTGRES_USER=tradingapp
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=tradingapp
POSTGRES_SSL=true

# For local development
# POSTGRES_HOST=localhost
# POSTGRES_SSL=false
```

### **Step 3: Schema Installation**

#### **For TimescaleDB:**
```bash
# Connect and run schema
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f timescaledb-schema.sql
```

#### **For Standard PostgreSQL:**
```bash
# Connect and run schema
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f postgresql-schema.sql
```

### **Step 4: Verification**

#### **Check Tables**
```sql
-- Verify core tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data');

-- Should return 3 rows
```

#### **Check TimescaleDB Features (if using TimescaleDB)**
```sql
-- Check TimescaleDB extension
SELECT * FROM pg_extension WHERE extname = 'timescaledb';

-- Check hypertables
SELECT * FROM timescaledb_information.hypertables;

-- Check continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;
```

#### **Test API Connection**
```bash
# Test database health endpoint
curl http://your-server:4000/api/database/health

# Expected response:
# {"status":"healthy","database":"connected","timestamp":"2024-01-01T00:00:00.000Z"}
```

## 📊 Schema Overview

### **Core Tables**
- **`contracts`**: IB Gateway contract information
- **`candlestick_data`**: Raw OHLCV data from IB Gateway
- **`tick_data`**: Raw tick data from IB Gateway

### **Metadata Tables**
- **`data_collection_sessions`**: Collection tracking
- **`data_quality_metrics`**: Data validation
- **`data_collection_config`**: Collection configuration

### **Views**
- **`latest_candlestick_data`**: Latest raw OHLCV data
- **`daily_trading_summary`**: Daily raw data summaries (TimescaleDB only)
- **`latest_tick_data`**: Latest raw tick data (TimescaleDB only)

## 🔍 Data Flow

### **1. Data Ingestion**
```
IB Gateway → Backend Service → Database
```

### **2. Data Retrieval**
```
Database → Backend API → Frontend → TradingView Charts
```

### **3. Technical Analysis**
```
Raw Data → Frontend Calculations → Chart Display
```

## 📈 Performance Features

### **TimescaleDB Benefits**
- **Automatic partitioning** by time
- **Continuous aggregates** for daily/hourly summaries
- **Automated retention policies**
- **Compression** of older data
- **10-100x faster** time-range queries

### **Raw Data Benefits**
- **Simplified queries** - no complex joins
- **Smaller database** - no indicator storage
- **Real-time analysis** - frontend calculations
- **Flexible indicators** - easy to modify

## 🛠️ Troubleshooting

### **Connection Issues**
```bash
# Test database connectivity
telnet $POSTGRES_HOST $POSTGRES_PORT

# Test with psql
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT 1;"
```

### **SSL Issues**
```bash
# For self-signed certificates
export POSTGRES_SSL=true

# For local development
export POSTGRES_SSL=false
```

### **Permission Issues**
```sql
-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE tradingapp TO tradingapp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tradingapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tradingapp;
```

### **Schema Issues**
```bash
# Re-run schema if needed
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f timescaledb-schema.sql
```

### **Data Quality Issues**
```sql
-- Check data quality metrics
SELECT 
    c.symbol,
    dqm.date,
    dqm.data_quality_score,
    dqm.missing_bars
FROM data_quality_metrics dqm
JOIN contracts c ON dqm.contract_id = c.id
WHERE dqm.data_quality_score < 0.95
ORDER BY dqm.date DESC;
```

## 🔐 Security Best Practices

### **Database Security**
1. **Use SSL** for all remote connections
2. **Strong passwords** for database users
3. **Network restrictions** to application servers only
4. **Regular updates** of PostgreSQL/TimescaleDB
5. **Automated backups** with encryption

### **Connection Security**
```bash
# Use SSL connection strings
postgresql://user:password@host:port/database?sslmode=require

# For development only (not production)
postgresql://user:password@host:port/database?sslmode=disable
```

## 📊 Backup and Recovery

### **Automated Backups**
```bash
#!/bin/bash
# backup-database.sh
BACKUP_DIR="/backups/tradingapp"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  --format=custom --compress=9 \
  > $BACKUP_DIR/tradingapp_$DATE.dump

# Keep only last 7 days
find $BACKUP_DIR -name "tradingapp_*.dump" -mtime +7 -delete
```

### **Restore from Backup**
```bash
# Restore from backup
pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \
  --clean --if-exists \
  tradingapp_20240101_120000.dump
```

## 🎯 Next Steps

1. **Choose your database setup** (TimescaleDB recommended)
2. **Configure environment variables**
3. **Run the appropriate schema file**
4. **Verify installation** with test queries
5. **Update frontend** to use TradingView Charts
6. **Test data streaming** from IB Gateway
7. **Set up monitoring** and backups

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your environment configuration
3. Review the schema verification queries
4. Check database logs for error details

Your TradingApp database is now ready for high-performance raw data streaming!

