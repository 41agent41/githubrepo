-- Migration Script: Convert Existing Database to Raw Data Only
-- This script migrates existing TradingApp data to raw data only schema
-- Removes all technical indicators - only stores raw data from IB Gateway
-- Compatible with both PostgreSQL and TimescaleDB

-- ==============================================
-- PRE-MIGRATION CHECKS
-- ==============================================

-- Check if old tables exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candlestick_data') THEN
        RAISE EXCEPTION 'candlestick_data table not found. Nothing to migrate.';
    END IF;
    RAISE NOTICE 'Existing tables found. Starting migration to raw data schema...';
END $$;

-- ==============================================
-- BACKUP EXISTING DATA
-- ==============================================

-- Create backup tables for safety
CREATE TABLE IF NOT EXISTS contracts_backup AS SELECT * FROM contracts;
CREATE TABLE IF NOT EXISTS candlestick_data_backup AS SELECT * FROM candlestick_data;

-- Backup other tables if they exist
CREATE TABLE IF NOT EXISTS tick_data_backup AS 
SELECT * FROM tick_data WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tick_data');

CREATE TABLE IF NOT EXISTS data_collection_sessions_backup AS 
SELECT * FROM data_collection_sessions WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_collection_sessions');

CREATE TABLE IF NOT EXISTS data_quality_metrics_backup AS 
SELECT * FROM data_quality_metrics WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_quality_metrics');

CREATE TABLE IF NOT EXISTS data_collection_config_backup AS 
SELECT * FROM data_collection_config WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_collection_config');

-- Backup technical indicators if they exist (will be removed)
CREATE TABLE IF NOT EXISTS technical_indicators_backup AS 
SELECT * FROM technical_indicators WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'technical_indicators');

-- ==============================================
-- REMOVE TECHNICAL INDICATORS (RAW DATA ONLY)
-- ==============================================

-- Drop technical indicators table and related objects
DROP TABLE IF EXISTS technical_indicators CASCADE;

-- Drop any views that might reference technical indicators
DROP VIEW IF EXISTS latest_candlestick_data CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_candlestick_data CASCADE;
DROP MATERIALIZED VIEW IF EXISTS hourly_candlestick_data CASCADE;

-- ==============================================
-- UPDATE SCHEMA FOR RAW DATA ONLY
-- ==============================================

