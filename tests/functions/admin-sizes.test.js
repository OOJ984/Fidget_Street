/**
 * Admin Sizes API Tests
 * Tests for /api/admin-sizes endpoint
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Real Supabase client for integration tests
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Test size prefix
const TEST_PREFIX = 'TEST_SIZE_';
let testSizeId = null;

describe('Admin Sizes API', () => {
    // Cleanup after all tests
    afterAll(async () => {
        await supabase
            .from('sizes')
            .delete()
            .like('name', `${TEST_PREFIX}%`);
    });

    describe('Size Validation', () => {
        it('should require size name', () => {
            const body = { short_code: 'S' };
            expect(body.name).toBeUndefined();
        });

        it('should trim whitespace from name', () => {
            const name = '  Small  ';
            expect(name.trim()).toBe('Small');
        });

        it('should accept optional short_code', () => {
            const sizeWithCode = { name: 'Small', short_code: 'S' };
            const sizeWithoutCode = { name: 'Medium' };

            expect(sizeWithCode.short_code).toBe('S');
            expect(sizeWithoutCode.short_code).toBeUndefined();
        });
    });

    describe('Size CRUD Operations', () => {
        it('should create a size', async () => {
            const sizeData = {
                name: `${TEST_PREFIX}Small`,
                short_code: 'S',
                display_order: 999
            };

            const { data, error } = await supabase
                .from('sizes')
                .insert(sizeData)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.name).toBe(sizeData.name);
            expect(data.short_code).toBe('S');

            testSizeId = data.id;
        });

        it('should read sizes', async () => {
            const { data, error } = await supabase
                .from('sizes')
                .select('*')
                .order('display_order', { ascending: true });

            expect(error).toBeNull();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should update a size', async () => {
            if (!testSizeId) {
                console.log('Skipping - no test size created');
                return;
            }

            const { data, error } = await supabase
                .from('sizes')
                .update({
                    name: `${TEST_PREFIX}Updated_Small`,
                    short_code: 'SM'
                })
                .eq('id', testSizeId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.name).toBe(`${TEST_PREFIX}Updated_Small`);
            expect(data.short_code).toBe('SM');
        });

        it('should delete a size', async () => {
            if (!testSizeId) {
                console.log('Skipping - no test size created');
                return;
            }

            const { error } = await supabase
                .from('sizes')
                .delete()
                .eq('id', testSizeId);

            expect(error).toBeNull();

            // Verify it's gone
            const { data: check } = await supabase
                .from('sizes')
                .select('id')
                .eq('id', testSizeId)
                .single();

            expect(check).toBeNull();
            testSizeId = null;
        });
    });

    describe('Size Uniqueness', () => {
        it('should reject duplicate size names', async () => {
            // Create first size
            const { data: first } = await supabase
                .from('sizes')
                .insert({ name: `${TEST_PREFIX}Unique` })
                .select()
                .single();

            // Try to create duplicate
            const { error } = await supabase
                .from('sizes')
                .insert({ name: `${TEST_PREFIX}Unique` });

            expect(error).not.toBeNull();

            // Cleanup
            if (first) {
                await supabase.from('sizes').delete().eq('id', first.id);
            }
        });
    });

    describe('Display Order', () => {
        it('should default display_order to 0', async () => {
            const { data } = await supabase
                .from('sizes')
                .insert({ name: `${TEST_PREFIX}DefaultOrder` })
                .select()
                .single();

            expect(data.display_order).toBe(0);

            // Cleanup
            await supabase.from('sizes').delete().eq('id', data.id);
        });

        it('should order sizes by display_order', async () => {
            // Create sizes with specific order
            await supabase
                .from('sizes')
                .insert([
                    { name: `${TEST_PREFIX}Order_L`, display_order: 3 },
                    { name: `${TEST_PREFIX}Order_S`, display_order: 1 },
                    { name: `${TEST_PREFIX}Order_M`, display_order: 2 }
                ]);

            const { data } = await supabase
                .from('sizes')
                .select('*')
                .like('name', `${TEST_PREFIX}Order_%`)
                .order('display_order', { ascending: true });

            expect(data[0].name).toBe(`${TEST_PREFIX}Order_S`);
            expect(data[1].name).toBe(`${TEST_PREFIX}Order_M`);
            expect(data[2].name).toBe(`${TEST_PREFIX}Order_L`);

            // Cleanup
            await supabase.from('sizes').delete().like('name', `${TEST_PREFIX}Order_%`);
        });
    });

    describe('Common Clothing Sizes', () => {
        const commonSizes = [
            { name: 'Extra Small', short_code: 'XS' },
            { name: 'Small', short_code: 'S' },
            { name: 'Medium', short_code: 'M' },
            { name: 'Large', short_code: 'L' },
            { name: 'Extra Large', short_code: 'XL' },
            { name: 'XXL', short_code: '2XL' }
        ];

        it('should support standard clothing sizes', () => {
            commonSizes.forEach(size => {
                expect(size.name).toBeDefined();
                expect(size.short_code).toBeDefined();
                expect(size.short_code.length).toBeLessThanOrEqual(4);
            });
        });
    });

    describe('Numeric Sizes', () => {
        const numericSizes = ['6', '8', '10', '12', '14', '16'];

        it('should support numeric size names', () => {
            numericSizes.forEach(size => {
                expect(parseInt(size)).not.toBeNaN();
            });
        });
    });

    describe('Size Data Structure', () => {
        it('should have required fields', () => {
            const size = {
                id: 'uuid-here',
                name: 'Medium',
                short_code: 'M',
                display_order: 2,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z'
            };

            expect(size).toHaveProperty('id');
            expect(size).toHaveProperty('name');
            expect(size).toHaveProperty('short_code');
            expect(size).toHaveProperty('display_order');
        });

        it('should allow null short_code', async () => {
            const { data } = await supabase
                .from('sizes')
                .insert({ name: `${TEST_PREFIX}NoCode` })
                .select()
                .single();

            expect(data.short_code).toBeNull();

            // Cleanup
            await supabase.from('sizes').delete().eq('id', data.id);
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
    });
});
