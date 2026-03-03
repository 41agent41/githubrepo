-- =============================================================================
-- Migration: Add cTrader and MT5 service URLs to System Settings
-- Description: Enables UI configuration of broker service URLs for multi-broker support.
-- Used by getBrokerServiceUrl(brokerType) in runtimeConfig.ts.
--
-- Prerequisite: Run migration-system-settings-deployment.sql first.
-- Run: psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f migration-broker-service-urls.sql
-- =============================================================================

INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('deployment', 'ctrader_service_url', 'http://ctrader_service:8002', 'string', 'cTrader service base URL (e.g. http://ctrader_service:8002 in Docker)', 7),
    ('deployment', 'mt5_service_url', 'http://mt5_service:8001', 'string', 'MetaTrader 5 service base URL (e.g. http://mt5_service:8001 in Docker)', 8)
ON CONFLICT (category, key) DO NOTHING;
