/**
 * Order Utilities Unit Tests
 *
 * Tests the order helper functions for order number generation
 * and order totals calculation.
 */

import { describe, it, expect } from 'vitest';
import { generateOrderNumber, calculateOrderTotals } from '../../../netlify/functions/utils/orders.js';

describe('Order Utilities', () => {
    describe('generateOrderNumber()', () => {
        it('should generate order number in correct format', () => {
            const orderNumber = generateOrderNumber();
            expect(orderNumber).toMatch(/^FS-\d{8}-\d{4}$/);
        });

        it('should start with FS- prefix', () => {
            const orderNumber = generateOrderNumber();
            expect(orderNumber.startsWith('FS-')).toBe(true);
        });

        it('should include current date', () => {
            const orderNumber = generateOrderNumber();
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            expect(orderNumber).toContain(today);
        });

        it('should have 4 digit random suffix', () => {
            const orderNumber = generateOrderNumber();
            const suffix = orderNumber.split('-')[2];
            expect(suffix).toMatch(/^\d{4}$/);
        });

        it('should have correct total length', () => {
            const orderNumber = generateOrderNumber();
            // FS-YYYYMMDD-XXXX = 2 + 1 + 8 + 1 + 4 = 16 chars
            expect(orderNumber.length).toBe(16);
        });

        it('should generate unique order numbers', () => {
            const orderNumbers = new Set();
            for (let i = 0; i < 100; i++) {
                orderNumbers.add(generateOrderNumber());
            }
            // With 10000 possible suffixes per day, 100 should rarely collide
            expect(orderNumbers.size).toBeGreaterThan(90);
        });

        it('should have properly padded random suffix', () => {
            // Generate many to check for padding
            for (let i = 0; i < 20; i++) {
                const orderNumber = generateOrderNumber();
                const suffix = orderNumber.split('-')[2];
                expect(suffix.length).toBe(4);
            }
        });

        it('should have date in YYYYMMDD format', () => {
            const orderNumber = generateOrderNumber();
            const datePart = orderNumber.split('-')[1];
            expect(datePart.length).toBe(8);

            // Validate it's a reasonable date
            const year = parseInt(datePart.slice(0, 4));
            const month = parseInt(datePart.slice(4, 6));
            const day = parseInt(datePart.slice(6, 8));

            expect(year).toBeGreaterThanOrEqual(2024);
            expect(year).toBeLessThanOrEqual(2030);
            expect(month).toBeGreaterThanOrEqual(1);
            expect(month).toBeLessThanOrEqual(12);
            expect(day).toBeGreaterThanOrEqual(1);
            expect(day).toBeLessThanOrEqual(31);
        });
    });

    describe('calculateOrderTotals()', () => {
        describe('Subtotal Calculation', () => {
            it('should calculate subtotal for single item', () => {
                const items = [{ price: 10.00, quantity: 1 }];
                const { subtotal } = calculateOrderTotals(items);
                expect(subtotal).toBe(10.00);
            });

            it('should calculate subtotal with quantity', () => {
                const items = [{ price: 10.00, quantity: 3 }];
                const { subtotal } = calculateOrderTotals(items);
                expect(subtotal).toBe(30.00);
            });

            it('should calculate subtotal for multiple items', () => {
                const items = [
                    { price: 10.00, quantity: 2 },
                    { price: 5.50, quantity: 3 }
                ];
                const { subtotal } = calculateOrderTotals(items);
                expect(subtotal).toBe(36.50); // 20 + 16.50
            });

            it('should handle empty items array', () => {
                const { subtotal } = calculateOrderTotals([]);
                expect(subtotal).toBe(0);
            });

            it('should handle decimal prices', () => {
                const items = [
                    { price: 9.99, quantity: 2 },
                    { price: 4.99, quantity: 1 }
                ];
                const { subtotal } = calculateOrderTotals(items);
                expect(subtotal).toBeCloseTo(24.97, 2);
            });
        });

        describe('Shipping Calculation', () => {
            it('should add shipping for orders under threshold', () => {
                const items = [{ price: 5.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items);
                expect(shipping).toBe(3.49);
            });

            it('should have free shipping at threshold', () => {
                const items = [{ price: 20.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items);
                expect(shipping).toBe(0);
            });

            it('should have free shipping over threshold', () => {
                const items = [{ price: 25.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items);
                expect(shipping).toBe(0);
            });

            it('should use custom threshold', () => {
                const items = [{ price: 25.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items, 30);
                expect(shipping).toBe(3.49);
            });

            it('should use custom shipping cost', () => {
                const items = [{ price: 10.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items, 20, 4.99);
                expect(shipping).toBe(4.99);
            });

            it('should add shipping for empty cart', () => {
                const { shipping } = calculateOrderTotals([]);
                expect(shipping).toBe(3.49);
            });
        });

        describe('Total Calculation', () => {
            it('should calculate correct total under threshold', () => {
                const items = [{ price: 15.99, quantity: 1 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(15.99);
                expect(shipping).toBe(3.49);
                expect(total).toBeCloseTo(19.48, 2);
            });

            it('should calculate correct total at threshold', () => {
                const items = [{ price: 20.00, quantity: 1 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(20.00);
                expect(shipping).toBe(0);
                expect(total).toBe(20.00);
            });

            it('should calculate correct total over threshold', () => {
                const items = [{ price: 50.00, quantity: 1 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(50.00);
                expect(shipping).toBe(0);
                expect(total).toBe(50.00);
            });

            it('should calculate total for complex order', () => {
                const items = [
                    { price: 12.99, quantity: 2 },
                    { price: 8.50, quantity: 1 },
                    { price: 5.99, quantity: 3 }
                ];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBeCloseTo(52.45, 2); // 25.98 + 8.50 + 17.97
                expect(shipping).toBe(0); // Over threshold
                expect(total).toBeCloseTo(52.45, 2);
            });
        });

        describe('Edge Cases', () => {
            it('should handle zero price items', () => {
                const items = [{ price: 0, quantity: 5 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(0);
                expect(shipping).toBe(3.49);
                expect(total).toBeCloseTo(3.49, 2);
            });

            it('should handle zero quantity', () => {
                const items = [{ price: 100, quantity: 0 }];
                const { subtotal } = calculateOrderTotals(items);
                expect(subtotal).toBe(0);
            });

            it('should handle very small amounts', () => {
                const items = [{ price: 0.01, quantity: 1 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(0.01);
                expect(shipping).toBe(3.49);
                expect(total).toBeCloseTo(3.50, 2);
            });

            it('should handle very large amounts', () => {
                const items = [{ price: 1000.00, quantity: 10 }];
                const { subtotal, shipping, total } = calculateOrderTotals(items);
                expect(subtotal).toBe(10000.00);
                expect(shipping).toBe(0);
                expect(total).toBe(10000.00);
            });

            it('should handle threshold exactly at boundary', () => {
                const items = [{ price: 19.99, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items);
                expect(shipping).toBe(3.49);

                const items2 = [{ price: 20.00, quantity: 1 }];
                const result2 = calculateOrderTotals(items2);
                expect(result2.shipping).toBe(0);
            });

            it('should handle custom zero shipping cost', () => {
                const items = [{ price: 5.00, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items, 20, 0);
                expect(shipping).toBe(0);
            });

            it('should handle custom zero threshold', () => {
                const items = [{ price: 0.01, quantity: 1 }];
                const { shipping } = calculateOrderTotals(items, 0);
                expect(shipping).toBe(0);
            });
        });
    });
});
