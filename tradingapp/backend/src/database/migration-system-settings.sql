-- =============================================================================
-- Migration: System Settings
-- Description: Browser-configurable system settings stored in database
-- This eliminates the need for most .env configuration
-- =============================================================================

-- System Settings Table
-- Stores all application configuration that can be modified via browser
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json', 'secret')),
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    is_readonly BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_category_key UNIQUE (category, key)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings (category);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings (category, key);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_system_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS trigger_update_system_settings_timestamp ON system_settings;
CREATE TRIGGER trigger_update_system_settings_timestamp
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_timestamp();

-- =============================================================================
-- DEFAULT SETTINGS
-- =============================================================================

-- CORS Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('cors', 'allowed_origins', '*', 'string', 'Comma-separated list of allowed CORS origins. Use * for all origins.', 1),
    ('cors', 'allow_credentials', 'true', 'boolean', 'Allow credentials in CORS requests', 2),
    ('cors', 'allowed_methods', 'GET,POST,PUT,DELETE,OPTIONS', 'string', 'Allowed HTTP methods', 3),
    ('cors', 'allowed_headers', '*', 'string', 'Allowed HTTP headers', 4)
ON CONFLICT (category, key) DO NOTHING;

-- Redis Settings (for caching)
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('redis', 'host', 'redis', 'string', 'Redis server hostname', 1),
    ('redis', 'port', '6379', 'number', 'Redis server port', 2),
    ('redis', 'password', '', 'secret', 'Redis password (leave empty if none)', 3),
    ('redis', 'enabled', 'true', 'boolean', 'Enable Redis caching', 4),
    ('redis', 'ttl_seconds', '3600', 'number', 'Default cache TTL in seconds', 5)
ON CONFLICT (category, key) DO NOTHING;

-- Security Settings
INSERT INTO system_settings (category, key, value, value_type, description, is_sensitive, display_order) VALUES
    ('security', 'jwt_secret', '', 'secret', 'JWT signing secret (auto-generated if empty)', TRUE, 1),
    ('security', 'session_secret', '', 'secret', 'Session encryption secret (auto-generated if empty)', TRUE, 2),
    ('security', 'jwt_expiry_hours', '24', 'number', 'JWT token expiry in hours', FALSE, 3),
    ('security', 'session_expiry_hours', '168', 'number', 'Session expiry in hours (default 7 days)', FALSE, 4),
    ('security', 'require_auth', 'false', 'boolean', 'Require authentication for API access', FALSE, 5)
ON CONFLICT (category, key) DO NOTHING;

-- Timezone Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('timezone', 'default_timezone', 'UTC', 'string', 'Default timezone for data display', 1),
    ('timezone', 'ib_timezone', 'UTC', 'string', 'IB Gateway timezone', 2),
    ('timezone', 'data_timezone', 'UTC', 'string', 'Market data timezone', 3),
    ('timezone', 'date_format', 'YYYY-MM-DD', 'string', 'Date display format', 4),
    ('timezone', 'time_format', 'HH:mm:ss', 'string', 'Time display format', 5)
ON CONFLICT (category, key) DO NOTHING;

-- Data Collection Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('data_collection', 'auto_collect_enabled', 'false', 'boolean', 'Enable automatic data collection', 1),
    ('data_collection', 'collection_interval_minutes', '5', 'number', 'Data collection interval in minutes', 2),
    ('data_collection', 'default_symbols', 'MSFT,AAPL,GOOGL', 'string', 'Default symbols for data collection (comma-separated)', 3),
    ('data_collection', 'default_timeframes', '5min,15min,1hour,1day', 'string', 'Default timeframes (comma-separated)', 4),
    ('data_collection', 'retention_days', '365', 'number', 'Data retention period in days', 5)
ON CONFLICT (category, key) DO NOTHING;

