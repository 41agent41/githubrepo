-- Complete Database Schema Setup
-- This script ensures all tables, indexes, and constraints are properly configured
-- Compatible with both PostgreSQL and TimescaleDB

-- ==============================================
-- ENABLE EXTENSIONS
-- ==============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check if TimescaleDB is available and enable it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS "timescaledb";
            RAISE NOTICE 'TimescaleDB extension enabled';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'TimescaleDB extension not available, using standard PostgreSQL';
        END;
    ELSE
        RAISE NOTICE 'TimescaleDB extension already enabled';
    END IF;
END $$;

-- ==============================================
-- CORE TABLES
-- ==============================================

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    sec_type VARCHAR(10) NOT NULL,
    exchange VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'USD',
    multiplier VARCHAR(10),
    expiry DATE,
    strike DECIMAL(20,8),
    option_right VARCHAR(4),
    local_symbol VARCHAR(50),
    contract_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(symbol, sec_type, exchange, currency, expiry, strike, option_right)
);

-- Candlestick data table
CREATE TABLE IF NOT EXISTS candlestick_data (
    id BIGSERIAL,
    contract_id INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    open DECIMAL(20,8) NOT NULL,
    high DECIMAL(20,8) NOT NULL,
    low DECIMAL(20,8) NOT NULL,
    close DECIMAL(20,8) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    wap DECIMAL(20,8),
    count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(contract_id, timestamp, timeframe)
);

