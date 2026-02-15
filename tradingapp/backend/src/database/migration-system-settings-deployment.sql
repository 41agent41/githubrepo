-- =============================================================================
-- Migration: Add Deployment/Server category to System Settings
-- Description: Move server IP, ports, and service URLs from .env into System Settings
-- so all required config (except DB connection) can be managed from the browser.
--
-- Prerequisite: Run migration-system-settings.sql first (creates system_settings table).
-- Run: psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f migration-system-settings-deployment.sql
-- =============================================================================

-- Deployment / Server Settings (replaces SERVER_IP, ports, IB_SERVICE_URL, FRONTEND_URL in .env)
INSERT INTO system_settings (category, key, value, value_type, description, display_order) VALUES
    ('deployment', 'server_ip', '', 'string', 'Server IP or hostname for links and Docker (e.g. 10.7.3.20). Used in docs and scripts.', 1),
    ('deployment', 'frontend_port', '3000', 'number', 'Frontend port', 2),
    ('deployment', 'backend_port', '4000', 'number', 'Backend API port', 3),
    ('deployment', 'ib_service_port', '8000', 'number', 'IB service port', 4),
    ('deployment', 'ib_service_url', 'http://ib_service:8000', 'string', 'IB service base URL (use hostname when backend calls it, e.g. http://ib_service:8000 in Docker)', 5),
    ('deployment', 'frontend_url', 'http://localhost:3000', 'string', 'Frontend base URL for redirects and links (e.g. http://10.7.3.20:3000)', 6)
ON CONFLICT (category, key) DO NOTHING;

COMMENT ON TABLE system_settings IS 'Browser-configurable system settings. Only database connection (POSTGRES_*) must remain in .env for bootstrap.';
