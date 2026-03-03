-- =============================================================================
-- Migration: Rename ib_order_id to broker_order_id
-- Description: Multi-broker support - use generic broker_order_id column name.
--
-- Run: psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f migration-rename-ib-order-id.sql
-- =============================================================================

-- Rename column
ALTER TABLE order_executions RENAME COLUMN ib_order_id TO broker_order_id;

-- Update index
DROP INDEX IF EXISTS idx_orders_ib_order_id;
CREATE INDEX IF NOT EXISTS idx_orders_broker_order_id ON order_executions(broker_order_id);

COMMENT ON COLUMN order_executions.broker_order_id IS 'Broker-specific order ID (e.g. IB permId, cTrader order ID)';
