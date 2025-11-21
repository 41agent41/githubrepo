-- Migration: Phase 2 - Strategy Signals and Order Executions
-- This migration adds tables for strategy signals and order execution tracking

-- Strategy signals table
CREATE TABLE IF NOT EXISTS strategy_signals (
    id BIGSERIAL PRIMARY KEY,
    setup_id INTEGER REFERENCES trading_setups(id) ON DELETE CASCADE,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    strategy_name VARCHAR(50) NOT NULL,
    signal_type VARCHAR(10) NOT NULL, -- BUY, SELL, HOLD
    price DECIMAL(20,8),
    confidence DECIMAL(5,4), -- 0.0000 to 1.0000
    indicator_values JSONB, -- Store relevant indicator values at signal time
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_signal_type CHECK (signal_type IN ('BUY', 'SELL', 'HOLD')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
    UNIQUE(setup_id, timeframe, timestamp, strategy_name)
);

-- Order execution table
CREATE TABLE IF NOT EXISTS order_executions (
    id BIGSERIAL PRIMARY KEY,
    setup_id INTEGER REFERENCES trading_setups(id) ON DELETE SET NULL,
    signal_id BIGINT REFERENCES strategy_signals(id) ON DELETE SET NULL,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    order_type VARCHAR(10) NOT NULL, -- MARKET, LIMIT, STOP
    action VARCHAR(10) NOT NULL, -- BUY, SELL
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    ib_order_id INTEGER, -- IB Gateway order ID
    status VARCHAR(20) DEFAULT 'pending', -- pending, filled, cancelled, rejected, partial
    filled_quantity DECIMAL(20,8),
    avg_fill_price DECIMAL(20,8),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_order_type CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
    CONSTRAINT valid_action CHECK (action IN ('BUY', 'SELL')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'submitted', 'filled', 'cancelled', 'rejected', 'partial'))
);

-- Indexes for strategy_signals
CREATE INDEX IF NOT EXISTS idx_signals_setup_timeframe ON strategy_signals(setup_id, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_contract_timeframe ON strategy_signals(contract_id, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type ON strategy_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON strategy_signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_strategy ON strategy_signals(strategy_name);

-- Indexes for order_executions
CREATE INDEX IF NOT EXISTS idx_orders_setup ON order_executions(setup_id);
CREATE INDEX IF NOT EXISTS idx_orders_signal ON order_executions(signal_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON order_executions(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON order_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_contract ON order_executions(contract_id);
CREATE INDEX IF NOT EXISTS idx_orders_ib_order_id ON order_executions(ib_order_id);

-- Function to update updated_at timestamp for order_executions
CREATE OR REPLACE FUNCTION update_order_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at column
DROP TRIGGER IF EXISTS update_order_executions_updated_at ON order_executions;
CREATE TRIGGER update_order_executions_updated_at 
    BEFORE UPDATE ON order_executions 
    FOR EACH ROW EXECUTE FUNCTION update_order_executions_updated_at();

-- View for recent strategy signals
CREATE OR REPLACE VIEW recent_strategy_signals AS
SELECT 
    ss.*,
    ts.symbol,
    ts.timeframes,
    c.sec_type,
    c.exchange,
    c.currency
FROM strategy_signals ss
JOIN trading_setups ts ON ss.setup_id = ts.id
LEFT JOIN contracts c ON ss.contract_id = c.id
WHERE ss.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY ss.timestamp DESC;

-- View for active orders
CREATE OR REPLACE VIEW active_orders AS
SELECT 
    oe.*,
    ts.symbol,
    c.sec_type,
    c.exchange,
    ss.strategy_name,
    ss.signal_type
FROM order_executions oe
LEFT JOIN trading_setups ts ON oe.setup_id = ts.id
LEFT JOIN contracts c ON oe.contract_id = c.id
LEFT JOIN strategy_signals ss ON oe.signal_id = ss.id
WHERE oe.status IN ('pending', 'submitted', 'partial')
ORDER BY oe.created_at DESC;

-- View for order history
CREATE OR REPLACE VIEW order_history AS
SELECT 
    oe.*,
    ts.symbol,
    c.sec_type,
    c.exchange,
    ss.strategy_name,
    ss.signal_type,
    CASE 
        WHEN oe.status = 'filled' AND oe.avg_fill_price IS NOT NULL AND oe.price IS NOT NULL
        THEN (oe.avg_fill_price - oe.price) * oe.filled_quantity * CASE WHEN oe.action = 'BUY' THEN -1 ELSE 1 END
        ELSE NULL
    END as price_difference
FROM order_executions oe
LEFT JOIN trading_setups ts ON oe.setup_id = ts.id
LEFT JOIN contracts c ON oe.contract_id = c.id
LEFT JOIN strategy_signals ss ON oe.signal_id = ss.id
WHERE oe.status IN ('filled', 'cancelled', 'rejected')
ORDER BY oe.created_at DESC;

-- Verification queries
SELECT 
    'strategy_signals table' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'strategy_signals') 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

SELECT 
    'order_executions table' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_executions') 
        THEN 'PASS' 
        ELSE 'FAIL' 
    END as status;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Phase 2 Database Migration Completed!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- strategy_signals table';
    RAISE NOTICE '- order_executions table';
    RAISE NOTICE '- Indexes for performance';
    RAISE NOTICE '- Triggers for updated_at';
    RAISE NOTICE '- Views for data access';
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 2 tables are ready for use!';
END $$;

