-- ============================================
-- Gift Cards Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Gift Cards Table
CREATE TABLE IF NOT EXISTS gift_cards (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,                    -- Unique redemption code (GC-XXXX-XXXX-XXXX)
    initial_balance DECIMAL(10,2) NOT NULL,       -- Original amount
    current_balance DECIMAL(10,2) NOT NULL,       -- Remaining balance
    currency TEXT DEFAULT 'GBP',

    -- Purchase info
    purchaser_email TEXT NOT NULL,                -- Who bought it
    purchaser_name TEXT,
    recipient_email TEXT,                         -- Who receives it (null = purchaser)
    recipient_name TEXT,
    personal_message TEXT,                        -- Optional gift message

    -- Source tracking
    source TEXT DEFAULT 'purchase' CHECK (source IN ('purchase', 'promotional', 'refund')),
    order_id INTEGER REFERENCES orders(id),       -- Link to purchase order (if purchased)
    created_by INTEGER REFERENCES admin_users(id), -- Admin who created (if promotional)

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'depleted', 'expired', 'cancelled')),
    is_sent BOOLEAN DEFAULT false,                -- Email sent to recipient
    sent_at TIMESTAMPTZ,

    -- Validity
    expires_at TIMESTAMPTZ,                       -- Optional expiry date
    activated_at TIMESTAMPTZ,                     -- When payment confirmed

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for gift cards
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_purchaser_email ON gift_cards(purchaser_email);
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipient_email ON gift_cards(recipient_email);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

-- Gift Card Transactions Table
CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id SERIAL PRIMARY KEY,
    gift_card_id INTEGER REFERENCES gift_cards(id) ON DELETE CASCADE,

    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('activation', 'redemption', 'refund', 'adjustment')),
    amount DECIMAL(10,2) NOT NULL,                -- Positive for credits, negative for debits
    balance_after DECIMAL(10,2) NOT NULL,         -- Balance after this transaction

    -- Context
    order_id INTEGER REFERENCES orders(id),       -- Which order used this (for redemption)
    order_number TEXT,                            -- For quick reference
    notes TEXT,

    -- Audit
    performed_by_email TEXT,                      -- Customer email or admin email
    performed_by_admin INTEGER REFERENCES admin_users(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for transactions
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_order_id ON gift_card_transactions(order_id);

-- Add gift card columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_card_amount DECIMAL(10,2);

-- Apply updated_at trigger to gift_cards (if trigger function exists)
DROP TRIGGER IF EXISTS update_gift_cards_updated_at ON gift_cards;
CREATE TRIGGER update_gift_cards_updated_at
    BEFORE UPDATE ON gift_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS for gift cards
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role can manage gift cards" ON gift_cards
    FOR ALL USING (true);

CREATE POLICY "Service role can manage gift card transactions" ON gift_card_transactions
    FOR ALL USING (true);

-- Function to generate unique gift card code
CREATE OR REPLACE FUNCTION generate_gift_card_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := 'GC-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' ||
            UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

        SELECT EXISTS(SELECT 1 FROM gift_cards WHERE code = new_code) INTO code_exists;
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verification queries (run after migration)
-- ============================================
-- SELECT * FROM gift_cards LIMIT 1;
-- SELECT * FROM gift_card_transactions LIMIT 1;
-- SELECT generate_gift_card_code();
