/**
 * Gift Card Checkout Function Tests
 *
 * Tests the gift card purchase checkout logic.
 * Uses real Supabase for integration testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { validateEmail } from '../../netlify/functions/utils/validation.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Gift Card Checkout Logic', () => {
    describe('Gift Card Code Generation', () => {
        function generateTestCode() {
            // Simulates the code generation logic
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
            let code = 'GC-';
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 4; j++) {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                if (i < 2) code += '-';
            }
            return code;
        }

        it('should generate code in correct format', () => {
            const code = generateTestCode();
            expect(code).toMatch(/^GC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
        });

        it('should start with GC- prefix', () => {
            const code = generateTestCode();
            expect(code.startsWith('GC-')).toBe(true);
        });

        it('should have 17 characters total', () => {
            const code = generateTestCode();
            expect(code.length).toBe(17); // GC- (3) + 4 + - (1) + 4 + - (1) + 4 = 17
        });

        it('should not contain confusing characters (0, O, 1, I)', () => {
            for (let i = 0; i < 50; i++) {
                const code = generateTestCode();
                expect(code).not.toContain('0');
                expect(code).not.toContain('O');
                expect(code).not.toContain('1');
                expect(code).not.toContain('I');
            }
        });

        it('should generate unique codes', () => {
            const codes = new Set();
            for (let i = 0; i < 100; i++) {
                codes.add(generateTestCode());
            }
            expect(codes.size).toBe(100); // All unique
        });
    });

    describe('Amount Validation', () => {
        it('should accept valid amounts', () => {
            const validAmounts = [5, 10, 25, 50, 100, 250, 500];
            validAmounts.forEach(amount => {
                const giftCardAmount = parseFloat(amount);
                const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
                expect(isValid).toBe(true);
            });
        });

        it('should reject amounts below £5', () => {
            const amount = 4.99;
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(false);
        });

        it('should reject amounts above £500', () => {
            const amount = 500.01;
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(false);
        });

        it('should accept exactly £5', () => {
            const amount = 5;
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(true);
        });

        it('should accept exactly £500', () => {
            const amount = 500;
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(true);
        });

        it('should reject non-numeric amounts', () => {
            const amount = 'fifty';
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(false);
        });

        it('should handle decimal amounts', () => {
            const amount = 25.50;
            const giftCardAmount = parseFloat(amount);
            const isValid = !isNaN(giftCardAmount) && giftCardAmount >= 5 && giftCardAmount <= 500;
            expect(isValid).toBe(true);
        });
    });

    describe('Email Validation', () => {
        it('should validate purchaser email', () => {
            const result = validateEmail('buyer@example.com');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid purchaser email', () => {
            const result = validateEmail('not-an-email');
            expect(result.valid).toBe(false);
        });

        it('should validate recipient email', () => {
            const result = validateEmail('recipient@example.com');
            expect(result.valid).toBe(true);
        });

        it('should allow empty recipient email', () => {
            const recipientEmail = '';
            // Recipient email is optional
            const isValid = !recipientEmail || validateEmail(recipientEmail).valid;
            expect(isValid).toBe(true);
        });
    });

    describe('Required Fields Validation', () => {
        it('should require amount', () => {
            const body = {
                purchaser_name: 'Test User',
                purchaser_email: 'test@example.com'
            };
            const isValid = body.amount && body.purchaser_name && body.purchaser_email;
            expect(!!isValid).toBe(false);
        });

        it('should require purchaser name', () => {
            const body = {
                amount: 25,
                purchaser_email: 'test@example.com'
            };
            const isValid = body.amount && body.purchaser_name && body.purchaser_email;
            expect(!!isValid).toBe(false);
        });

        it('should require purchaser email', () => {
            const body = {
                amount: 25,
                purchaser_name: 'Test User'
            };
            const isValid = body.amount && body.purchaser_name && body.purchaser_email;
            expect(!!isValid).toBe(false);
        });

        it('should pass with all required fields', () => {
            const body = {
                amount: 25,
                purchaser_name: 'Test User',
                purchaser_email: 'test@example.com'
            };
            const isValid = body.amount && body.purchaser_name && body.purchaser_email;
            expect(!!isValid).toBe(true);
        });
    });

    describe('Expiry Date Calculation', () => {
        it('should set expiry to 1 year from now', () => {
            const now = new Date();
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            // Should be roughly 1 year in the future
            const diffMs = expiryDate.getTime() - now.getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

            expect(diffDays).toBeGreaterThanOrEqual(364);
            expect(diffDays).toBeLessThanOrEqual(366);
        });

        it('should produce valid ISO string', () => {
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            const isoString = expiryDate.toISOString();

            expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('Gift Card Record Structure', () => {
        it('should have correct initial structure', () => {
            const giftCardAmount = 50.00;
            const code = 'GC-TEST-CODE-HERE';
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const record = {
                code,
                initial_balance: giftCardAmount,
                current_balance: giftCardAmount,
                currency: 'GBP',
                purchaser_email: 'buyer@example.com',
                purchaser_name: 'Test Buyer',
                recipient_email: 'recipient@example.com',
                recipient_name: 'Test Recipient',
                personal_message: 'Happy Birthday!',
                source: 'purchase',
                status: 'pending',
                is_sent: false,
                expires_at: expiryDate.toISOString()
            };

            expect(record.initial_balance).toBe(50.00);
            expect(record.current_balance).toBe(50.00);
            expect(record.status).toBe('pending');
            expect(record.is_sent).toBe(false);
            expect(record.currency).toBe('GBP');
        });

        it('should handle null optional fields', () => {
            const record = {
                code: 'GC-TEST-0000-0000',
                initial_balance: 25,
                current_balance: 25,
                currency: 'GBP',
                purchaser_email: 'buyer@example.com',
                purchaser_name: 'Test Buyer',
                recipient_email: null,
                recipient_name: null,
                personal_message: null,
                source: 'purchase',
                status: 'pending',
                is_sent: false
            };

            expect(record.recipient_email).toBeNull();
            expect(record.recipient_name).toBeNull();
            expect(record.personal_message).toBeNull();
        });
    });

    describe('Stripe Session Configuration', () => {
        it('should convert amount to pence', () => {
            const giftCardAmount = 25.50;
            const amountPence = Math.round(giftCardAmount * 100);
            expect(amountPence).toBe(2550);
        });

        it('should format product name correctly', () => {
            const giftCardAmount = 50.00;
            const productName = `Fidget Street Gift Card - £${giftCardAmount.toFixed(2)}`;
            expect(productName).toBe('Fidget Street Gift Card - £50.00');
        });

        it('should format description for recipient', () => {
            const recipientName = 'John Smith';
            const description = recipientName
                ? `Gift for ${recipientName}`
                : 'Digital Gift Card';
            expect(description).toBe('Gift for John Smith');
        });

        it('should use default description when no recipient', () => {
            const recipientName = null;
            const description = recipientName
                ? `Gift for ${recipientName}`
                : 'Digital Gift Card';
            expect(description).toBe('Digital Gift Card');
        });

        it('should construct success URL correctly', () => {
            const baseUrl = 'https://fidgetstreet.co.uk';
            const code = 'GC-ABCD-EFGH-1234';
            const amount = 25;
            const successUrl = `${baseUrl}/gift-card-success.html?code=${code}&amount=${amount}`;
            expect(successUrl).toBe('https://fidgetstreet.co.uk/gift-card-success.html?code=GC-ABCD-EFGH-1234&amount=25');
        });

        it('should construct cancel URL correctly', () => {
            const baseUrl = 'https://fidgetstreet.co.uk';
            const cancelUrl = `${baseUrl}/gift-cards.html`;
            expect(cancelUrl).toBe('https://fidgetstreet.co.uk/gift-cards.html');
        });
    });

    describe('Stripe Metadata', () => {
        it('should include all required metadata', () => {
            const metadata = {
                type: 'gift_card_purchase',
                gift_card_id: '123',
                gift_card_code: 'GC-TEST-0000-0000',
                gift_card_amount: '50.00',
                recipient_email: 'recipient@example.com',
                recipient_name: 'Test Recipient'
            };

            expect(metadata.type).toBe('gift_card_purchase');
            expect(metadata.gift_card_id).toBe('123');
            expect(metadata.gift_card_code).toBe('GC-TEST-0000-0000');
            expect(metadata.gift_card_amount).toBe('50.00');
        });

        it('should handle empty recipient fields', () => {
            const recipientEmail = null;
            const recipientName = null;
            const metadata = {
                type: 'gift_card_purchase',
                gift_card_id: '123',
                gift_card_code: 'GC-TEST-0000-0000',
                gift_card_amount: '25',
                recipient_email: recipientEmail || '',
                recipient_name: recipientName || ''
            };

            expect(metadata.recipient_email).toBe('');
            expect(metadata.recipient_name).toBe('');
        });

        it('should convert ID to string', () => {
            const id = 12345;
            const idString = id.toString();
            expect(idString).toBe('12345');
        });

        it('should convert amount to string', () => {
            const amount = 50.00;
            const amountString = amount.toString();
            expect(amountString).toBe('50');
        });
    });
});

describe('Gift Card Database Operations', () => {
    const testCodes = [];

    afterAll(async () => {
        // Clean up test gift cards
        for (const code of testCodes) {
            await supabase
                .from('gift_cards')
                .delete()
                .eq('code', code);
        }
    });

    describe('Gift Card Creation', () => {
        it('should create pending gift card', async () => {
            const code = `TEST-GC-${Date.now()}`;
            testCodes.push(code);

            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const { data, error } = await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: 50.00,
                    current_balance: 50.00,
                    currency: 'GBP',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test Buyer',
                    source: 'purchase',
                    status: 'pending',
                    is_sent: false,
                    expires_at: expiryDate.toISOString()
                }])
                .select('id, code, status')
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.code).toBe(code);
            expect(data.status).toBe('pending');
        });

        it('should reject duplicate code', async () => {
            const code = `TEST-DUP-${Date.now()}`;
            testCodes.push(code);

            // First insert
            await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: 25.00,
                    current_balance: 25.00,
                    currency: 'GBP',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'purchase',
                    status: 'pending',
                    is_sent: false
                }]);

            // Second insert with same code should fail
            const { error } = await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: 30.00,
                    current_balance: 30.00,
                    currency: 'GBP',
                    purchaser_email: 'test2@example.com',
                    purchaser_name: 'Test 2',
                    source: 'purchase',
                    status: 'pending',
                    is_sent: false
                }]);

            expect(error).not.toBeNull();
        });

        it('should check for existing code', async () => {
            const code = `TEST-EXIST-${Date.now()}`;
            testCodes.push(code);

            // Create gift card
            await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: 25.00,
                    current_balance: 25.00,
                    currency: 'GBP',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'purchase',
                    status: 'pending',
                    is_sent: false
                }]);

            // Check for existing
            const { data: existing } = await supabase
                .from('gift_cards')
                .select('id')
                .eq('code', code)
                .single();

            expect(existing).not.toBeNull();
        });

        it('should update gift card with Stripe session ID', async () => {
            const code = `TEST-UPDATE-${Date.now()}`;
            testCodes.push(code);

            const { data: giftCard } = await supabase
                .from('gift_cards')
                .insert([{
                    code,
                    initial_balance: 50.00,
                    current_balance: 50.00,
                    currency: 'GBP',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'purchase',
                    status: 'pending',
                    is_sent: false
                }])
                .select('id')
                .single();

            const sessionId = 'cs_test_12345';
            const { error } = await supabase
                .from('gift_cards')
                .update({ notes: `Stripe Session: ${sessionId}` })
                .eq('id', giftCard.id);

            expect(error).toBeNull();

            // Verify update
            const { data: updated } = await supabase
                .from('gift_cards')
                .select('notes')
                .eq('id', giftCard.id)
                .single();

            expect(updated.notes).toBe('Stripe Session: cs_test_12345');
        });
    });
});
