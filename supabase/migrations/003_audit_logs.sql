-- ============================================
-- Audit Logs Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES admin_users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access audit logs
CREATE POLICY "Service role can manage audit logs" ON audit_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Audit Action Types Reference
-- ============================================
--
-- Authentication:
--   - login_success
--   - login_failed
--   - logout
--   - mfa_setup
--   - mfa_verified
--   - password_changed
--
-- Products:
--   - product_created
--   - product_updated
--   - product_deleted
--
-- Orders:
--   - order_status_updated
--
-- Media:
--   - media_uploaded
--   - media_deleted
--   - media_renamed
--
-- Settings:
--   - settings_updated
--   - settings_reset
--
-- Users:
--   - user_created
--   - user_updated
--   - user_deactivated
--   - user_role_changed
--
-- ============================================

COMMENT ON TABLE audit_logs IS 'Tracks all admin actions for security and compliance';
COMMENT ON COLUMN audit_logs.action IS 'Action type (e.g., login_success, product_created)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (e.g., product, order, user)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_logs.details IS 'Additional context as JSON (e.g., changed fields, old/new values)';
