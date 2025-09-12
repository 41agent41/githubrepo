# TradingApp Database Setup and Maintenance

This document consolidates all database setup, maintenance, and troubleshooting procedures for the TradingApp.

## Overview

The TradingApp uses PostgreSQL with TimescaleDB extension for optimal time-series data storage and performance. All database scripts are executed directly through the PostgreSQL database user interface.

## Database Schema

### Core Tables
- **contracts** - Contract information from Interactive Brokers
- **candlestick_data** - OHLCV time-series data (TimescaleDB hypertable)
- **tick_data** - Real-time tick data (TimescaleDB hypertable)
- **data_collection_sessions** - Data collection tracking
- **data_quality_metrics** - Data quality monitoring
- **data_collection_config** - Collection configuration

### Key Features
- **TimescaleDB Hypertables**: Optimized for time-series data
- **Composite Primary Keys**: Required for TimescaleDB partitioning
- **Comprehensive Indexing**: Optimized for trading queries
- **Data Quality Monitoring**: Built-in data validation
- **Automated Retention**: Configurable data retention policies

## Quick Setup

### 1. Complete Database Setup
Run the consolidated setup script in your database interface:

```sql
-- Copy and paste the contents of: consolidated-database-setup.sql
```

### 2. Verify Installation
Run the verification script:

```sql
-- Copy and paste the contents of: database-verification.sql
```

## Troubleshooting

### Database Connectivity Issues

If the database connectivity test shows warnings:

1. **Missing Indexes**: Run the index creation script
2. **Missing Primary Keys**: Run the primary key fix script
3. **Constraint Validation**: Check constraint counts and types

### Common Issues

#### TimescaleDB Primary Key Requirements
TimescaleDB hypertables require composite primary keys that include the partitioning column:

```sql
-- Correct for TimescaleDB
ALTER TABLE candlestick_data ADD CONSTRAINT pk_candlestick_data PRIMARY KEY (id, timestamp);
ALTER TABLE tick_data ADD CONSTRAINT pk_tick_data PRIMARY KEY (id, timestamp);
```

#### Expected Constraint Counts
- **Primary Keys**: 6 (one per table)
- **Unique Constraints**: 4+ (data integrity)
- **Foreign Keys**: 2+ (referential integrity)

## File Structure

### SQL Scripts
- `consolidated-database-setup.sql` - Complete database setup
- `database-verification.sql` - Verification and testing queries

### Documentation
- `CONSOLIDATED_DATABASE_SETUP.md` - This comprehensive guide

## Maintenance

### Data Quality Monitoring
The database includes built-in data quality monitoring:

```sql
-- Check data quality metrics
SELECT * FROM data_quality_metrics ORDER BY date DESC LIMIT 10;
```

### Performance Monitoring
Monitor query performance and index usage:

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname IN ('candlestick_data', 'tick_data');
```

### Retention Management
TimescaleDB automatically manages data retention based on configured policies.

## Support

For issues:
1. Check the database connectivity test results
2. Review the verification queries output
3. Check backend service logs for constraint validation details
4. Ensure TimescaleDB extension is properly configured

## Version History

- **v1.0** - Initial PostgreSQL schema
- **v1.1** - Added TimescaleDB support
- **v1.2** - Fixed composite primary keys for TimescaleDB
- **v1.3** - Consolidated documentation and scripts
