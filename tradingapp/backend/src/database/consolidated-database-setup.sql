-- TradingApp Consolidated Database Setup
-- Complete database schema setup with TimescaleDB support
-- Execute this script in your PostgreSQL database interface

-- ==============================================
-- ENABLE EXTENSIONS
-- ==============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable TimescaleDB if available
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

-- Contracts table - stores contract information from IB Gateway
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

-- Candlestick data table - OHLCV time-series data
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

-- Tick data table - real-time tick data
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
-- CONVERT TO HYPERTABLES (TIMESCALEDB)
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
                RAISE NOTICE 'candlestick_data hypertable: %', SQLERRM;
        END;
        
        -- Convert tick_data to hypertable
        BEGIN
            PERFORM create_hypertable('tick_data', 'timestamp', chunk_time_interval => INTERVAL '1 hour', if_not_exists => TRUE);
            RAISE NOTICE 'tick_data converted to hypertable';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'tick_data hypertable: %', SQLERRM;
        END;
    END IF;
END $$;

-- ==============================================
-- ADD PRIMARY KEYS (TIMESCALEDB COMPATIBLE)
-- ==============================================

-- Add composite primary keys for TimescaleDB hypertables
DO $$
BEGIN
    -- Primary key for candlestick_data (TimescaleDB requires timestamp in PK)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'PRIMARY KEY' 
        AND table_name = 'candlestick_data' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE candlestick_data ADD CONSTRAINT pk_candlestick_data PRIMARY KEY (id, timestamp);
        RAISE NOTICE 'Added composite primary key to candlestick_data';
    END IF;
    
    -- Primary key for tick_data (TimescaleDB requires timestamp in PK)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'PRIMARY KEY' 
        AND table_name = 'tick_data' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE tick_data ADD CONSTRAINT pk_tick_data PRIMARY KEY (id, timestamp);
        RAISE NOTICE 'Added composite primary key to tick_data';
    END IF;
END $$;

-- ==============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ==============================================

-- Add foreign key constraints (after hypertable creation)
DO $$
BEGIN
    -- Foreign key for candlestick_data
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'candlestick_data' 
        AND constraint_name = 'fk_candlestick_contract'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE candlestick_data ADD CONSTRAINT fk_candlestick_contract 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to candlestick_data';
    END IF;
    
    -- Foreign key for tick_data
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'tick_data' 
        AND constraint_name = 'fk_tick_contract'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE tick_data ADD CONSTRAINT fk_tick_contract 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to tick_data';
    END IF;
    
    -- Foreign key for data_collection_sessions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'data_collection_sessions' 
        AND constraint_name = 'fk_sessions_contract'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE data_collection_sessions ADD CONSTRAINT fk_sessions_contract 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to data_collection_sessions';
    END IF;
    
    -- Foreign key for data_quality_metrics
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'data_quality_metrics' 
        AND constraint_name = 'fk_quality_contract'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE data_quality_metrics ADD CONSTRAINT fk_quality_contract 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to data_quality_metrics';
    END IF;
    
    -- Foreign key for data_collection_config
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'data_collection_config' 
        AND constraint_name = 'fk_config_contract'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE data_collection_config ADD CONSTRAINT fk_config_contract 
            FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to data_collection_config';
    END IF;
END $$;

-- ==============================================
-- CREATE ALL REQUIRED INDEXES
-- ==============================================

-- Contracts indexes
CREATE INDEX IF NOT EXISTS idx_contracts_symbol ON contracts(symbol);
CREATE INDEX IF NOT EXISTS idx_contracts_sec_type ON contracts(sec_type);
CREATE INDEX IF NOT EXISTS idx_contracts_exchange ON contracts(exchange);
CREATE INDEX IF NOT EXISTS idx_contracts_contract_id ON contracts(contract_id);

-- Candlestick data indexes (including connectivity test expected names)
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

-- Insert common contracts for testing
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
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'TradingApp Database Setup Complete!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Setup Summary:';
    RAISE NOTICE '- All tables created with proper structure';
    RAISE NOTICE '- TimescaleDB hypertables configured (if available)';
    RAISE NOTICE '- Composite primary keys added for TimescaleDB';
    RAISE NOTICE '- All required indexes created';
    RAISE NOTICE '- Foreign key constraints added';
    RAISE NOTICE '- Triggers and functions created';
    RAISE NOTICE '- Initial contract data inserted';
    RAISE NOTICE '- Views created for data access';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run database-verification.sql to verify setup';
    RAISE NOTICE 'Database is ready for TradingApp operations!';
END $$;
