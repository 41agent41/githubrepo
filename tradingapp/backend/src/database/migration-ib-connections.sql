-- =============================================================================
-- Migration: IB Connection Profiles
-- Description: Adds support for multiple IB Gateway/TWS connection configurations
-- =============================================================================

-- IB Connection Profiles Table
-- Stores multiple connection configurations for IB Gateway and TWS
CREATE TABLE IF NOT EXISTS ib_connection_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Connection Type
    connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('gateway', 'tws')),
    account_mode VARCHAR(10) NOT NULL CHECK (account_mode IN ('live', 'paper')),
    
    -- Network Configuration
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port < 65536),
    client_id INTEGER NOT NULL DEFAULT 1 CHECK (client_id > 0),
    
    -- Connection Settings
    timeout_seconds INTEGER NOT NULL DEFAULT 15 CHECK (timeout_seconds > 0),
    auto_reconnect BOOLEAN NOT NULL DEFAULT TRUE,
    max_retry_attempts INTEGER NOT NULL DEFAULT 3,
    
    -- Timezone Configuration
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    date_format VARCHAR(20) NOT NULL DEFAULT 'YYYYMMDD',
    time_format VARCHAR(20) NOT NULL DEFAULT 'HHMMSS',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    connection_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ensure only one profile can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_ib_connection_profiles_active 
    ON ib_connection_profiles (is_active) 
    WHERE is_active = TRUE;

-- Ensure only one profile can be default
CREATE UNIQUE INDEX IF NOT EXISTS idx_ib_connection_profiles_default 
    ON ib_connection_profiles (is_default) 
    WHERE is_default = TRUE;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ib_connection_profiles_type_mode 
    ON ib_connection_profiles (connection_type, account_mode);

-- Connection History Table
-- Tracks connection attempts and status changes
CREATE TABLE IF NOT EXISTS ib_connection_history (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES ib_connection_profiles(id) ON DELETE CASCADE,
    
    -- Connection Event
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'connect_attempt', 
        'connect_success', 
        'connect_failure', 
        'disconnect', 
        'reconnect',
        'timeout',
        'error'
    )),
    
    -- Event Details
    details JSONB,
    error_message TEXT,
    error_code INTEGER,
    
    -- Timing
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    duration_ms INTEGER
);

-- Index for querying connection history
CREATE INDEX IF NOT EXISTS idx_ib_connection_history_profile 
    ON ib_connection_history (profile_id, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ib_connection_history_type 
    ON ib_connection_history (event_type, event_timestamp DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ib_connection_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_ib_connection_profile_timestamp ON ib_connection_profiles;
CREATE TRIGGER trigger_update_ib_connection_profile_timestamp
    BEFORE UPDATE ON ib_connection_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_ib_connection_profile_timestamp();

-- Function to ensure only one active profile
CREATE OR REPLACE FUNCTION ensure_single_active_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE ib_connection_profiles 
        SET is_active = FALSE 
        WHERE id != NEW.id AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for single active profile
DROP TRIGGER IF EXISTS trigger_ensure_single_active_profile ON ib_connection_profiles;
CREATE TRIGGER trigger_ensure_single_active_profile
    BEFORE INSERT OR UPDATE ON ib_connection_profiles
    FOR EACH ROW
    WHEN (NEW.is_active = TRUE)
    EXECUTE FUNCTION ensure_single_active_profile();

-- Insert default connection profiles
INSERT INTO ib_connection_profiles (
    name, 
    description, 
    connection_type, 
    account_mode, 
    host, 
    port, 
    client_id,
    is_default
) VALUES 
    (
        'IB Gateway - Paper',
        'Default paper trading connection via IB Gateway',
        'gateway',
        'paper',
        'localhost',
        4002,
        1,
        TRUE
    ),
    (
        'IB Gateway - Live',
        'Live trading connection via IB Gateway',
        'gateway',
        'live',
        'localhost',
        4001,
        2,
        FALSE
    ),
    (
        'TWS - Paper',
        'Paper trading connection via Trader Workstation',
        'tws',
        'paper',
        'localhost',
        7497,
        3,
        FALSE
    ),
    (
        'TWS - Live',
        'Live trading connection via Trader Workstation',
        'tws',
        'live',
        'localhost',
        7496,
        4,
        FALSE
    )
ON CONFLICT (name) DO NOTHING;

-- View for current active connection
CREATE OR REPLACE VIEW v_active_ib_connection AS
SELECT 
    p.*,
    CASE 
        WHEN p.last_connected_at IS NOT NULL 
             AND p.last_connected_at > NOW() - INTERVAL '5 minutes'
             AND p.last_error IS NULL
        THEN 'connected'
        WHEN p.last_error IS NOT NULL 
        THEN 'error'
        ELSE 'disconnected'
    END as connection_status
FROM ib_connection_profiles p
WHERE p.is_active = TRUE;

-- View for connection statistics
CREATE OR REPLACE VIEW v_ib_connection_stats AS
SELECT 
    p.id,
    p.name,
    p.connection_type,
    p.account_mode,
    p.connection_count,
    p.last_connected_at,
    COUNT(h.id) as total_events,
    COUNT(CASE WHEN h.event_type = 'connect_success' THEN 1 END) as successful_connections,
    COUNT(CASE WHEN h.event_type = 'connect_failure' THEN 1 END) as failed_connections,
    COUNT(CASE WHEN h.event_type = 'error' THEN 1 END) as errors,
    MAX(h.event_timestamp) as last_event
FROM ib_connection_profiles p
LEFT JOIN ib_connection_history h ON p.id = h.profile_id
GROUP BY p.id, p.name, p.connection_type, p.account_mode, p.connection_count, p.last_connected_at;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ib_connection_profiles TO tradingapp;
-- GRANT ALL PRIVILEGES ON ib_connection_history TO tradingapp;
-- GRANT USAGE, SELECT ON SEQUENCE ib_connection_profiles_id_seq TO tradingapp;
-- GRANT USAGE, SELECT ON SEQUENCE ib_connection_history_id_seq TO tradingapp;

COMMENT ON TABLE ib_connection_profiles IS 'Stores IB Gateway and TWS connection configurations';
COMMENT ON TABLE ib_connection_history IS 'Tracks connection events and history for each profile';
COMMENT ON VIEW v_active_ib_connection IS 'Shows the currently active IB connection profile with status';
COMMENT ON VIEW v_ib_connection_stats IS 'Provides connection statistics for each profile';

