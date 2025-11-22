-- Migration: Phase 4 - Database Views and Additional Indexes
-- This migration adds views and ensures all indexes are created

-- Ensure trading_setups indexes exist (in case they weren't created in Phase 1)
CREATE INDEX IF NOT EXISTS idx_setups_symbol ON trading_setups(symbol);
CREATE INDEX IF NOT EXISTS idx_setups_status ON trading_setups(status);
CREATE INDEX IF NOT EXISTS idx_setups_port ON trading_setups(port);
CREATE INDEX IF NOT EXISTS idx_setups_contract_id ON trading_setups(contract_id);
CREATE INDEX IF NOT EXISTS idx_setups_created_at ON trading_setups(created_at DESC);

-- Active trading setups view (replace existing simple view with enhanced version)
DROP VIEW IF EXISTS active_trading_setups;
CREATE VIEW active_trading_setups AS
SELECT 
    ts.id,
    ts.symbol,
    ts.contract_id,
    ts.timeframes,
    ts.indicators,
    ts.strategies,
    ts.port,
    ts.status,
    ts.account_mode,
    ts.created_at,
    ts.updated_at,
    c.sec_type,
    c.exchange,
    c.currency,
    COUNT(DISTINCT ss.id) as signal_count,
    MAX(ss.timestamp) as last_signal_time,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status IN ('pending', 'submitted', 'partial')) as active_orders_count,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'filled') as filled_orders_count
FROM trading_setups ts
LEFT JOIN contracts c ON ts.contract_id = c.id
LEFT JOIN strategy_signals ss ON ts.id = ss.setup_id
LEFT JOIN order_executions oe ON ts.id = oe.setup_id
WHERE ts.status = 'active'
GROUP BY ts.id, ts.symbol, ts.contract_id, ts.timeframes, ts.indicators, ts.strategies, 
         ts.port, ts.status, ts.account_mode, ts.created_at, ts.updated_at,
         c.sec_type, c.exchange, c.currency;

-- Enhanced recent signals view (already exists but ensure it's correct)
CREATE OR REPLACE VIEW recent_strategy_signals AS
SELECT 
    ss.id,
    ss.setup_id,
    ss.contract_id,
    ss.timeframe,
    ss.timestamp,
    ss.strategy_name,
    ss.signal_type,
    ss.price,
    ss.confidence,
    ss.indicator_values,
    ss.created_at,
    ts.symbol,
    ts.timeframes as setup_timeframes,
    c.sec_type,
    c.exchange,
    c.currency
FROM strategy_signals ss
LEFT JOIN trading_setups ts ON ss.setup_id = ts.id
LEFT JOIN contracts c ON ss.contract_id = c.id
WHERE ss.timestamp >= NOW() - INTERVAL '7 days'
ORDER BY ss.timestamp DESC;

-- Setup performance summary view
CREATE OR REPLACE VIEW setup_performance_summary AS
SELECT 
    ts.id as setup_id,
    ts.symbol,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.signal_type = 'BUY') as total_buy_signals,
    COUNT(DISTINCT ss.id) FILTER (WHERE ss.signal_type = 'SELL') as total_sell_signals,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'filled') as filled_orders,
    COUNT(DISTINCT oe.id) FILTER (WHERE oe.status = 'cancelled') as cancelled_orders,
    SUM(oe.filled_quantity * oe.avg_fill_price) FILTER (WHERE oe.status = 'filled') as total_trade_value,
    AVG(oe.avg_fill_price) FILTER (WHERE oe.status = 'filled' AND oe.action = 'BUY') as avg_buy_price,
    AVG(oe.avg_fill_price) FILTER (WHERE oe.status = 'filled' AND oe.action = 'SELL') as avg_sell_price,
    MAX(ss.timestamp) as last_signal_time,
    MAX(oe.created_at) as last_order_time
FROM trading_setups ts
LEFT JOIN strategy_signals ss ON ts.id = ss.setup_id
LEFT JOIN order_executions oe ON ts.id = oe.setup_id
GROUP BY ts.id, ts.symbol;

-- Strategy signal performance view
CREATE OR REPLACE VIEW strategy_performance AS
SELECT 
    strategy_name,
    signal_type,
    COUNT(*) as signal_count,
    AVG(confidence) as avg_confidence,
    MIN(confidence) as min_confidence,
    MAX(confidence) as max_confidence,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '24 hours') as signals_last_24h,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days') as signals_last_7d,
    COUNT(*) FILTER (WHERE timestamp >= NOW() - INTERVAL '30 days') as signals_last_30d,
    AVG(price) as avg_price,
    MIN(timestamp) as first_signal,
    MAX(timestamp) as last_signal
FROM strategy_signals
GROUP BY strategy_name, signal_type
ORDER BY signal_count DESC;

-- Order execution summary view
CREATE OR REPLACE VIEW order_execution_summary AS
SELECT 
    status,
    action,
    order_type,
    COUNT(*) as order_count,
    SUM(quantity) as total_quantity,
    AVG(price) as avg_price,
    SUM(filled_quantity) FILTER (WHERE filled_quantity IS NOT NULL) as total_filled_quantity,
    AVG(avg_fill_price) FILTER (WHERE avg_fill_price IS NOT NULL) as avg_fill_price,
    MIN(created_at) as first_order,
    MAX(created_at) as last_order
FROM order_executions
GROUP BY status, action, order_type
ORDER BY order_count DESC;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Phase 4 Database Migration Completed!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Created/Updated:';
    RAISE NOTICE '- active_trading_setups view';
    RAISE NOTICE '- recent_strategy_signals view';
    RAISE NOTICE '- setup_performance_summary view';
    RAISE NOTICE '- strategy_performance view';
    RAISE NOTICE '- order_execution_summary view';
    RAISE NOTICE '- Additional indexes for performance';
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 4 database views are ready for use!';
END $$;

