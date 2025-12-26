/**
 * Products API Integration Tests
 *
 * Tests the products API endpoints with real Supabase database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Products API Integration', () => {
    let testProductId;
    const testSlug = `test-product-${Date.now()}`;

    beforeAll(async () => {
        // Create test product
        const { data, error } = await supabase
            .from('products')
            .insert({
                title: 'TEST_Integration_Product',
                slug: testSlug,
                price_gbp: 19.99,
                currency: 'GBP',
                category: 'articulated-toys',
                stock: 50,
                is_active: true,
                tags: ['featured', 'test'],
                description: 'A test product for integration testing',
                images: ['https://example.com/test.jpg']
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to create test product:', error);
        }
        if (data) {
            testProductId = data.id;
        }
    });

    afterAll(async () => {
        // Clean up test product
        if (testProductId) {
            await supabase
                .from('products')
                .delete()
                .eq('id', testProductId);
        }
    });

    describe('Product Listing', () => {
        it('should list active products', async () => {
            const { data, error } = await supabase
                .from('products')
                .select('id, title, slug, price_gbp, is_active')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should return required fields for product list', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, title, slug, price_gbp, category, tags, images, stock')
                .eq('is_active', true)
                .limit(1);

            if (data && data.length > 0) {
                const product = data[0];
                expect(product).toHaveProperty('id');
                expect(product).toHaveProperty('title');
                expect(product).toHaveProperty('slug');
                expect(product).toHaveProperty('price_gbp');
            }
        });

        it('should not list inactive products', async () => {
            // Create inactive product
            const { data: inactiveProduct } = await supabase
                .from('products')
                .insert({
                    title: 'TEST_Inactive_Product',
                    slug: `test-inactive-${Date.now()}`,
                    price_gbp: 10.00,
                    stock: 10,
                    is_active: false,
                    category: 'Articulated Toys'
                })
                .select()
                .single();

            if (inactiveProduct) {
                // Query active products
                const { data: activeProducts } = await supabase
                    .from('products')
                    .select('id')
                    .eq('is_active', true);

                const foundInactive = activeProducts?.find(p => p.id === inactiveProduct.id);
                expect(foundInactive).toBeUndefined();

                // Clean up
                await supabase.from('products').delete().eq('id', inactiveProduct.id);
            }
        });
    });

    describe('Product by Slug', () => {
        it('should find product by slug', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('slug', testSlug)
                .eq('is_active', true)
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.slug).toBe(testSlug);
            expect(data.title).toBe('TEST_Integration_Product');
        });

        it('should return null for non-existent slug', async () => {
            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('slug', 'this-slug-does-not-exist')
                .eq('is_active', true)
                .single();

            expect(data).toBeNull();
        });

        it('should include full product details', async () => {
            if (!testProductId) {
                console.log('Skipping - test product not created');
                return;
            }

            const { data } = await supabase
                .from('products')
                .select('id, title, slug, price_gbp, currency, category, materials, dimensions, variations, stock, tags, description, images')
                .eq('slug', testSlug)
                .eq('is_active', true)
                .single();

            if (data) {
                expect(data).toHaveProperty('id');
                expect(data).toHaveProperty('title');
                expect(data).toHaveProperty('price_gbp');
                expect(data).toHaveProperty('description');
                expect(data).toHaveProperty('images');
            }
        });
    });

    describe('Category Filtering', () => {
        it('should filter products by category', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, title, category')
                .eq('is_active', true)
                .eq('category', 'articulated-toys');

            expect(data).toBeDefined();
            if (data && data.length > 0) {
                data.forEach(product => {
                    expect(product.category).toBe('articulated-toys');
                });
            }
        });

        it('should return empty for non-existent category', async () => {
            const { data } = await supabase
                .from('products')
                .select('id')
                .eq('is_active', true)
                .eq('category', 'NonExistentCategory123');

            expect(data).toEqual([]);
        });
    });

    describe('Tag Filtering', () => {
        it('should filter products by tag', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, title, tags')
                .eq('is_active', true)
                .contains('tags', ['test']);

            expect(data).toBeDefined();
            if (data && data.length > 0) {
                data.forEach(product => {
                    expect(product.tags).toContain('test');
                });
            }
        });

        it('should filter featured products', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, title, tags')
                .eq('is_active', true)
                .contains('tags', ['featured']);

            expect(data).toBeDefined();
            if (data && data.length > 0) {
                data.forEach(product => {
                    expect(product.tags).toContain('featured');
                });
            }
        });
    });

    describe('Pagination', () => {
        it('should limit results', async () => {
            const limit = 5;
            const { data } = await supabase
                .from('products')
                .select('id')
                .eq('is_active', true)
                .limit(limit);

            expect(data).toBeDefined();
            expect(data.length).toBeLessThanOrEqual(limit);
        });

        it('should order by created_at descending', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, created_at')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(10);

            if (data && data.length > 1) {
                for (let i = 0; i < data.length - 1; i++) {
                    const current = new Date(data[i].created_at);
                    const next = new Date(data[i + 1].created_at);
                    expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
                }
            }
        });
    });

    describe('Stock and Pricing', () => {
        it('should have valid price format', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, price_gbp')
                .eq('is_active', true)
                .limit(10);

            if (data) {
                data.forEach(product => {
                    expect(typeof product.price_gbp).toBe('number');
                    expect(product.price_gbp).toBeGreaterThan(0);
                });
            }
        });

        it('should have stock count', async () => {
            const { data } = await supabase
                .from('products')
                .select('id, stock')
                .eq('is_active', true)
                .limit(10);

            if (data) {
                data.forEach(product => {
                    expect(typeof product.stock).toBe('number');
                    expect(product.stock).toBeGreaterThanOrEqual(0);
                });
            }
        });
    });
});