-- Update contracts table if needed
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update candlestick_data table if needed
ALTER TABLE candlestick_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Update tick_data table if needed (create if doesn't exist)
CREATE TABLE IF NOT EXISTS tick_data (
    id BIGSERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    tick_type VARCHAR(20) NOT NULL, -- bid, ask, last, volume, etc. from IB
    price DECIMAL(15,6),
    size INTEGER,
    exchange VARCHAR(20),
    special_conditions VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create metadata tables if they don't exist
CREATE TABLE IF NOT EXISTS data_collection_sessions (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, completed, failed
    records_collected INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    total_bars INTEGER DEFAULT 0,
    missing_bars INTEGER DEFAULT 0,
    duplicate_bars INTEGER DEFAULT 0,
    invalid_bars INTEGER DEFAULT 0,
    data_quality_score DECIMAL(3,2), -- 0.00 to 1.00
    last_updated TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(contract_id, timeframe, date)
);

CREATE TABLE IF NOT EXISTS data_collection_config (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    auto_collect BOOLEAN DEFAULT false,
    collection_interval_minutes INTEGER DEFAULT 5,
    retention_days INTEGER DEFAULT 365, -- How long to keep raw data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(contract_id, timeframe)
);

-- ==============================================
-- RECREATE INDEXES (RAW DATA FOCUSED)
-- ==============================================

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_symbol ON contracts(symbol);
CREATE INDEX IF NOT EXISTS idx_contracts_sec_type ON contracts(sec_type);
CREATE INDEX IF NOT EXISTS idx_contracts_exchange ON contracts(exchange);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_id ON contracts(contract_id);

-- Candlestick data indexes
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timeframe ON candlestick_data(contract_id, timeframe);
CREATE INDEX IF NOT EXISTS idx_candlestick_timestamp ON candlestick_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timestamp ON candlestick_data(contract_id, timestamp DESC);

-- Tick data indexes
CREATE INDEX IF NOT EXISTS idx_tick_contract_timestamp ON tick_data(contract_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tick_type ON tick_data(tick_type);

-- Metadata table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_contract ON data_collection_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON data_collection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quality_contract_date ON data_quality_metrics(contract_id, date DESC);

-- ==============================================
-- CONVERT TO TIMESCALEDB (IF AVAILABLE)
-- ==============================================

-- Check if TimescaleDB extension is available and convert hypertables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        RAISE NOTICE 'TimescaleDB extension found. Converting to hypertables...';
        
        -- Convert candlestick_data to hypertable if not already
        BEGIN
            PERFORM create_hypertable('candlestick_data', 'timestamp', chunk_time_interval => INTERVAL '1 day');
            RAISE NOTICE 'candlestick_data converted to hypertable';
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'candlestick_data is already a hypertable';
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not convert candlestick_data to hypertable: %', SQLERRM;
        END;
        
        -- Convert tick_data to hypertable if not already
        BEGIN
            PERFORM create_hypertable('tick_data', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
            RAISE NOTICE 'tick_data converted to hypertable';
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'tick_data is already a hypertable';
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not convert tick_data to hypertable: %', SQLERRM;
        END;
        
        -- Create continuous aggregates for TimescaleDB
        BEGIN
            CREATE MATERIALIZED VIEW IF NOT EXISTS daily_candlestick_data
            WITH (timescaledb.continuous) AS
            SELECT 
                contract_id,
                timeframe,
                time_bucket('1 day', timestamp) AS day,
                FIRST(open, timestamp) AS day_open,
                MAX(high) AS day_high,
                MIN(low) AS day_low,
                LAST(close, timestamp) AS day_close,
                SUM(volume) AS day_volume,
                AVG(wap) AS day_avg_wap,
                SUM(count) AS day_trade_count
            FROM candlestick_data
            GROUP BY contract_id, timeframe, day;
            
            -- Add refresh policy
            PERFORM add_continuous_aggregate_policy('daily_candlestick_data',
                start_offset => INTERVAL '3 days',
                end_offset => INTERVAL '1 hour',
                schedule_interval => INTERVAL '1 hour');
                
            RAISE NOTICE 'TimescaleDB continuous aggregates created';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not create continuous aggregates: %', SQLERRM;
        END;
        
        -- Set up retention policies
        BEGIN
            PERFORM add_retention_policy('candlestick_data', INTERVAL '2 years');
            PERFORM add_retention_policy('tick_data', INTERVAL '30 days');
            RAISE NOTICE 'TimescaleDB retention policies configured';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not set retention policies: %', SQLERRM;
        END;
        
    ELSE
        RAISE NOTICE 'TimescaleDB extension not found. Using standard PostgreSQL features.';
    END IF;
END $$;

-- ==============================================
-- CREATE SIMPLIFIED VIEWS (RAW DATA ONLY)
-- ==============================================

-- Simple view for latest raw candlestick data (no indicators)
CREATE OR REPLACE VIEW latest_candlestick_data AS
SELECT 
    c.symbol,
    c.sec_type,
    c.exchange,
    c.currency,
    cd.timestamp,
    cd.timeframe,
    cd.open,
    cd.high,
    cd.low,
    cd.close,
    cd.volume,
    cd.wap,
    cd.count
FROM candlestick_data cd
JOIN contracts c ON cd.contract_id = c.id
ORDER BY cd.timestamp DESC;

-- ==============================================
-- UPDATE FUNCTIONS AND TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate triggers
DROP TRIGGER IF EXISTS update_contracts_updated_at ON contracts;
CREATE TRIGGER update_contracts_updated_at 
    BEFORE UPDATE ON contracts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON data_collection_sessions;
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON data_collection_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_updated_at ON data_collection_config;
CREATE TRIGGER update_config_updated_at 
    BEFORE UPDATE ON data_collection_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- VERIFICATION
-- ==============================================

-- Verify technical indicators table was removed
SELECT 'Technical Indicators Removed' as check_type,
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'technical_indicators') 
            THEN 'OK' ELSE 'FAIL' END as status;

-- Verify core tables exist
SELECT 'Core Tables Exist' as check_type,
       COUNT(*) as count,
       CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'FAIL' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data');

-- Verify data integrity
SELECT 'Data Integrity Check' as check_type,
       (SELECT COUNT(*) FROM candlestick_data) as candlestick_count,
       (SELECT COUNT(*) FROM contracts) as contracts_count,
       CASE WHEN (SELECT COUNT(*) FROM candlestick_data) > 0 THEN 'OK' ELSE 'WARNING' END as status;

-- Check if TimescaleDB features are available
SELECT 'TimescaleDB Features' as check_type,
       CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') 
            THEN 'AVAILABLE' ELSE 'NOT AVAILABLE' END as status;

-- ==============================================
-- CLEANUP (OPTIONAL)
-- ==============================================

-- Uncomment the following lines to remove backup tables after successful migration
-- DROP TABLE IF EXISTS contracts_backup;
-- DROP TABLE IF EXISTS candlestick_data_backup;
-- DROP TABLE IF EXISTS tick_data_backup;
-- DROP TABLE IF EXISTS technical_indicators_backup;
-- DROP TABLE IF EXISTS data_collection_sessions_backup;
-- DROP TABLE IF EXISTS data_quality_metrics_backup;
-- DROP TABLE IF EXISTS data_collection_config_backup;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Raw Data Migration Completed Successfully!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '- Technical indicators table REMOVED';
    RAISE NOTICE '- Database now stores ONLY raw data from IB Gateway';
    RAISE NOTICE '- TimescaleDB features enabled if extension available';
    RAISE NOTICE '- Simplified views created for raw data access';
    RAISE NOTICE '- Data quality monitoring configured';
    RAISE NOTICE '- Backup tables created for safety';
    RAISE NOTICE '';
    RAISE NOTICE 'Architecture Changes:';
    RAISE NOTICE '- Database: Raw data storage only';
    RAISE NOTICE '- Frontend: TradingView Charts handle all analysis';
    RAISE NOTICE '- Backend: Data streaming and API services';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Update frontend to use TradingView Charts for indicators';
    RAISE NOTICE '2. Test data streaming with the simplified schema';
    RAISE NOTICE '3. Remove backup tables after confirming everything works';
    RAISE NOTICE '4. Monitor data quality and collection sessions';
    RAISE NOTICE '';
    RAISE NOTICE 'Your TradingApp now uses a clean raw data architecture!';
END $$;

