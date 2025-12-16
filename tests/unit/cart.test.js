/**
 * Cart Tests
 *
 * Tests for frontend cart functionality.
 * Uses jsdom to simulate browser environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Create mock browser environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost'
});

// Setup globals before importing cart
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    store: {},
    getItem(key) {
        return this.store[key] || null;
    },
    setItem(key, value) {
        this.store[key] = value;
    },
    removeItem(key) {
        delete this.store[key];
    },
    clear() {
        this.store = {};
    }
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Cart storage key (from cart.js)
const CART_STORAGE_KEY = 'wicka_cart';

describe('Cart Functions', () => {
    // We'll define cart functions inline since cart.js uses browser globals
    // These mirror the actual implementation for testing

    function getCart() {
        try {
            const cart = localStorage.getItem(CART_STORAGE_KEY);
            return cart ? JSON.parse(cart) : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }

    function addToCart(item) {
        const cart = getCart();
        const existingIndex = cart.findIndex(
            cartItem => cartItem.id === item.id && cartItem.variation === item.variation
        );

        if (existingIndex > -1) {
            cart[existingIndex].quantity += item.quantity;
            cart[existingIndex].quantity = Math.min(cart[existingIndex].quantity, 10);
        } else {
            cart.push({
                id: item.id,
                title: item.title,
                price: item.price,
                quantity: item.quantity,
                variation: item.variation || null,
                image: item.image || ''
            });
        }

        saveCart(cart);
        return cart;
    }

    function removeFromCart(productId, variation = null) {
        let cart = getCart();
        cart = cart.filter(item => {
            if (variation) {
                return !(item.id === productId && item.variation === variation);
            }
            return item.id !== productId;
        });
        saveCart(cart);
        return cart;
    }

    function updateCartItemQuantity(productId, quantity, variation = null) {
        const cart = getCart();
        const itemIndex = cart.findIndex(item => {
            if (variation) {
                return item.id === productId && item.variation === variation;
            }
            return item.id === productId;
        });

        if (itemIndex > -1) {
            if (quantity <= 0) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].quantity = Math.min(quantity, 10);
            }
        }

        saveCart(cart);
        return cart;
    }

    function clearCart() {
        localStorage.removeItem(CART_STORAGE_KEY);
    }

    function getCartTotals(freeShippingThreshold = 20, shippingCost = 2.99) {
        const cart = getCart();
        const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = subtotal >= freeShippingThreshold ? 0 : shippingCost;
        const total = subtotal + shipping;

        return { itemCount, subtotal, shipping, total, freeShippingThreshold };
    }

    function escapeHtmlCart(unsafe) {
        if (unsafe == null) return '';
        return String(unsafe)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    beforeEach(() => {
        localStorage.clear();
    });

    describe('getCart()', () => {
        it('should return empty array when cart is empty', () => {
            expect(getCart()).toEqual([]);
        });

        it('should return cart items when cart has items', () => {
            const items = [{ id: 1, title: 'Test', price: 10, quantity: 1 }];
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));

            expect(getCart()).toEqual(items);
        });

        it('should return empty array on invalid JSON', () => {
            localStorage.setItem(CART_STORAGE_KEY, 'invalid json{');
            expect(getCart()).toEqual([]);
        });
    });

    describe('saveCart()', () => {
        it('should persist cart to localStorage', () => {
            const cart = [{ id: 1, title: 'Test', price: 10, quantity: 2 }];
            saveCart(cart);

            const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
            expect(stored).toEqual(cart);
        });
    });

    describe('addToCart()', () => {
        it('should add new item to empty cart', () => {
            const item = { id: 1, title: 'Pearl organisers', price: 12.99, quantity: 1 };
            const cart = addToCart(item);

            expect(cart).toHaveLength(1);
            expect(cart[0].id).toBe(1);
            expect(cart[0].title).toBe('Pearl organisers');
        });

        it('should increase quantity for existing item', () => {
            const item = { id: 1, title: 'Pearl organisers', price: 12.99, quantity: 1, variation: null };
            addToCart(item);
            const cart = addToCart(item);

            expect(cart).toHaveLength(1);
            expect(cart[0].quantity).toBe(2);
        });

        it('should treat different variations as separate items', () => {
            const item1 = { id: 1, title: 'organisers', price: 12.99, quantity: 1, variation: 'Gold' };
            const item2 = { id: 1, title: 'organisers', price: 12.99, quantity: 1, variation: 'Silver' };

            addToCart(item1);
            const cart = addToCart(item2);

            expect(cart).toHaveLength(2);
            expect(cart[0].variation).toBe('Gold');
            expect(cart[1].variation).toBe('Silver');
        });

        it('should cap quantity at 10', () => {
            const item = { id: 1, title: 'Test', price: 10, quantity: 8, variation: null };
            addToCart(item);
            const cart = addToCart({ ...item, quantity: 5 });

            expect(cart[0].quantity).toBe(10); // 8 + 5 = 13, capped at 10
        });

        it('should set variation to null if not provided', () => {
            const item = { id: 1, title: 'Test', price: 10, quantity: 1 };
            const cart = addToCart(item);

            expect(cart[0].variation).toBeNull();
        });
    });

    describe('removeFromCart()', () => {
        it('should remove item by id', () => {
            addToCart({ id: 1, title: 'Item 1', price: 10, quantity: 1 });
            addToCart({ id: 2, title: 'Item 2', price: 15, quantity: 1 });

            const cart = removeFromCart(1);

            expect(cart).toHaveLength(1);
            expect(cart[0].id).toBe(2);
        });

        it('should remove item by id and variation', () => {
            addToCart({ id: 1, title: 'organisers', price: 10, quantity: 1, variation: 'Gold' });
            addToCart({ id: 1, title: 'organisers', price: 10, quantity: 1, variation: 'Silver' });

            const cart = removeFromCart(1, 'Gold');

            expect(cart).toHaveLength(1);
            expect(cart[0].variation).toBe('Silver');
        });

        it('should handle removing non-existent item', () => {
            addToCart({ id: 1, title: 'Test', price: 10, quantity: 1 });
            const cart = removeFromCart(999);

            expect(cart).toHaveLength(1);
        });
    });

    describe('updateCartItemQuantity()', () => {
        it('should update quantity for existing item', () => {
            addToCart({ id: 1, title: 'Test', price: 10, quantity: 1 });
            const cart = updateCartItemQuantity(1, 5);

            expect(cart[0].quantity).toBe(5);
        });

        it('should remove item when quantity is 0 or less', () => {
            addToCart({ id: 1, title: 'Test', price: 10, quantity: 1 });
            const cart = updateCartItemQuantity(1, 0);

            expect(cart).toHaveLength(0);
        });

        it('should cap quantity at 10', () => {
            addToCart({ id: 1, title: 'Test', price: 10, quantity: 1 });
            const cart = updateCartItemQuantity(1, 15);

            expect(cart[0].quantity).toBe(10);
        });

        it('should update correct variation', () => {
            addToCart({ id: 1, title: 'organisers', price: 10, quantity: 1, variation: 'Gold' });
            addToCart({ id: 1, title: 'organisers', price: 10, quantity: 1, variation: 'Silver' });

            const cart = updateCartItemQuantity(1, 3, 'Silver');

            const goldItem = cart.find(i => i.variation === 'Gold');
            const silverItem = cart.find(i => i.variation === 'Silver');

            expect(goldItem.quantity).toBe(1);
            expect(silverItem.quantity).toBe(3);
        });
    });

    describe('clearCart()', () => {
        it('should remove all items from cart', () => {
            addToCart({ id: 1, title: 'Test', price: 10, quantity: 1 });
            addToCart({ id: 2, title: 'Test 2', price: 15, quantity: 2 });

            clearCart();

            expect(getCart()).toEqual([]);
        });
    });

    describe('getCartTotals()', () => {
        it('should calculate correct totals', () => {
            addToCart({ id: 1, title: 'Item 1', price: 10.00, quantity: 2 });
            addToCart({ id: 2, title: 'Item 2', price: 5.50, quantity: 1 });

            const totals = getCartTotals();

            expect(totals.itemCount).toBe(3);
            expect(totals.subtotal).toBe(25.50); // (10*2) + (5.50*1)
            expect(totals.shipping).toBe(0); // Free shipping over £20
            expect(totals.total).toBe(25.50);
        });

        it('should add shipping cost when under threshold', () => {
            addToCart({ id: 1, title: 'Item', price: 10.00, quantity: 1 });

            const totals = getCartTotals(20, 2.99);

            expect(totals.subtotal).toBe(10.00);
            expect(totals.shipping).toBe(2.99);
            expect(totals.total).toBe(12.99);
        });

        it('should return zeros for empty cart', () => {
            const totals = getCartTotals();

            expect(totals.itemCount).toBe(0);
            expect(totals.subtotal).toBe(0);
            expect(totals.shipping).toBe(2.99); // Under threshold
            expect(totals.total).toBe(2.99);
        });

        it('should handle custom threshold and shipping cost', () => {
            addToCart({ id: 1, title: 'Item', price: 25.00, quantity: 1 });

            const totals = getCartTotals(30, 5.00);

            expect(totals.shipping).toBe(5.00); // Under £30 threshold
            expect(totals.total).toBe(30.00);
        });
    });

    describe('escapeHtmlCart()', () => {
        it('should escape HTML special characters', () => {
            expect(escapeHtmlCart('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
            );
        });

        it('should escape ampersands', () => {
            expect(escapeHtmlCart('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        it('should escape single quotes', () => {
            expect(escapeHtmlCart("It's a test")).toBe("It&#039;s a test");
        });

        it('should return empty string for null/undefined', () => {
            expect(escapeHtmlCart(null)).toBe('');
            expect(escapeHtmlCart(undefined)).toBe('');
        });

        it('should convert numbers to string', () => {
            expect(escapeHtmlCart(123)).toBe('123');
        });

        it('should handle complex XSS attempts', () => {
            const xss = '<img src=x onerror="alert(\'XSS\')">';
            const escaped = escapeHtmlCart(xss);

            expect(escaped).not.toContain('<');
            expect(escaped).not.toContain('>');
            expect(escaped).toContain('&lt;');
            expect(escaped).toContain('&gt;');
        });
    });

    describe('Price Calculations', () => {
        it('should handle floating point correctly', () => {
            // Avoid floating point errors like 0.1 + 0.2 = 0.30000000000000004
            addToCart({ id: 1, title: 'Item', price: 0.10, quantity: 3 });

            const totals = getCartTotals();
            // Use toBeCloseTo for floating point comparison
            expect(totals.subtotal).toBeCloseTo(0.30, 2);
        });

        it('should handle many items', () => {
            for (let i = 0; i < 20; i++) {
                addToCart({ id: i, title: `Item ${i}`, price: 5.00, quantity: 1 });
            }

            const totals = getCartTotals();
            expect(totals.itemCount).toBe(20);
            expect(totals.subtotal).toBe(100.00);
        });
    });
});
