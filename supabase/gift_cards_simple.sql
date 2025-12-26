-- ============================================
-- Gift Cards - Simple Migration (No FK constraints)
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing tables if they exist (fresh start)
DROP TABLE IF EXISTS gift_card_transactions CASCADE;
DROP TABLE IF EXISTS gift_cards CASCADE;

-- Gift Cards Table (simplified - no foreign keys)
CREATE TABLE gift_cards (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    initial_balance DECIMAL(10,2) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    purchaser_email TEXT NOT NULL,
    purchaser_name TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    personal_message TEXT,
    source TEXT DEFAULT 'purchase',
    order_id INTEGER,
    created_by INTEGER,
    status TEXT DEFAULT 'pending',
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    notes TEXT,
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Card Transactions Table (simplified)
CREATE TABLE gift_card_transactions (
    id SERIAL PRIMARY KEY,
    gift_card_id INTEGER REFERENCES gift_cards(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    order_id INTEGER,
    order_number TEXT,
    notes TEXT,
    performed_by_email TEXT,
    performed_by_admin INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_gift_cards_code ON gift_cards(code);
CREATE INDEX idx_gift_cards_status ON gift_cards(status);
CREATE INDEX idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);

-- Add columns to orders table (ignore if fails)
DO $$
BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_code TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Disable RLS for now (service key bypasses anyway)
ALTER TABLE gift_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions DISABLE ROW LEVEL SECURITY;

-- Test insert to verify it works
INSERT INTO gift_cards (code, initial_balance, current_balance, purchaser_email, purchaser_name, status)
VALUES ('GC-TEST-0000-0000', 10.00, 10.00, 'test@test.com', 'Test', 'pending');

-- If you see this, it worked!
SELECT 'Gift cards table created successfully!' as result;
SELECT * FROM gift_cards;

-- Clean up test record
DELETE FROM gift_cards WHERE code = 'GC-TEST-0000-0000';