-- UI Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('ui', 'theme', 'dark', 'string', 'UI theme (dark/light)', 1),
    ('ui', 'default_chart_type', 'candlestick', 'string', 'Default chart type', 2),
    ('ui', 'show_volume', 'true', 'boolean', 'Show volume by default on charts', 3),
    ('ui', 'auto_refresh_seconds', '30', 'number', 'Auto-refresh interval for real-time data', 4),
    ('ui', 'max_chart_bars', '500', 'number', 'Maximum bars to display on chart', 5)
ON CONFLICT (category, key) DO NOTHING;

-- API Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('api', 'rate_limit_enabled', 'true', 'boolean', 'Enable API rate limiting', 1),
    ('api', 'rate_limit_requests', '100', 'number', 'Max requests per minute', 2),
    ('api', 'request_timeout_seconds', '60', 'number', 'API request timeout', 3),
    ('api', 'log_requests', 'true', 'boolean', 'Log API requests', 4)
ON CONFLICT (category, key) DO NOTHING;

-- Feature Flags
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('features', 'enable_live_trading', 'false', 'boolean', 'Enable live trading features (DANGEROUS)', 1),
    ('features', 'enable_backtesting', 'true', 'boolean', 'Enable backtesting features', 2),
    ('features', 'enable_strategies', 'true', 'boolean', 'Enable automated strategies', 3),
    ('features', 'enable_alerts', 'true', 'boolean', 'Enable price alerts', 4),
    ('features', 'enable_export', 'true', 'boolean', 'Enable data export', 5)
ON CONFLICT (category, key) DO NOTHING;

-- Notification Settings
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('notifications', 'email_enabled', 'false', 'boolean', 'Enable email notifications', 1),
    ('notifications', 'smtp_host', '', 'string', 'SMTP server host', 2),
    ('notifications', 'smtp_port', '587', 'number', 'SMTP server port', 3),
    ('notifications', 'smtp_user', '', 'string', 'SMTP username', 4),
    ('notifications', 'smtp_password', '', 'secret', 'SMTP password', 5),
    ('notifications', 'from_email', '', 'string', 'From email address', 6),
    ('notifications', 'alert_email', '', 'string', 'Email for alerts', 7)
ON CONFLICT (category, key) DO NOTHING;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View for non-sensitive settings (safe to expose to frontend)
CREATE OR REPLACE VIEW v_public_settings AS
SELECT 
    id, category, key, 
    CASE WHEN is_sensitive THEN '********' ELSE value END as value,
    value_type, description, is_sensitive, is_readonly, display_order,
    created_at, updated_at
FROM system_settings
ORDER BY category, display_order, key;

-- View for settings by category
CREATE OR REPLACE VIEW v_settings_categories AS
SELECT 
    category,
    COUNT(*) as setting_count,
    MAX(updated_at) as last_updated
FROM system_settings
GROUP BY category
ORDER BY category;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to get a setting value
CREATE OR REPLACE FUNCTION get_setting(p_category VARCHAR, p_key VARCHAR)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
BEGIN
    SELECT value INTO v_value
    FROM system_settings
    WHERE category = p_category AND key = p_key;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Function to set a setting value
CREATE OR REPLACE FUNCTION set_setting(p_category VARCHAR, p_key VARCHAR, p_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE system_settings
    SET value = p_value
    WHERE category = p_category AND key = p_key AND is_readonly = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get all settings for a category as JSON
CREATE OR REPLACE FUNCTION get_settings_json(p_category VARCHAR)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT jsonb_object_agg(key, value)
        FROM system_settings
        WHERE category = p_category
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE system_settings IS 'Browser-configurable system settings - replaces .env file';
COMMENT ON VIEW v_public_settings IS 'Public view of settings with sensitive values masked';
COMMENT ON FUNCTION get_setting IS 'Get a single setting value by category and key';
COMMENT ON FUNCTION set_setting IS 'Set a setting value (respects readonly flag)';
COMMENT ON FUNCTION get_settings_json IS 'Get all settings for a category as JSON object';

