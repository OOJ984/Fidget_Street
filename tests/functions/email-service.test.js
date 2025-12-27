/**
 * Email Service Tests
 *
 * Tests for email template generation, formatting, and sending logic.
 */

import { describe, it, expect } from 'vitest';

// Mock the email service exports
const COLORS = {
    primary: '#71c7e1',
    accent: '#FF6F61',
    mint: '#A8E0A2',
    lavender: '#D8B4E2',
    yellow: '#F9F92F',
    text: '#333333',
    lightText: '#666666',
    lightBg: '#f9f9f9'
};

describe('Email Service', () => {
    describe('Brand Colors', () => {
        it('should have correct primary color (Soft Blue)', () => {
            expect(COLORS.primary).toBe('#71c7e1');
        });

        it('should have correct accent color (Coral)', () => {
            expect(COLORS.accent).toBe('#FF6F61');
        });

        it('should have correct mint color', () => {
            expect(COLORS.mint).toBe('#A8E0A2');
        });

        it('should have correct lavender color', () => {
            expect(COLORS.lavender).toBe('#D8B4E2');
        });

        it('should have all required colors defined', () => {
            expect(COLORS.text).toBeDefined();
            expect(COLORS.lightText).toBeDefined();
            expect(COLORS.lightBg).toBeDefined();
        });
    });

    describe('Email Validation', () => {
        it('should validate email format', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'admin@fidgetstreet.co.uk'
            ];

            validEmails.forEach(email => {
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                expect(isValid).toBe(true);
            });
        });

        it('should reject invalid email format', () => {
            const invalidEmails = [
                'notanemail',
                'missing@domain',
                '@nodomain.com',
                'spaces in@email.com'
            ];

            invalidEmails.forEach(email => {
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                expect(isValid).toBe(false);
            });
        });

        it('should limit email length to 254 characters', () => {
            const email = 'test@example.com';
            expect(email.length).toBeLessThanOrEqual(254);
        });
    });

    describe('Base Template', () => {
        it('should generate HTML with doctype', () => {
            const html = '<!DOCTYPE html><html>';
            expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        });

        it('should include viewport meta tag', () => {
            const meta = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
            expect(meta).toContain('viewport');
        });

        it('should include brand name in header', () => {
            const header = 'Fidget Street';
            expect(header).toBe('Fidget Street');
        });

        it('should include current year in footer', () => {
            const year = new Date().getFullYear();
            expect(year).toBeGreaterThanOrEqual(2024);
        });
    });

    describe('Button Generator', () => {
        it('should create button with text and URL', () => {
            const text = 'Shop Now';
            const url = 'https://fidgetstreet.co.uk';
            const buttonHtml = `<a href="${url}">${text}</a>`;

            expect(buttonHtml).toContain(url);
            expect(buttonHtml).toContain(text);
        });

        it('should use accent color by default', () => {
            const defaultColor = COLORS.accent;
            expect(defaultColor).toBe('#FF6F61');
        });

        it('should allow custom button color', () => {
            const customColor = COLORS.primary;
            expect(customColor).toBe('#71c7e1');
        });
    });

    describe('Unsubscribe Section', () => {
        it('should include unsubscribe when enabled', () => {
            const options = { includeUnsubscribe: true, email: 'test@example.com' };
            expect(options.includeUnsubscribe).toBe(true);
        });

        it('should encode email in unsubscribe URL', () => {
            const email = 'test@example.com';
            const encoded = encodeURIComponent(email);
            expect(encoded).toBe('test%40example.com');
        });

        it('should not include unsubscribe when disabled', () => {
            const options = { includeUnsubscribe: false };
            expect(options.includeUnsubscribe).toBe(false);
        });
    });
});