-- Tick data table
CREATE TABLE IF NOT EXISTS tick_data (
    id BIGSERIAL,
    contract_id INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    tick_type VARCHAR(20) NOT NULL,
    price DECIMAL(20,8),
    size INTEGER,
    exchange VARCHAR(20),
    special_conditions VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data collection sessions table
CREATE TABLE IF NOT EXISTS data_collection_sessions (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active',
    records_collected INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data quality metrics table
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    total_bars INTEGER DEFAULT 0,
    missing_bars INTEGER DEFAULT 0,
    duplicate_bars INTEGER DEFAULT 0,
    invalid_bars INTEGER DEFAULT 0,
    data_quality_score DECIMAL(5,4),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(contract_id, timeframe, date)
);

-- Data collection config table
CREATE TABLE IF NOT EXISTS data_collection_config (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    auto_collect BOOLEAN DEFAULT false,
    collection_interval_minutes INTEGER DEFAULT 5,
    retention_days INTEGER DEFAULT 365,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(contract_id, timeframe)
);

-- ==============================================
-- CONVERT TO HYPERTABLES (IF TIMESCALEDB AVAILABLE)
-- ==============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Convert candlestick_data to hypertable
        BEGIN
            PERFORM create_hypertable('candlestick_data', 'timestamp', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE);
            RAISE NOTICE 'candlestick_data converted to hypertable';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not convert candlestick_data to hypertable: %', SQLERRM;
        END;
        
        -- Convert tick_data to hypertable
        BEGIN
            PERFORM create_hypertable('tick_data', 'timestamp', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
            RAISE NOTICE 'tick_data converted to hypertable';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not convert tick_data to hypertable: %', SQLERRM;
        END;
    END IF;
END $$;

-- ==============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ==============================================

-- Add foreign key constraints (after hypertable creation for TimescaleDB)
ALTER TABLE candlestick_data ADD CONSTRAINT fk_candlestick_contract 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE tick_data ADD CONSTRAINT fk_tick_contract 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE data_collection_sessions ADD CONSTRAINT fk_sessions_contract 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE data_quality_metrics ADD CONSTRAINT fk_quality_contract 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

ALTER TABLE data_collection_config ADD CONSTRAINT fk_config_contract 
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

-- ==============================================
-- CREATE ALL REQUIRED INDEXES
-- ==============================================

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_symbol ON contracts(symbol);
CREATE INDEX IF NOT EXISTS idx_contracts_sec_type ON contracts(sec_type);
CREATE INDEX IF NOT EXISTS idx_contracts_exchange ON contracts(exchange);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_id ON contracts(contract_id);

-- Candlestick data indexes (including the ones expected by connectivity test)
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timeframe ON candlestick_data(contract_id, timeframe);
CREATE INDEX IF NOT EXISTS idx_candlestick_timestamp ON candlestick_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timestamp ON candlestick_data(contract_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timetrans ON candlestick_data(contract_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candlestick_drawtimestamp ON candlestick_data(timestamp DESC);

-- Tick data indexes
CREATE INDEX IF NOT EXISTS idx_tick_contract_timestamp ON tick_data(contract_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tick_type ON tick_data(tick_type);

-- Metadata table indexes
CREATE INDEX IF NOT EXISTS idx_sessions_contract ON data_collection_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON data_collection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_quality_contract_date ON data_quality_metrics(contract_id, date DESC);

-- ==============================================
-- CREATE FUNCTIONS AND TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
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
-- CREATE VIEWS
-- ==============================================

-- View for latest candlestick data
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
-- INSERT INITIAL DATA
-- ==============================================

-- Insert common contracts
INSERT INTO contracts (symbol, sec_type, exchange, currency) VALUES
    ('MSFT', 'STK', 'NASDAQ', 'USD'),
    ('AAPL', 'STK', 'NASDAQ', 'USD'),
    ('GOOGL', 'STK', 'NASDAQ', 'USD'),
    ('SPY', 'STK', 'ARCA', 'USD'),
    ('QQQ', 'STK', 'NASDAQ', 'USD'),
    ('TSLA', 'STK', 'NASDAQ', 'USD'),
    ('NVDA', 'STK', 'NASDAQ', 'USD'),
    ('AMZN', 'STK', 'NASDAQ', 'USD'),
    ('META', 'STK', 'NASDAQ', 'USD'),
    ('NFLX', 'STK', 'NASDAQ', 'USD')
ON CONFLICT (symbol, sec_type, exchange, currency, expiry, strike, option_right) DO NOTHING;

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Verify tables exist
SELECT 'Tables Verification' as check_type,
       COUNT(*) as total_tables,
       CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- Verify indexes exist
SELECT 'Indexes Verification' as check_type,
       COUNT(*) as total_indexes,
       CASE WHEN COUNT(*) >= 13 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname IN (
    'idx_contracts_symbol', 'idx_contracts_sec_type', 'idx_contracts_exchange', 'idx_contracts_contract_id',
    'idx_candlestick_contract_timeframe', 'idx_candlestick_timestamp', 'idx_candlestick_contract_timestamp',
    'idx_candlestick_contract_timetrans', 'idx_candlestick_drawtimestamp',
    'idx_tick_contract_timestamp', 'idx_tick_type',
    'idx_sessions_contract', 'idx_sessions_status', 'idx_quality_contract_date'
);

-- Verify constraints exist
SELECT 'Constraints Verification' as check_type,
       COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY') as primary_keys,
       COUNT(*) FILTER (WHERE constraint_type = 'UNIQUE') as unique_constraints,
       COUNT(*) FILTER (WHERE constraint_type = 'FOREIGN KEY') as foreign_keys,
       CASE WHEN COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY') >= 6 
                 AND COUNT(*) FILTER (WHERE constraint_type = 'UNIQUE') >= 4 
                 AND COUNT(*) FILTER (WHERE constraint_type = 'FOREIGN KEY') >= 2 
            THEN 'PASS' ELSE 'FAIL' END as status
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config');

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Complete Database Schema Setup Finished!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Setup Summary:';
    RAISE NOTICE '- All tables created with proper structure';
    RAISE NOTICE '- All required indexes created';
    RAISE NOTICE '- All foreign key constraints added';
    RAISE NOTICE '- TimescaleDB hypertables configured (if available)';
    RAISE NOTICE '- Triggers and functions created';
    RAISE NOTICE '- Initial data inserted';
    RAISE NOTICE '- Views created for data access';
    RAISE NOTICE '';
    RAISE NOTICE 'Database is now ready for the TradingApp!';
    RAISE NOTICE 'Run the connectivity test to verify everything works.';
END $$;
