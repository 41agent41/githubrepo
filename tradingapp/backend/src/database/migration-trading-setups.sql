-- Migration: Add trading_setups table for Phase 1
-- This migration adds the trading_setups table required for the trading setup configuration feature

-- Trading setups table
CREATE TABLE IF NOT EXISTS trading_setups (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
    timeframes TEXT[] NOT NULL, -- Array of timeframes: ['5min', '15min', '1hour', etc.]
    indicators TEXT[], -- Array of indicator names: ['sma_20', 'rsi', 'macd', etc.]
    strategies TEXT[], -- Array of strategy names: ['ma_crossover', 'rsi_strategy', etc.]
    port INTEGER UNIQUE, -- Allocated port for chart spawning
    status VARCHAR(20) DEFAULT 'active', -- active, paused, stopped
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'paused', 'stopped'))
);

-- Indexes for trading_setups
CREATE INDEX IF NOT EXISTS idx_setups_symbol ON trading_setups(symbol);
CREATE INDEX IF NOT EXISTS idx_setups_status ON trading_setups(status);
CREATE INDEX IF NOT EXISTS idx_setups_port ON trading_setups(port);
CREATE INDEX IF NOT EXISTS idx_setups_contract ON trading_setups(contract_id);
CREATE INDEX IF NOT EXISTS idx_setups_created ON trading_setups(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trading_setups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at column
DROP TRIGGER IF EXISTS update_trading_setups_updated_at ON trading_setups;
CREATE TRIGGER update_trading_setups_updated_at 
    BEFORE UPDATE ON trading_setups 
    FOR EACH ROW EXECUTE FUNCTION update_trading_setups_updated_at();

-- View for active setups
CREATE OR REPLACE VIEW active_trading_setups AS
SELECT 
    ts.*,
    c.symbol as contract_symbol,
    c.sec_type,
    c.exchange,
    c.currency
FROM trading_setups ts
LEFT JOIN contracts c ON ts.contract_id = c.id
WHERE ts.status = 'active'
ORDER BY ts.created_at DESC;

-- Verification query
SELECT 
    'trading_setups table' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trading_setups') 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Trading Setups Migration Completed!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- trading_setups table';
    RAISE NOTICE '- Indexes for performance';
    RAISE NOTICE '- Trigger for updated_at';
    RAISE NOTICE '- View for active setups';
    RAISE NOTICE '';
    RAISE NOTICE 'The trading_setups table is ready for use!';
END $$;