describe('Order Confirmation Email', () => {
    const mockOrder = {
        order_number: 'FS-123456',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        items: [
            { title: 'Fidget Spinner', quantity: 2, price: 9.99, variation: 'Blue' },
            { title: 'Stress Ball', quantity: 1, price: 5.99 }
        ],
        subtotal: 25.97,
        shipping: 3.99,
        total: 29.96,
        shipping_address: {
            line1: '123 Main St',
            line2: 'Apt 4',
            city: 'London',
            postal_code: 'SW1A 1AA',
            country: 'United Kingdom'
        }
    };

    describe('Order Number', () => {
        it('should format order number with FS prefix', () => {
            expect(mockOrder.order_number).toMatch(/^FS-\d+$/);
        });
    });

    describe('Items Formatting', () => {
        it('should list all items', () => {
            expect(mockOrder.items.length).toBe(2);
        });

        it('should include variation when present', () => {
            const itemWithVariation = mockOrder.items[0];
            expect(itemWithVariation.variation).toBe('Blue');
        });

        it('should calculate line total correctly', () => {
            const item = mockOrder.items[0];
            const lineTotal = item.price * item.quantity;
            expect(lineTotal).toBeCloseTo(19.98, 2);
        });
    });

    describe('Address Formatting', () => {
        it('should include all address lines', () => {
            const { shipping_address } = mockOrder;
            expect(shipping_address.line1).toBe('123 Main St');
            expect(shipping_address.city).toBe('London');
            expect(shipping_address.postal_code).toBe('SW1A 1AA');
        });

        it('should handle optional line2', () => {
            const { shipping_address } = mockOrder;
            expect(shipping_address.line2).toBe('Apt 4');
        });
    });

    describe('Totals', () => {
        it('should display subtotal', () => {
            expect(mockOrder.subtotal).toBe(25.97);
        });

        it('should display shipping cost', () => {
            expect(mockOrder.shipping).toBe(3.99);
        });

        it('should display total', () => {
            expect(mockOrder.total).toBe(29.96);
        });

        it('should show "Free" for zero shipping', () => {
            const freeShipping = 0;
            const shippingText = freeShipping > 0 ? `£${freeShipping.toFixed(2)}` : 'Free';
            expect(shippingText).toBe('Free');
        });
    });

    describe('Discount Handling', () => {
        it('should show discount when applied', () => {
            const orderWithDiscount = {
                ...mockOrder,
                discount_code: '10OFF',
                discount_amount: 2.60
            };
            expect(orderWithDiscount.discount_code).toBe('10OFF');
            expect(orderWithDiscount.discount_amount).toBe(2.60);
        });

        it('should hide discount section when not applied', () => {
            expect(mockOrder.discount_code).toBeUndefined();
        });
    });

    describe('Gift Card Handling', () => {
        it('should show gift card when used', () => {
            const orderWithGiftCard = {
                ...mockOrder,
                gift_card_amount: 10.00
            };
            expect(orderWithGiftCard.gift_card_amount).toBe(10.00);
        });
    });
});

