-- Migration: MFA Rate Limiting
-- Provides database-backed rate limiting for MFA attempts
-- This survives serverless function cold starts and scales across instances

-- Create MFA rate limits table
CREATE TABLE IF NOT EXISTS mfa_rate_limits (
    user_id INTEGER PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    first_attempt_at TIMESTAMPTZ,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_mfa_rate_limits_locked_until
    ON mfa_rate_limits(locked_until)
    WHERE locked_until IS NOT NULL;

-- Function to check and update MFA rate limit
-- Returns: { allowed: boolean, remaining_attempts: number, locked_until: timestamp|null }
CREATE OR REPLACE FUNCTION check_mfa_rate_limit(
    p_user_id INTEGER,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15,
    p_window_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
    v_record mfa_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_window_start TIMESTAMPTZ := v_now - (p_window_minutes || ' minutes')::INTERVAL;
BEGIN
    -- Get or create rate limit record
    INSERT INTO mfa_rate_limits (user_id, attempt_count, first_attempt_at)
    VALUES (p_user_id, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_record FROM mfa_rate_limits WHERE user_id = p_user_id FOR UPDATE;

    -- Check if currently locked out
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining_attempts', 0,
            'locked_until', v_record.locked_until,
            'reason', 'locked'
        );
    END IF;

    -- Reset if lockout expired or window expired
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= v_now THEN
        UPDATE mfa_rate_limits
        SET attempt_count = 0, first_attempt_at = NULL, locked_until = NULL, updated_at = v_now
        WHERE user_id = p_user_id;
        v_record.attempt_count := 0;
        v_record.first_attempt_at := NULL;
    ELSIF v_record.first_attempt_at IS NOT NULL AND v_record.first_attempt_at < v_window_start THEN
        UPDATE mfa_rate_limits
        SET attempt_count = 0, first_attempt_at = NULL, updated_at = v_now
        WHERE user_id = p_user_id;
        v_record.attempt_count := 0;
        v_record.first_attempt_at := NULL;
    END IF;

    -- Return current state (allowed to attempt)
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining_attempts', p_max_attempts - v_record.attempt_count,
        'locked_until', NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record a failed MFA attempt
-- Returns: { locked: boolean, locked_until: timestamp|null, remaining_attempts: number }
CREATE OR REPLACE FUNCTION record_mfa_failure(
    p_user_id INTEGER,
    p_max_attempts INTEGER DEFAULT 5,
    p_lockout_minutes INTEGER DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
    v_record mfa_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_new_count INTEGER;
    v_locked_until TIMESTAMPTZ;
BEGIN
    -- Increment attempt count
    UPDATE mfa_rate_limits
    SET
        attempt_count = attempt_count + 1,
        first_attempt_at = COALESCE(first_attempt_at, v_now),
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_record;

    v_new_count := v_record.attempt_count;

    -- Check if should be locked
    IF v_new_count >= p_max_attempts THEN
        v_locked_until := v_now + (p_lockout_minutes || ' minutes')::INTERVAL;
        UPDATE mfa_rate_limits
        SET locked_until = v_locked_until, updated_at = v_now
        WHERE user_id = p_user_id;

        RETURN jsonb_build_object(
            'locked', true,
            'locked_until', v_locked_until,
            'remaining_attempts', 0
        );
    END IF;

    RETURN jsonb_build_object(
        'locked', false,
        'locked_until', NULL,
        'remaining_attempts', p_max_attempts - v_new_count
    );
END;
$$ LANGUAGE plpgsql;

-- Function to clear rate limit on successful MFA
CREATE OR REPLACE FUNCTION clear_mfa_rate_limit(p_user_id INTEGER) RETURNS VOID AS $$
BEGIN
    UPDATE mfa_rate_limits
    SET attempt_count = 0, first_attempt_at = NULL, locked_until = NULL, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_mfa_rate_limits() RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM mfa_rate_limits
    WHERE updated_at < NOW() - INTERVAL '24 hours'
    AND locked_until IS NULL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_rate_limits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_rate_limits TO service_role;

COMMENT ON TABLE mfa_rate_limits IS 'Tracks MFA verification attempts for rate limiting';
COMMENT ON FUNCTION check_mfa_rate_limit IS 'Check if user is allowed to attempt MFA verification';
COMMENT ON FUNCTION record_mfa_failure IS 'Record a failed MFA attempt and potentially trigger lockout';
COMMENT ON FUNCTION clear_mfa_rate_limit IS 'Clear rate limit after successful MFA verification';
