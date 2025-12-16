import { describe, it, expect } from 'vitest';
import {
    validateEmail,
    validatePhone,
    validateName,
    validateOrderItems,
    validateShippingAddress,
    validateOrderNumber,
    sanitizeString,
    MAX_QUANTITY_PER_ITEM
} from '../../../netlify/functions/utils/validation.js';

describe('validation.js', () => {
    describe('validateEmail()', () => {
        it('should accept valid email addresses', () => {
            expect(validateEmail('test@example.com').valid).toBe(true);
            expect(validateEmail('user.name@domain.co.uk').valid).toBe(true);
            expect(validateEmail('user+tag@example.org').valid).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            expect(validateEmail('notanemail').valid).toBe(false);
            expect(validateEmail('@nodomain.com').valid).toBe(false);
            expect(validateEmail('no@').valid).toBe(false);
            expect(validateEmail('').valid).toBe(false);
            expect(validateEmail(null).valid).toBe(false);
        });

        it('should reject emails that are too long', () => {
            const longEmail = 'a'.repeat(250) + '@test.com';
            expect(validateEmail(longEmail).valid).toBe(false);
        });

        it('should trim whitespace', () => {
            expect(validateEmail('  test@example.com  ').valid).toBe(true);
        });
    });

    describe('validatePhone()', () => {
        it('should accept valid UK phone numbers', () => {
            expect(validatePhone('07123456789').valid).toBe(true);
            expect(validatePhone('+447123456789').valid).toBe(true);
            expect(validatePhone('07123 456 789').valid).toBe(true);
            expect(validatePhone('01onal234567').valid).toBe(false); // Contains letters - invalid
        });

        it('should accept empty phone (optional field)', () => {
            expect(validatePhone('').valid).toBe(true);
            expect(validatePhone(null).valid).toBe(true);
            expect(validatePhone(undefined).valid).toBe(true);
        });

        it('should reject invalid phone numbers', () => {
            expect(validatePhone('abc').valid).toBe(false);
            expect(validatePhone('123').valid).toBe(false);
        });
    });

    describe('validateName()', () => {
        it('should accept valid names', () => {
            expect(validateName('John Doe').valid).toBe(true);
            expect(validateName('María García').valid).toBe(true);
            expect(validateName("O'Connor").valid).toBe(true);
        });

        it('should reject empty names', () => {
            expect(validateName('').valid).toBe(false);
            expect(validateName('   ').valid).toBe(false);
            expect(validateName(null).valid).toBe(false);
        });

        it('should reject names with HTML tags (XSS prevention)', () => {
            expect(validateName('<script>alert("xss")</script>').valid).toBe(false);
            expect(validateName('John<br>Doe').valid).toBe(false);
        });

        it('should reject names that are too long', () => {
            const longName = 'A'.repeat(150);
            expect(validateName(longName).valid).toBe(false);
        });
    });

    describe('validateOrderItems()', () => {
        const validItem = { id: 1, price: 10.99, quantity: 2, title: 'Test' };

        it('should accept valid items array', () => {
            expect(validateOrderItems([validItem]).valid).toBe(true);
            expect(validateOrderItems([validItem, validItem]).valid).toBe(true);
        });

        it('should reject empty array', () => {
            expect(validateOrderItems([]).valid).toBe(false);
        });

        it('should reject non-array', () => {
            expect(validateOrderItems('not an array').valid).toBe(false);
            expect(validateOrderItems(null).valid).toBe(false);
        });

        it('should reject invalid quantities', () => {
            expect(validateOrderItems([{ ...validItem, quantity: 0 }]).valid).toBe(false);
            expect(validateOrderItems([{ ...validItem, quantity: -1 }]).valid).toBe(false);
            expect(validateOrderItems([{ ...validItem, quantity: 1.5 }]).valid).toBe(false);
        });

        it('should reject quantities exceeding max', () => {
            expect(validateOrderItems([{ ...validItem, quantity: MAX_QUANTITY_PER_ITEM + 1 }]).valid).toBe(false);
        });

        it('should reject invalid prices', () => {
            expect(validateOrderItems([{ ...validItem, price: -5 }]).valid).toBe(false);
            expect(validateOrderItems([{ ...validItem, price: 0 }]).valid).toBe(false);
            expect(validateOrderItems([{ ...validItem, price: 'free' }]).valid).toBe(false);
        });

        it('should reject items without product ID', () => {
            const noId = { price: 10, quantity: 1 };
            expect(validateOrderItems([noId]).valid).toBe(false);
        });

        it('should reject too many items', () => {
            const manyItems = Array(51).fill(validItem);
            expect(validateOrderItems(manyItems).valid).toBe(false);
        });
    });

    describe('validateShippingAddress()', () => {
        const validAddress = {
            line1: '123 Test Street',
            city: 'London',
            postcode: 'SW1A 1AA',
            country: 'United Kingdom'
        };

        it('should accept valid addresses', () => {
            expect(validateShippingAddress(validAddress).valid).toBe(true);
        });

        it('should accept addresses with optional fields', () => {
            expect(validateShippingAddress({
                ...validAddress,
                line2: 'Flat 2',
                county: 'Greater London'
            }).valid).toBe(true);
        });

        it('should reject missing required fields', () => {
            expect(validateShippingAddress({ ...validAddress, line1: '' }).valid).toBe(false);
            expect(validateShippingAddress({ ...validAddress, city: undefined }).valid).toBe(false);
            expect(validateShippingAddress({ city: 'London' }).valid).toBe(false);
        });

        it('should reject fields that are too long', () => {
            expect(validateShippingAddress({
                ...validAddress,
                line1: 'A'.repeat(250)
            }).valid).toBe(false);
        });

        it('should reject HTML in fields (XSS prevention)', () => {
            expect(validateShippingAddress({
                ...validAddress,
                line1: '<script>alert("xss")</script>'
            }).valid).toBe(false);
        });
    });

    describe('validateOrderNumber()', () => {
        it('should accept valid order numbers', () => {
            expect(validateOrderNumber('PP-20241205-1234').valid).toBe(true);
            expect(validateOrderNumber('PP-20250101-0001').valid).toBe(true);
        });

        it('should reject invalid formats', () => {
            expect(validateOrderNumber('ABC-123').valid).toBe(false);
            expect(validateOrderNumber('PP-2024-1234').valid).toBe(false);
            expect(validateOrderNumber('PP-20241205-12345').valid).toBe(false);
            expect(validateOrderNumber('').valid).toBe(false);
            expect(validateOrderNumber(null).valid).toBe(false);
        });
    });

    describe('sanitizeString()', () => {
        it('should trim whitespace', () => {
            expect(sanitizeString('  hello  ')).toBe('hello');
        });

        it('should limit length', () => {
            expect(sanitizeString('hello world', 5)).toBe('hello');
        });

        it('should handle null/undefined', () => {
            expect(sanitizeString(null)).toBe('');
            expect(sanitizeString(undefined)).toBe('');
        });
    });
});
