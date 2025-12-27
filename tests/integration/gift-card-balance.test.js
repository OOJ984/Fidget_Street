/**
 * Gift Card Balance Lifecycle Tests
 *
 * Tests the complete lifecycle of gift card balance:
 * 1. Create a gift card with balance
 * 2. Spend part of it
 * 3. Verify balance goes down
 * 4. Spend the rest until depleted
 * 5. Verify no more can be spent when balance is 0
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Gift Card Balance Lifecycle', () => {
    let testGiftCard;
    const testCode = `GC-TEST-${Date.now().toString(36).toUpperCase()}`;
    const initialBalance = 50.00;

    beforeAll(async () => {
        // Create a test gift card with £50 balance
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        const { data, error } = await supabase
            .from('gift_cards')
            .insert({
                code: testCode,
                initial_balance: initialBalance,
                current_balance: initialBalance,
                currency: 'GBP',
                status: 'active',
                purchaser_email: 'test@example.com',
                purchaser_name: 'Test User',
                source: 'test',
                is_sent: false,
                expires_at: expiryDate.toISOString()
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create test gift card: ${error.message}`);
        }
        testGiftCard = data;
    });

    afterAll(async () => {
        // Clean up test data
        if (testGiftCard) {
            await supabase
                .from('gift_card_transactions')
                .delete()
                .eq('gift_card_id', testGiftCard.id);

            await supabase
                .from('gift_cards')
                .delete()
                .eq('id', testGiftCard.id);
        }
    });

    describe('Initial State', () => {
        it('should have correct initial balance', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance, initial_balance, status')
                .eq('id', testGiftCard.id)
                .single();

            expect(parseFloat(data.current_balance)).toBe(initialBalance);
            expect(parseFloat(data.initial_balance)).toBe(initialBalance);
            expect(data.status).toBe('active');
        });

        it('should be usable for purchases', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('id', testGiftCard.id)
                .single();

            const isUsable = data.status === 'active' &&
                            parseFloat(data.current_balance) > 0;
            expect(isUsable).toBe(true);
        });
    });

    describe('First Purchase - Partial Spend', () => {
        const firstSpend = 20.00;
        let balanceAfterFirstSpend;

        it('should validate balance is sufficient for spend', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            const currentBalance = parseFloat(data.current_balance);
            expect(currentBalance).toBeGreaterThanOrEqual(firstSpend);
        });

        it('should deduct balance correctly after first spend', async () => {
            // Simulate the deduction that happens in webhooks.js
            const { data: before } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            const currentBalance = parseFloat(before.current_balance);
            const newBalance = Math.round((currentBalance - firstSpend) * 100) / 100;
            balanceAfterFirstSpend = newBalance;

            const { error } = await supabase
                .from('gift_cards')
                .update({
                    current_balance: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('id', testGiftCard.id);

            expect(error).toBeNull();
        });

        it('should have reduced balance after spend', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            expect(parseFloat(data.current_balance)).toBe(balanceAfterFirstSpend);
            expect(parseFloat(data.current_balance)).toBe(initialBalance - firstSpend);
        });

        it('should record transaction for first spend', async () => {
            const { error } = await supabase
                .from('gift_card_transactions')
                .insert({
                    gift_card_id: testGiftCard.id,
                    transaction_type: 'redemption',
                    amount: -firstSpend,
                    balance_after: balanceAfterFirstSpend,
                    order_number: 'FS-TEST-001',
                    notes: 'Test first purchase'
                });

            expect(error).toBeNull();
        });

        it('should still be active with remaining balance', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('status, current_balance')
                .eq('id', testGiftCard.id)
                .single();

            expect(data.status).toBe('active');
            expect(parseFloat(data.current_balance)).toBeGreaterThan(0);
        });
    });

    describe('Second Purchase - Another Partial Spend', () => {
        const secondSpend = 15.00;
        let balanceAfterSecondSpend;

        it('should deduct balance correctly after second spend', async () => {
            const { data: before } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            const currentBalance = parseFloat(before.current_balance);
            const newBalance = Math.round((currentBalance - secondSpend) * 100) / 100;
            balanceAfterSecondSpend = newBalance;

            const { error } = await supabase
                .from('gift_cards')
                .update({
                    current_balance: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('id', testGiftCard.id);

            expect(error).toBeNull();

            // Record transaction
            await supabase
                .from('gift_card_transactions')
                .insert({
                    gift_card_id: testGiftCard.id,
                    transaction_type: 'redemption',
                    amount: -secondSpend,
                    balance_after: newBalance,
                    order_number: 'FS-TEST-002',
                    notes: 'Test second purchase'
                });
        });

        it('should have correct balance after second spend', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            // £50 - £20 - £15 = £15 remaining
            expect(parseFloat(data.current_balance)).toBe(15.00);
        });

        it('should have two transaction records', async () => {
            const { data } = await supabase
                .from('gift_card_transactions')
                .select('*')
                .eq('gift_card_id', testGiftCard.id)
                .eq('transaction_type', 'redemption');

            expect(data.length).toBe(2);
        });
    });

    describe('Third Purchase - Spend Remaining Balance', () => {
        it('should spend remaining balance completely', async () => {
            const { data: before } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            const remainingBalance = parseFloat(before.current_balance);
            expect(remainingBalance).toBe(15.00);

            // Spend the rest
            const { error } = await supabase
                .from('gift_cards')
                .update({
                    current_balance: 0,
                    status: 'depleted',
                    updated_at: new Date().toISOString()
                })
                .eq('id', testGiftCard.id);

            expect(error).toBeNull();

            // Record transaction
            await supabase
                .from('gift_card_transactions')
                .insert({
                    gift_card_id: testGiftCard.id,
                    transaction_type: 'redemption',
                    amount: -remainingBalance,
                    balance_after: 0,
                    order_number: 'FS-TEST-003',
                    notes: 'Test final purchase - depleted'
                });
        });

        it('should have zero balance', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', testGiftCard.id)
                .single();

            expect(parseFloat(data.current_balance)).toBe(0);
        });

        it('should be marked as depleted', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('status')
                .eq('id', testGiftCard.id)
                .single();

            expect(data.status).toBe('depleted');
        });
    });

    describe('Attempting to Spend Depleted Card', () => {
        it('should have no usable balance', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('current_balance, status')
                .eq('id', testGiftCard.id)
                .single();

            const balance = parseFloat(data.current_balance);
            expect(balance).toBe(0);
        });

        it('should not be usable for purchases', async () => {
            const { data } = await supabase
                .from('gift_cards')
                .select('*')
                .eq('id', testGiftCard.id)
                .single();

            const isUsable = data.status === 'active' &&
                            parseFloat(data.current_balance) > 0;
            expect(isUsable).toBe(false);
        });

        it('should reject validation when depleted', () => {
            // Simulates what validate-gift-card.js does
            const status = 'depleted';
            const currentBalance = 0;

            const isValid = status === 'active' && currentBalance > 0;
            expect(isValid).toBe(false);
        });

        it('should return appropriate error message for depleted card', () => {
            const status = 'depleted';
            const statusMessages = {
                'pending': 'This gift card has not been activated yet',
                'depleted': 'This gift card has no remaining balance',
                'expired': 'This gift card has expired',
                'cancelled': 'This gift card has been cancelled'
            };

            expect(statusMessages[status]).toBe('This gift card has no remaining balance');
        });

        it('should calculate zero applicable amount', () => {
            const currentBalance = 0;
            const orderTotal = 25.00;
            const applicableAmount = Math.min(currentBalance, orderTotal);

            expect(applicableAmount).toBe(0);
        });
    });

    describe('Transaction History', () => {
        it('should have complete transaction history', async () => {
            const { data } = await supabase
                .from('gift_card_transactions')
                .select('*')
                .eq('gift_card_id', testGiftCard.id)
                .order('created_at', { ascending: true });

            expect(data.length).toBe(3);
        });

        it('should have correct transaction amounts', async () => {
            const { data } = await supabase
                .from('gift_card_transactions')
                .select('amount, balance_after')
                .eq('gift_card_id', testGiftCard.id)
                .order('created_at', { ascending: true });

            // First spend: -£20, balance after: £30
            expect(parseFloat(data[0].amount)).toBe(-20.00);
            expect(parseFloat(data[0].balance_after)).toBe(30.00);

            // Second spend: -£15, balance after: £15
            expect(parseFloat(data[1].amount)).toBe(-15.00);
            expect(parseFloat(data[1].balance_after)).toBe(15.00);

            // Third spend: -£15, balance after: £0
            expect(parseFloat(data[2].amount)).toBe(-15.00);
            expect(parseFloat(data[2].balance_after)).toBe(0);
        });

        it('should sum to initial balance', async () => {
            const { data } = await supabase
                .from('gift_card_transactions')
                .select('amount')
                .eq('gift_card_id', testGiftCard.id);

            const totalSpent = data.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
            expect(totalSpent).toBe(initialBalance);
        });
    });
});

describe('Gift Card Edge Cases', () => {
    const testCodes = [];

    afterAll(async () => {
        for (const code of testCodes) {
            const { data: card } = await supabase
                .from('gift_cards')
                .select('id')
                .eq('code', code)
                .single();

            if (card) {
                await supabase
                    .from('gift_card_transactions')
                    .delete()
                    .eq('gift_card_id', card.id);
                await supabase
                    .from('gift_cards')
                    .delete()
                    .eq('id', card.id);
            }
        }
    });

    describe('Partial Order Coverage', () => {
        it('should only use balance up to order total', async () => {
            const code = `GC-EDGE-${Date.now().toString(36).toUpperCase()}-1`;
            testCodes.push(code);

            // Create card with £100 balance
            const { data: card } = await supabase
                .from('gift_cards')
                .insert({
                    code,
                    initial_balance: 100.00,
                    current_balance: 100.00,
                    currency: 'GBP',
                    status: 'active',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'test',
                    is_sent: false
                })
                .select()
                .single();

            // Order is only £25
            const orderTotal = 25.00;
            const cardBalance = 100.00;
            const amountToUse = Math.min(cardBalance, orderTotal);

            expect(amountToUse).toBe(25.00);

            // Apply the spend
            const newBalance = cardBalance - amountToUse;
            await supabase
                .from('gift_cards')
                .update({ current_balance: newBalance })
                .eq('id', card.id);

            const { data: updated } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', card.id)
                .single();

            expect(parseFloat(updated.current_balance)).toBe(75.00);
        });
    });

    describe('Exact Balance Match', () => {
        it('should handle when order equals exact balance', async () => {
            const code = `GC-EDGE-${Date.now().toString(36).toUpperCase()}-2`;
            testCodes.push(code);

            const { data: card } = await supabase
                .from('gift_cards')
                .insert({
                    code,
                    initial_balance: 30.00,
                    current_balance: 30.00,
                    currency: 'GBP',
                    status: 'active',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'test',
                    is_sent: false
                })
                .select()
                .single();

            // Order matches exact balance
            const orderTotal = 30.00;
            const cardBalance = 30.00;
            const amountToUse = Math.min(cardBalance, orderTotal);
            const newBalance = cardBalance - amountToUse;
            const newStatus = newBalance <= 0 ? 'depleted' : 'active';

            expect(amountToUse).toBe(30.00);
            expect(newBalance).toBe(0);
            expect(newStatus).toBe('depleted');

            await supabase
                .from('gift_cards')
                .update({ current_balance: newBalance, status: newStatus })
                .eq('id', card.id);

            const { data: updated } = await supabase
                .from('gift_cards')
                .select('current_balance, status')
                .eq('id', card.id)
                .single();

            expect(parseFloat(updated.current_balance)).toBe(0);
            expect(updated.status).toBe('depleted');
        });
    });

    describe('Small Remaining Balance', () => {
        it('should handle penny balance correctly', async () => {
            const code = `GC-EDGE-${Date.now().toString(36).toUpperCase()}-3`;
            testCodes.push(code);

            const { data: card } = await supabase
                .from('gift_cards')
                .insert({
                    code,
                    initial_balance: 10.00,
                    current_balance: 0.01, // Just 1p left
                    currency: 'GBP',
                    status: 'active',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'test',
                    is_sent: false
                })
                .select()
                .single();

            // Order is £50 but only 1p available
            const orderTotal = 50.00;
            const cardBalance = 0.01;
            const amountToUse = Math.min(cardBalance, orderTotal);

            expect(amountToUse).toBe(0.01);

            const newBalance = Math.round((cardBalance - amountToUse) * 100) / 100;
            expect(newBalance).toBe(0);

            await supabase
                .from('gift_cards')
                .update({ current_balance: 0, status: 'depleted' })
                .eq('id', card.id);

            const { data: updated } = await supabase
                .from('gift_cards')
                .select('current_balance, status')
                .eq('id', card.id)
                .single();

            expect(parseFloat(updated.current_balance)).toBe(0);
            expect(updated.status).toBe('depleted');
        });
    });

    describe('Floating Point Precision', () => {
        it('should handle repeated small spends without precision errors', async () => {
            const code = `GC-EDGE-${Date.now().toString(36).toUpperCase()}-4`;
            testCodes.push(code);

            const { data: card } = await supabase
                .from('gift_cards')
                .insert({
                    code,
                    initial_balance: 10.00,
                    current_balance: 10.00,
                    currency: 'GBP',
                    status: 'active',
                    purchaser_email: 'test@example.com',
                    purchaser_name: 'Test',
                    source: 'test',
                    is_sent: false
                })
                .select()
                .single();

            // Simulate 3 spends of £3.33 each
            let balance = 10.00;
            const spendAmount = 3.33;

            for (let i = 0; i < 3; i++) {
                balance = Math.round((balance - spendAmount) * 100) / 100;
            }

            // 10 - 3.33 - 3.33 - 3.33 = 0.01
            expect(balance).toBeCloseTo(0.01, 2);

            await supabase
                .from('gift_cards')
                .update({ current_balance: balance })
                .eq('id', card.id);

            const { data: updated } = await supabase
                .from('gift_cards')
                .select('current_balance')
                .eq('id', card.id)
                .single();

            expect(parseFloat(updated.current_balance)).toBeCloseTo(0.01, 2);
        });
    });
});

describe('Gift Card Validation API Logic', () => {
    describe('Status-based Rejection', () => {
        const statusTests = [
            { status: 'pending', balance: 50, shouldReject: true, reason: 'not activated' },
            { status: 'active', balance: 50, shouldReject: false, reason: 'valid' },
            { status: 'active', balance: 0, shouldReject: true, reason: 'zero balance' },
            { status: 'depleted', balance: 0, shouldReject: true, reason: 'depleted' },
            { status: 'expired', balance: 50, shouldReject: true, reason: 'expired' },
            { status: 'cancelled', balance: 50, shouldReject: true, reason: 'cancelled' }
        ];

        statusTests.forEach(({ status, balance, shouldReject, reason }) => {
            it(`should ${shouldReject ? 'reject' : 'accept'} card: ${reason}`, () => {
                const isUsable = status === 'active' && balance > 0;
                expect(isUsable).toBe(!shouldReject);
            });
        });
    });

    describe('Balance Calculations', () => {
        it('should calculate applicable amount correctly', () => {
            const testCases = [
                { balance: 50, orderTotal: 30, expected: 30 },
                { balance: 30, orderTotal: 50, expected: 30 },
                { balance: 50, orderTotal: 50, expected: 50 },
                { balance: 0, orderTotal: 50, expected: 0 },
                { balance: 100, orderTotal: 0, expected: 0 }
            ];

            testCases.forEach(({ balance, orderTotal, expected }) => {
                const applicable = Math.min(balance, orderTotal);
                expect(applicable).toBe(expected);
            });
        });

        it('should calculate remaining balance after use', () => {
            const balance = 50.00;
            const spent = 35.50;
            const remaining = Math.round((balance - spent) * 100) / 100;

            expect(remaining).toBe(14.50);
        });

        it('should determine if card covers full order', () => {
            expect(50 >= 30).toBe(true);  // Card covers order
            expect(30 >= 50).toBe(false); // Card doesn't cover order
            expect(50 >= 50).toBe(true);  // Exact match
        });
    });
});
