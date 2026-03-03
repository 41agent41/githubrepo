-- =============================================================================
-- Migration: cTrader Connection Profiles
-- Description: Store cTrader OAuth connection profiles for multi-broker support.
--
-- Run: psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f migration-ctrader-connections.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS ctrader_connection_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    account_mode VARCHAR(10) NOT NULL CHECK (account_mode IN ('live', 'paper')),
    client_id VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT,
    redirect_uri VARCHAR(500),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    ctrader_account_id BIGINT,
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    last_connected_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ctrader_connection_profiles_active
    ON ctrader_connection_profiles (is_active) WHERE is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ctrader_connection_profiles_default
    ON ctrader_connection_profiles (is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_ctrader_connection_profiles_account_mode
    ON ctrader_connection_profiles (account_mode);

COMMENT ON TABLE ctrader_connection_profiles IS 'cTrader OAuth connection profiles - register app at openapi.ctrader.com';
