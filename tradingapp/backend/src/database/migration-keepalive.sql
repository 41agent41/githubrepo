-- Migration: Add keep-alive support for IB connections
-- This allows automatic connection health checks and reconnection

-- Add keep_alive_interval_minutes column to ib_connection_profiles
ALTER TABLE ib_connection_profiles 
ADD COLUMN IF NOT EXISTS keep_alive_interval_minutes INTEGER NOT NULL DEFAULT 15 
CHECK (keep_alive_interval_minutes >= 0 AND keep_alive_interval_minutes <= 60);

-- Add keep_alive event type to connection history
-- First, drop and recreate the constraint to include the new event type
ALTER TABLE ib_connection_history 
DROP CONSTRAINT IF EXISTS ib_connection_history_event_type_check;

ALTER TABLE ib_connection_history 
ADD CONSTRAINT ib_connection_history_event_type_check 
CHECK (event_type IN (
    'connect_attempt',
    'connect_success',
    'connect_failure',
    'disconnect',
    'reconnect',
    'timeout',
    'error',
    'keep_alive',
    'keep_alive_reconnect'
));

-- Update default profiles to have keep_alive enabled (15 minutes is already the default)
-- No action needed as the default is already 15

COMMENT ON COLUMN ib_connection_profiles.keep_alive_interval_minutes IS 
'Interval in minutes for keep-alive checks. Set to 0 to disable. Default is 15 minutes.';

-- Add index for quick lookup of profiles that need keep-alive
CREATE INDEX IF NOT EXISTS idx_ib_connection_profiles_keepalive 
ON ib_connection_profiles (is_active, keep_alive_interval_minutes) 
WHERE is_active = TRUE AND keep_alive_interval_minutes > 0;
