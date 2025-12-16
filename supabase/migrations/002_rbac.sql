-- ============================================
-- RBAC Migration - Role-Based Access Control
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Update existing roles FIRST (before adding constraint)
-- First drop the old constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Update existing 'admin' and 'super_admin' users to 'website_admin' BEFORE adding new constraint
UPDATE admin_users SET role = 'website_admin' WHERE role = 'admin';
UPDATE admin_users SET role = 'website_admin' WHERE role = 'super_admin';
UPDATE admin_users SET role = 'website_admin' WHERE role IS NULL;

-- Set default role
ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'website_admin';

-- NOW add new role constraint (after rows are updated)
ALTER TABLE admin_users
ADD CONSTRAINT admin_users_role_check
CHECK (role IN ('business_processing', 'website_admin'));

-- Step 2: Add new columns to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_backup_codes TEXT[];
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 3: Create customers table (separate from admin_users)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    is_verified BOOLEAN DEFAULT false,
    magic_link_token TEXT,
    magic_link_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Step 4: Link orders to customers (optional - for future use)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Step 5: Create index for customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_magic_link ON customers(magic_link_token) WHERE magic_link_token IS NOT NULL;

-- Step 6: Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Customers: Service role only (customers access via magic link verification)
CREATE POLICY "Service role can manage customers" ON customers
    FOR ALL USING (auth.role() = 'service_role');

-- Step 7: Apply updated_at trigger to admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Role Permissions Reference (for documentation)
-- ============================================
--
-- business_processing:
--   - View all orders ✓
--   - Update order status ✓
--   - View all products ✓
--   - Add/edit/delete products ✓
--   - Manage product images ✓
--   - Set prices ✓
--   - View reports ✓
--   - Manage website settings ✗
--   - Manage users ✗
--   - View audit logs ✗
--
-- website_admin:
--   - All business_processing permissions ✓
--   - Manage website settings ✓
--   - Manage users ✓
--   - View audit logs ✓
--
-- customer (via magic link):
--   - View own orders only ✓
--
-- ============================================

COMMENT ON TABLE admin_users IS 'Staff users with business_processing or website_admin roles';
COMMENT ON TABLE customers IS 'Customer accounts for order tracking via magic link';
COMMENT ON COLUMN admin_users.role IS 'business_processing: products/orders, website_admin: full access';
COMMENT ON COLUMN admin_users.mfa_enabled IS 'MFA is mandatory - must be true to access admin';
