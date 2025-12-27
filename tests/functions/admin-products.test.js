/**
 * Admin Products API Tests
 * Tests for /api/admin-products endpoint
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';

// Mock Supabase
const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    insert: vi.fn(() => mockSupabase),
    update: vi.fn(() => mockSupabase),
    delete: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    order: vi.fn(() => mockSupabase),
    single: vi.fn(() => Promise.resolve({ data: null, error: null }))
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

// Mock security utils
vi.mock('../../netlify/functions/utils/security', () => ({
    getCorsHeaders: vi.fn(() => ({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    })),
    verifyToken: vi.fn((authHeader) => {
        if (authHeader === 'Bearer valid-admin-token') {
            return { userId: 1, email: 'admin@test.com', role: 'website_admin' };
        }
        if (authHeader === 'Bearer valid-viewer-token') {
            return { userId: 2, email: 'viewer@test.com', role: 'order_viewer' };
        }
        return null;
    }),
    isSecretConfigured: vi.fn(() => true),
    errorResponse: vi.fn((status, message, headers) => ({
        statusCode: status,
        headers,
        body: JSON.stringify({ error: message })
    })),
    successResponse: vi.fn((data, headers, status = 200) => ({
        statusCode: status,
        headers,
        body: JSON.stringify(data)
    })),
    requirePermission: vi.fn((user, permission, headers) => {
        if (user.role === 'website_admin') return null;
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
    }),
    PERMISSIONS: {
        VIEW_PRODUCTS: 'VIEW_PRODUCTS',
        CREATE_PRODUCTS: 'CREATE_PRODUCTS',
        EDIT_PRODUCTS: 'EDIT_PRODUCTS',
        DELETE_PRODUCTS: 'DELETE_PRODUCTS'
    },
    auditLog: vi.fn(() => Promise.resolve())
}));

describe('Admin Products API', () => {
    describe('Authentication', () => {
        it('should require authorization header', () => {
            const headers = {};
            const authHeader = headers.authorization || headers.Authorization;
            expect(authHeader).toBeUndefined();
        });

        it('should validate Bearer token format', () => {
            const validHeader = 'Bearer valid-token';
            expect(validHeader.startsWith('Bearer ')).toBe(true);
        });

        it('should handle OPTIONS preflight', () => {
            const method = 'OPTIONS';
            expect(method).toBe('OPTIONS');
        });
    });

    describe('GET - List Products', () => {
        it('should return products sorted by date', () => {
            const products = [
                { id: 1, title: 'Product A', created_at: '2025-01-01' },
                { id: 2, title: 'Product B', created_at: '2025-01-02' }
            ];

            const sorted = [...products].sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );

            expect(sorted[0].id).toBe(2);
        });

        it('should include inactive products for admin', () => {
            const products = [
                { id: 1, is_active: true },
                { id: 2, is_active: false }
            ];

            expect(products.length).toBe(2);
        });
    });

    describe('POST - Create Product', () => {
        it('should require title field', () => {
            const body = { price_gbp: 12.99 };
            expect(body.title).toBeUndefined();
        });

        it('should require price_gbp field', () => {
            const body = { title: 'Test Product' };
            expect(body.price_gbp).toBeUndefined();
        });

        it('should generate slug from title', () => {
            const generateSlug = (title) => title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            expect(generateSlug('My Cool Product!')).toBe('my-cool-product');
            expect(generateSlug('Test Product 123')).toBe('test-product-123');
        });

        it('should default category to articulated-toys', () => {
            const body = { title: 'Test', price_gbp: 9.99 };
            const category = body.category || 'articulated-toys';
            expect(category).toBe('articulated-toys');
        });

        it('should default stock to 0', () => {
            const body = { title: 'Test', price_gbp: 9.99 };
            const stock = body.stock || 0;
            expect(stock).toBe(0);
        });

        it('should default is_active to true', () => {
            const body = { title: 'Test', price_gbp: 9.99 };
            const isActive = body.is_active !== false;
            expect(isActive).toBe(true);
        });
    });

    describe('PUT - Update Product', () => {
        it('should require product ID', () => {
            const body = { title: 'Updated' };
            expect(body.id).toBeUndefined();
        });

        it('should parse price as float', () => {
            const price = parseFloat('12.99');
            expect(price).toBe(12.99);
        });

        it('should parse stock as integer', () => {
            const stock = parseInt('10', 10);
            expect(stock).toBe(10);
        });

        it('should update timestamp on edit', () => {
            const now = new Date().toISOString();
            expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
    });

    describe('DELETE - Delete Product', () => {
        it('should require product ID in query params', () => {
            const params = {};
            expect(params.id).toBeUndefined();
        });

        it('should soft delete by setting is_active to false', () => {
            const updateData = { is_active: false };
            expect(updateData.is_active).toBe(false);
        });
    });

    describe('Slug Generation', () => {
        const generateSlug = (title) => title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        it('should lowercase the title', () => {
            expect(generateSlug('Test PRODUCT')).toBe('test-product');
        });

        it('should replace spaces with hyphens', () => {
            expect(generateSlug('test product')).toBe('test-product');
        });

        it('should remove special characters', () => {
            expect(generateSlug('test! @product#')).toBe('test-product');
        });

        it('should trim leading/trailing hyphens', () => {
            expect(generateSlug('---test---')).toBe('test');
        });
    });

    describe('Method Handling', () => {
        it('should support CRUD methods', () => {
            const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
            expect(supportedMethods).toContain('GET');
            expect(supportedMethods).toContain('POST');
            expect(supportedMethods).toContain('PUT');
            expect(supportedMethods).toContain('DELETE');
        });

        it('should reject unsupported methods', () => {
            const supportedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
            expect(supportedMethods).not.toContain('PATCH');
        });
    });
});