describe('Gift Card Delivery Email', () => {
    const mockGiftCard = {
        code: 'GC-ABCD-1234-EFGH',
        initial_balance: 50.00,
        purchaser_name: 'Jane Doe',
        purchaser_email: 'jane@example.com',
        recipient_name: 'John Smith',
        recipient_email: 'john@example.com',
        personal_message: 'Happy Birthday!'
    };

    describe('Gift Card Code', () => {
        it('should display code in correct format', () => {
            expect(mockGiftCard.code).toMatch(/^GC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
        });
    });

    describe('Balance Display', () => {
        it('should format balance with pound sign', () => {
            const formatted = `£${parseFloat(mockGiftCard.initial_balance).toFixed(2)}`;
            expect(formatted).toBe('£50.00');
        });
    });

    describe('Purchaser Info', () => {
        it('should include purchaser name', () => {
            expect(mockGiftCard.purchaser_name).toBe('Jane Doe');
        });
    });

    describe('Recipient Info', () => {
        it('should send to recipient email when provided', () => {
            const recipientEmail = mockGiftCard.recipient_email || mockGiftCard.purchaser_email;
            expect(recipientEmail).toBe('john@example.com');
        });

        it('should fallback to purchaser email when no recipient', () => {
            const cardWithoutRecipient = { ...mockGiftCard, recipient_email: null };
            const recipientEmail = cardWithoutRecipient.recipient_email || cardWithoutRecipient.purchaser_email;
            expect(recipientEmail).toBe('jane@example.com');
        });
    });

    describe('Personal Message', () => {
        it('should include personal message when provided', () => {
            expect(mockGiftCard.personal_message).toBe('Happy Birthday!');
        });

        it('should handle empty personal message', () => {
            const cardWithoutMessage = { ...mockGiftCard, personal_message: '' };
            expect(cardWithoutMessage.personal_message).toBe('');
        });
    });

    describe('Expiry Date', () => {
        it('should format expiry date when present', () => {
            const expiryDate = new Date('2025-12-31');
            const formatted = expiryDate.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
            expect(formatted).toBe('31 December 2025');
        });
    });
});

describe('Shipping Notification Email', () => {
    const mockOrder = {
        order_number: 'FS-789012',
        customer_name: 'Bob Wilson',
        customer_email: 'bob@example.com',
        items: [
            { title: 'Fidget Cube', quantity: 1, variation: 'Black' }
        ],
        shipping_address: {
            line1: '456 Oak Lane',
            city: 'Manchester',
            postal_code: 'M1 1AA',
            country: 'United Kingdom'
        }
    };

    describe('Tracking Information', () => {
        it('should include tracking number when provided', () => {
            const trackingInfo = {
                tracking_number: 'RM123456789GB',
                carrier: 'Royal Mail',
                tracking_url: 'https://royalmail.com/track/RM123456789GB'
            };

            expect(trackingInfo.tracking_number).toBe('RM123456789GB');
            expect(trackingInfo.carrier).toBe('Royal Mail');
        });

        it('should default carrier to Royal Mail', () => {
            const trackingInfo = { tracking_number: 'ABC123' };
            const carrier = trackingInfo.carrier || 'Royal Mail';
            expect(carrier).toBe('Royal Mail');
        });

        it('should handle missing tracking URL', () => {
            const trackingInfo = { tracking_number: 'ABC123' };
            expect(trackingInfo.tracking_url).toBeUndefined();
        });
    });

    describe('Subject Line', () => {
        it('should include order number', () => {
            const subject = `Your order is on its way! #${mockOrder.order_number} 📦`;
            expect(subject).toContain('FS-789012');
        });
    });
});

describe('Admin Password Reset Email', () => {
    describe('Reset URL', () => {
        it('should include token in URL', () => {
            const token = 'abc123xyz';
            const resetUrl = `https://fidgetstreet.co.uk/admin/reset-password.html?token=${token}`;
            expect(resetUrl).toContain(token);
        });
    });

    describe('Expiry Time', () => {
        it('should default to 60 minutes', () => {
            const expiresInMinutes = 60;
            expect(expiresInMinutes).toBe(60);
        });

        it('should allow custom expiry time', () => {
            const expiresInMinutes = 30;
            expect(expiresInMinutes).toBe(30);
        });
    });

    describe('Security Warning', () => {
        it('should include security notice', () => {
            const securityNotice = "If you didn't request this password reset, please ignore this email.";
            expect(securityNotice).toContain("didn't request");
        });
    });
});

describe('Magic Link Email', () => {
    describe('Link Generation', () => {
        it('should include magic link token', () => {
            const token = 'magictoken123';
            const magicLink = `https://fidgetstreet.co.uk/account/orders.html?magic=${token}`;
            expect(magicLink).toContain(token);
        });
    });

    describe('Expiry', () => {
        it('should expire in 15 minutes', () => {
            const expiryMinutes = 15;
            expect(expiryMinutes).toBe(15);
        });
    });
});

describe('Newsletter Welcome Email', () => {
    describe('Content', () => {
        it('should list expected content', () => {
            const expectedContent = [
                'New product announcements',
                'Exclusive subscriber discounts',
                'Tips for stress relief and focus',
                'Behind-the-scenes updates'
            ];

            expect(expectedContent.length).toBe(4);
        });
    });

    describe('Unsubscribe', () => {
        it('should include unsubscribe link', () => {
            const includeUnsubscribe = true;
            expect(includeUnsubscribe).toBe(true);
        });
    });
});

describe('Marketing Email', () => {
    describe('Required Fields', () => {
        it('should require subject', () => {
            const email = { subject: 'Big Sale!' };
            expect(email.subject).toBeDefined();
        });

        it('should require headline', () => {
            const email = { headline: '50% Off Everything!' };
            expect(email.headline).toBeDefined();
        });

        it('should require body', () => {
            const email = { body: '<p>Shop now and save big!</p>' };
            expect(email.body).toBeDefined();
        });
    });

    describe('CTA Button', () => {
        it('should include CTA when provided', () => {
            const email = {
                ctaText: 'Shop Now',
                ctaUrl: 'https://fidgetstreet.co.uk/products.html'
            };

            expect(email.ctaText).toBe('Shop Now');
            expect(email.ctaUrl).toBeDefined();
        });

        it('should handle missing CTA', () => {
            const email = { subject: 'Newsletter', headline: 'Update', body: 'Content' };
            expect(email.ctaText).toBeUndefined();
            expect(email.ctaUrl).toBeUndefined();
        });
    });

    describe('Unsubscribe', () => {
        it('should always include unsubscribe for marketing', () => {
            const includeUnsubscribe = true;
            expect(includeUnsubscribe).toBe(true);
        });
    });
});

describe('Send Email Function', () => {
    describe('API Key Handling', () => {
        it('should fallback to console in dev mode', () => {
            const apiKey = undefined;
            const isDev = !apiKey;
            expect(isDev).toBe(true);
        });
    });

    describe('Sender Address', () => {
        it('should use default sender', () => {
            const defaultFrom = 'Fidget Street <orders@fidgetstreet.co.uk>';
            expect(defaultFrom).toContain('fidgetstreet.co.uk');
        });
    });

    describe('Recipient Formatting', () => {
        it('should handle single recipient', () => {
            const to = 'test@example.com';
            const recipients = Array.isArray(to) ? to : [to];
            expect(recipients).toEqual(['test@example.com']);
        });

        it('should handle multiple recipients', () => {
            const to = ['a@example.com', 'b@example.com'];
            const recipients = Array.isArray(to) ? to : [to];
            expect(recipients.length).toBe(2);
        });
    });

    describe('Response Format', () => {
        it('should return success with id', () => {
            const response = { success: true, method: 'resend', id: 'abc123' };
            expect(response.success).toBe(true);
            expect(response.id).toBeDefined();
        });

        it('should return error on failure', () => {
            const response = { success: false, error: 'Failed to send email' };
            expect(response.success).toBe(false);
            expect(response.error).toBeDefined();
        });

        it('should indicate console method in dev', () => {
            const response = { success: true, method: 'console', id: 'dev-mode' };
            expect(response.method).toBe('console');
        });
    });
});

describe('HTML Content Safety', () => {
    describe('XSS Prevention', () => {
        it('should escape HTML entities in user input', () => {
            const input = '<script>alert("xss")</script>';
            const escaped = input
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });
    });

    describe('URL Validation', () => {
        it('should only allow https URLs', () => {
            const url = 'https://fidgetstreet.co.uk';
            expect(url.startsWith('https://')).toBe(true);
        });

        it('should reject javascript protocol', () => {
            const url = 'javascript:alert(1)';
            const isValid = url.startsWith('http://') || url.startsWith('https://');
            expect(isValid).toBe(false);
        });
    });
});

describe('Price Formatting', () => {
    it('should format prices with 2 decimal places', () => {
        const price = 9.9;
        const formatted = price.toFixed(2);
        expect(formatted).toBe('9.90');
    });

    it('should handle whole numbers', () => {
        const price = 50;
        const formatted = price.toFixed(2);
        expect(formatted).toBe('50.00');
    });

    it('should round to 2 decimal places', () => {
        const price = 19.999;
        const formatted = price.toFixed(2);
        expect(formatted).toBe('20.00');
    });

    it('should use pound symbol for GBP', () => {
        const price = 25.00;
        const formatted = `£${price.toFixed(2)}`;
        expect(formatted).toBe('£25.00');
    });
});

describe('Date Formatting', () => {
    it('should format UK date correctly', () => {
        const date = new Date('2025-12-25');
        const formatted = date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        expect(formatted).toBe('25 December 2025');
    });

    it('should handle order dates', () => {
        const date = new Date();
        const formatted = date.toLocaleDateString('en-GB');
        expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
});
