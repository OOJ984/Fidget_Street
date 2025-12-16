-- ============================================
-- Performance Indexes Migration
-- Adds missing indexes for common query patterns
-- ============================================

-- Index for webhook lookups (Stripe/PayPal payment verification)
-- Used when payment providers send webhook callbacks
CREATE INDEX IF NOT EXISTS idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;

-- Composite index for customer order history queries
-- Optimizes: SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_created_at ON orders(customer_email, created_at DESC);

-- Index for admin user login lookups
-- Note: email is UNIQUE which creates implicit index, but explicit index ensures optimizer uses it
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- Index for admin user active status checks (login validation)
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(email) WHERE is_active = true;
