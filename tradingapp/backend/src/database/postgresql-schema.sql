-- TradingApp PostgreSQL Schema - Raw Data Only
-- Stores only raw market data from IB Gateway
-- All technical indicators calculated by TradingView Lightweight Charts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================
-- CORE TABLES
-- ==============================================

-- Symbols/Contracts table - stores contract information from IB Gateway
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    sec_type VARCHAR(10) NOT NULL, -- STK, OPT, FUT, CASH, etc.
    exchange VARCHAR(20),
    currency VARCHAR(3) DEFAULT 'USD',
    multiplier VARCHAR(10),
    expiry DATE,
    strike DECIMAL(10,2),
    right VARCHAR(4), -- CALL, PUT for options
    local_symbol VARCHAR(50),
    contract_id INTEGER, -- IB contract ID
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite unique constraint
    UNIQUE(symbol, sec_type, exchange, currency, expiry, strike, right)
);

-- Create index for efficient contract lookups
CREATE INDEX IF NOT EXISTS idx_contracts_symbol ON contracts(symbol);
CREATE INDEX IF NOT EXISTS idx_contracts_sec_type ON contracts(sec_type);
CREATE INDEX IF NOT EXISTS idx_contracts_exchange ON contracts(exchange);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_id ON contracts(contract_id);

-- ==============================================
-- RAW DATA TABLES
-- ==============================================

-- OHLCV candlestick data - RAW DATA ONLY from IB Gateway
CREATE TABLE IF NOT EXISTS candlestick_data (
    id BIGSERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- 1min, 5min, 15min, 30min, 1hour, 4hour, 8hour, 1day
    open DECIMAL(15,6) NOT NULL,
    high DECIMAL(15,6) NOT NULL,
    low DECIMAL(15,6) NOT NULL,
    close DECIMAL(15,6) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    wap DECIMAL(15,6), -- Volume Weighted Average Price from IB
    count INTEGER, -- Number of trades from IB
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite unique constraint to prevent duplicates
    UNIQUE(contract_id, timestamp, timeframe)
);

-- Create indexes for efficient data retrieval
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timeframe ON candlestick_data(contract_id, timeframe);
CREATE INDEX IF NOT EXISTS idx_candlestick_timestamp ON candlestick_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candlestick_contract_timestamp ON candlestick_data(contract_id, timestamp DESC);

-- Real-time tick data (for high-frequency data) - RAW DATA ONLY from IB Gateway
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

CREATE INDEX IF NOT EXISTS idx_tick_contract_timestamp ON tick_data(contract_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tick_type ON tick_data(tick_type);

-- ==============================================
-- DATA COLLECTION METADATA
-- ==============================================

-- Track data collection sessions from IB Gateway
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

CREATE INDEX IF NOT EXISTS idx_sessions_contract ON data_collection_sessions(contract_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON data_collection_sessions(status);

-- Data quality metrics for raw data validation
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

CREATE INDEX IF NOT EXISTS idx_quality_contract_date ON data_quality_metrics(contract_id, date DESC);

-- Data collection configuration for IB Gateway
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
-- VIEWS FOR RAW DATA ACCESS
-- ==============================================

-- View for latest raw candlestick data (NO INDICATORS)
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
-- FUNCTIONS AND TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for contracts table
CREATE TRIGGER update_contracts_updated_at 
    BEFORE UPDATE ON contracts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for data_collection_sessions table
CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON data_collection_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for data_collection_config table
CREATE TRIGGER update_config_updated_at 
    BEFORE UPDATE ON data_collection_config 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean old raw data based on retention policy
CREATE OR REPLACE FUNCTION clean_old_data()
RETURNS void AS $$
DECLARE
    config_record RECORD;
BEGIN
    FOR config_record IN 
        SELECT contract_id, timeframe, retention_days 
        FROM data_collection_config 
        WHERE enabled = true
    LOOP
        -- Delete old candlestick data
        DELETE FROM candlestick_data 
        WHERE contract_id = config_record.contract_id 
        AND timeframe = config_record.timeframe
        AND timestamp < NOW() - INTERVAL '1 day' * config_record.retention_days;
        
        -- Delete old tick data (keep only 30 days)
        DELETE FROM tick_data 
        WHERE contract_id = config_record.contract_id 
        AND timestamp < NOW() - INTERVAL '30 days';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- INITIAL DATA
-- ==============================================

-- Insert some common contracts for testing
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
ON CONFLICT (symbol, sec_type, exchange, currency, expiry, strike, right) DO NOTHING;

-- ==============================================
-- COMMENTS
-- ==============================================

COMMENT ON TABLE contracts IS 'Stores contract information from Interactive Brokers Gateway';
COMMENT ON TABLE candlestick_data IS 'Raw OHLCV candlestick data from IB Gateway';
COMMENT ON TABLE tick_data IS 'Raw real-time tick data from IB Gateway';
COMMENT ON TABLE data_collection_sessions IS 'Tracks data collection sessions from IB Gateway';
COMMENT ON TABLE data_quality_metrics IS 'Raw data quality metrics and validation';
COMMENT ON TABLE data_collection_config IS 'Configuration for IB Gateway data collection';

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Verify tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
ORDER BY table_name;

-- Verify indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('contracts', 'candlestick_data', 'tick_data', 'data_collection_sessions', 'data_quality_metrics', 'data_collection_config')
ORDER BY tablename, indexname;

-- Verify initial data was inserted
SELECT symbol, sec_type, exchange, currency FROM contracts ORDER BY symbol;

-- Verify functions were created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_updated_at_column', 'clean_old_data')
ORDER BY routine_name;

-- Verify triggers were created
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table IN ('contracts', 'data_collection_sessions', 'data_collection_config')
ORDER BY event_object_table, trigger_name;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE 'TradingApp PostgreSQL Raw Data schema initialization completed successfully!';
    RAISE NOTICE 'Tables created: contracts, candlestick_data, tick_data, data_collection_sessions, data_quality_metrics, data_collection_config';
    RAISE NOTICE 'Views created: latest_candlestick_data (raw data only)';
    RAISE NOTICE 'Functions created: update_updated_at_column, clean_old_data';
    RAISE NOTICE 'Triggers created: update_contracts_updated_at, update_sessions_updated_at, update_config_updated_at';
    RAISE NOTICE 'Initial data: 10 common stock contracts inserted';
    RAISE NOTICE 'NO technical indicators - all analysis handled by TradingView Lightweight Charts';
END $$;

