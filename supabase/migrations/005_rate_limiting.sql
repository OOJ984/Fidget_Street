-- ============================================
-- Rate Limiting Migration
-- Persistent rate limiting using database
-- ============================================

-- Rate limits table for tracking login attempts
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,                    -- 'email:user@example.com' or 'ip:1.2.3.4'
    attempts INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    reset_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on key for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);

-- Index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role only
CREATE POLICY "Service role can manage rate limits" ON rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Function to check rate limit (returns true if allowed)
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_attempts INTEGER,
    p_lockout_minutes INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    retry_after_seconds INTEGER,
    current_attempts INTEGER
) AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Try to get existing record
    SELECT * INTO v_record FROM rate_limits WHERE key = p_key;

    -- If no record or expired, allow
    IF v_record IS NULL OR v_record.reset_at <= v_now THEN
        RETURN QUERY SELECT
            TRUE::BOOLEAN,
            0::INTEGER,
            0::INTEGER;
        RETURN;
    END IF;

    -- Check if over limit
    IF v_record.attempts >= p_max_attempts THEN
        RETURN QUERY SELECT
            FALSE::BOOLEAN,
            EXTRACT(EPOCH FROM (v_record.reset_at - v_now))::INTEGER,
            v_record.attempts::INTEGER;
        RETURN;
    END IF;

    -- Under limit, allow
    RETURN QUERY SELECT
        TRUE::BOOLEAN,
        0::INTEGER,
        v_record.attempts::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record failed attempt
CREATE OR REPLACE FUNCTION record_failed_attempt(
    p_key TEXT,
    p_lockout_minutes INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_attempts INTEGER;
    v_now TIMESTAMPTZ := NOW();
    v_reset_at TIMESTAMPTZ := v_now + (p_lockout_minutes * INTERVAL '1 minute');
BEGIN
    INSERT INTO rate_limits (key, attempts, first_attempt, reset_at)
    VALUES (p_key, 1, v_now, v_reset_at)
    ON CONFLICT (key) DO UPDATE SET
        attempts = CASE
            WHEN rate_limits.reset_at <= v_now THEN 1
            ELSE rate_limits.attempts + 1
        END,
        first_attempt = CASE
            WHEN rate_limits.reset_at <= v_now THEN v_now
            ELSE rate_limits.first_attempt
        END,
        reset_at = CASE
            WHEN rate_limits.reset_at <= v_now THEN v_reset_at
            ELSE rate_limits.reset_at
        END
    RETURNING attempts INTO v_attempts;

    RETURN v_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear rate limit on successful login
CREATE OR REPLACE FUNCTION clear_rate_limit(p_key TEXT) RETURNS VOID AS $$
BEGIN
    DELETE FROM rate_limits WHERE key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired entries (call periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits() RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limits WHERE reset_at < NOW();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
