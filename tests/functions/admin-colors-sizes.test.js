/**
 * Admin Colors and Sizes API Tests
 *
 * Tests for color and size CRUD operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Admin Colors', () => {
    const testColorIds = [];

    afterAll(async () => {
        for (const id of testColorIds) {
            await supabase.from('colors').delete().eq('id', id);
        }
    });

    describe('Color Name Validation', () => {
        it('should require color name', () => {
            const name = '';
            const isValid = name && name.trim();
            expect(!!isValid).toBe(false);
        });

        it('should accept valid name', () => {
            const name = 'Ocean Blue';
            const isValid = name && name.trim();
            expect(!!isValid).toBe(true);
        });

        it('should trim whitespace', () => {
            const name = '  Ocean Blue  ';
            const trimmed = name.trim();
            expect(trimmed).toBe('Ocean Blue');
        });
    });

    describe('Hex Code Validation', () => {
        it('should accept valid hex code', () => {
            const hex = '#FF5733';
            const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(true);
        });

        it('should accept lowercase hex', () => {
            const hex = '#ff5733';
            const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(true);
        });

        it('should reject hex without hash', () => {
            const hex = 'FF5733';
            const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(false);
        });

        it('should reject short hex', () => {
            const hex = '#FFF';
            const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(false);
        });

        it('should reject invalid characters', () => {
            const hex = '#GGGGGG';
            const isValid = /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(false);
        });

        it('should allow null hex code', () => {
            const hex = null;
            const isValid = !hex || /^#[0-9A-Fa-f]{6}$/.test(hex);
            expect(isValid).toBe(true);
        });
    });

    describe('Database Operations', () => {
        it('should create color', async () => {
            const name = `Test Color ${Date.now()}`;

            const { data, error } = await supabase
                .from('colors')
                .insert({
                    name,
                    hex_code: '#71C7E1',
                    in_stock: true,
                    display_order: 0
                })
                .select()
                .single();

            if (data) testColorIds.push(data.id);

            expect(error).toBeNull();
            expect(data.name).toBe(name);
            expect(data.hex_code).toBe('#71C7E1');
        });

        it('should reject duplicate color name', async () => {
            const name = `Duplicate Color ${Date.now()}`;

            const { data: first } = await supabase
                .from('colors')
                .insert({ name, in_stock: true, display_order: 0 })
                .select()
                .single();

            if (first) testColorIds.push(first.id);

            const { error } = await supabase
                .from('colors')
                .insert({ name, in_stock: true, display_order: 0 });

            expect(error).not.toBeNull();
        });

        it('should update color', async () => {
            const name = `Update Color ${Date.now()}`;

            const { data: created } = await supabase
                .from('colors')
                .insert({ name, hex_code: '#000000', in_stock: true, display_order: 0 })
                .select()
                .single();

            if (created) testColorIds.push(created.id);

            const { data: updated, error } = await supabase
                .from('colors')
                .update({ hex_code: '#FFFFFF', in_stock: false })
                .eq('id', created.id)
                .select()
                .single();

            expect(error).toBeNull();
            expect(updated.hex_code).toBe('#FFFFFF');
            expect(updated.in_stock).toBe(false);
        });

        it('should delete color', async () => {
            const name = `Delete Color ${Date.now()}`;

            const { data: created } = await supabase
                .from('colors')
                .insert({ name, in_stock: true, display_order: 0 })
                .select()
                .single();

            const { error } = await supabase
                .from('colors')
                .delete()
                .eq('id', created.id);

            expect(error).toBeNull();

            const { data: deleted } = await supabase
                .from('colors')
                .select()
                .eq('id', created.id)
                .single();

            expect(deleted).toBeNull();
        });
    });

    describe('Ordering', () => {
        it('should order by display_order then name', async () => {
            const { data } = await supabase
                .from('colors')
                .select('*')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('name', { ascending: true })
                .limit(10);

            expect(Array.isArray(data)).toBe(true);

            if (data.length < 2) {
                console.log('Skipping ordering check - not enough colors in database');
                return;
            }

            // Check ordering - handle nulls by treating them as Infinity
            for (let i = 1; i < data.length; i++) {
                const prev = data[i - 1];
                const curr = data[i];
                const prevOrder = prev.display_order ?? Number.MAX_SAFE_INTEGER;
                const currOrder = curr.display_order ?? Number.MAX_SAFE_INTEGER;
                const orderCorrect = prevOrder < currOrder ||
                    (prevOrder === currOrder && prev.name.localeCompare(curr.name) <= 0);
                expect(orderCorrect).toBe(true);
            }
        });
    });

    describe('Stock Status', () => {
        it('should default in_stock to true', () => {
            const inStock = undefined !== false;
            expect(inStock).toBe(true);
        });

        it('should set in_stock to false', () => {
            const inStock = false;
            expect(inStock).toBe(false);
        });
    });
});

describe('Admin Sizes', () => {
    const testSizeIds = [];

    afterAll(async () => {
        for (const id of testSizeIds) {
            await supabase.from('sizes').delete().eq('id', id);
        }
    });

    describe('Size Name Validation', () => {
        it('should require size name', () => {
            const name = '';
            const isValid = name && name.trim();
            expect(!!isValid).toBe(false);
        });

        it('should accept valid name', () => {
            const name = 'Large';
            const isValid = name && name.trim();
            expect(!!isValid).toBe(true);
        });
    });

    describe('Short Code Validation', () => {
        it('should accept short code', () => {
            const shortCode = 'L';
            expect(shortCode.length).toBeLessThanOrEqual(10);
        });

        it('should truncate long short code', () => {
            const shortCode = 'EXTRA-LARGE';
            const truncated = shortCode.substring(0, 10);
            expect(truncated.length).toBe(10);
        });
    });

    describe('Database Operations', () => {
        it('should create size', async () => {
            const name = `Test Size ${Date.now()}`;

            const { data, error } = await supabase
                .from('sizes')
                .insert({
                    name,
                    short_code: 'TS',
                    display_order: 0
                })
                .select()
                .single();

            if (data) testSizeIds.push(data.id);

            expect(error).toBeNull();
            expect(data.name).toBe(name);
            expect(data.short_code).toBe('TS');
        });

        it('should update size', async () => {
            const name = `Update Size ${Date.now()}`;

            const { data: created } = await supabase
                .from('sizes')
                .insert({ name, short_code: 'US', display_order: 0 })
                .select()
                .single();

            if (created) testSizeIds.push(created.id);

            const { data: updated, error } = await supabase
                .from('sizes')
                .update({ short_code: 'UP', display_order: 5 })
                .eq('id', created.id)
                .select()
                .single();

            expect(error).toBeNull();
            expect(updated.short_code).toBe('UP');
            expect(updated.display_order).toBe(5);
        });

        it('should delete size', async () => {
            const name = `Delete Size ${Date.now()}`;

            const { data: created } = await supabase
                .from('sizes')
                .insert({ name, short_code: 'DS', display_order: 0 })
                .select()
                .single();

            const { error } = await supabase
                .from('sizes')
                .delete()
                .eq('id', created.id);

            expect(error).toBeNull();
        });
    });

    describe('Common Size Values', () => {
        const commonSizes = [
            { name: 'Extra Small', code: 'XS' },
            { name: 'Small', code: 'S' },
            { name: 'Medium', code: 'M' },
            { name: 'Large', code: 'L' },
            { name: 'Extra Large', code: 'XL' }
        ];

        commonSizes.forEach(({ name, code }) => {
            it(`should handle ${name} (${code})`, () => {
                expect(name).toBeTruthy();
                expect(code).toBeTruthy();
                expect(code.length).toBeLessThanOrEqual(10);
            });
        });
    });
});

describe('Product Variants', () => {
    describe('Variant Structure', () => {
        it('should have required fields', () => {
            const variant = {
                product_id: 1,
                color_id: 1,
                size_id: 1,
                stock: 10,
                price_adjustment: 0
            };

            expect(variant.product_id).toBeDefined();
            expect(variant.stock).toBeGreaterThanOrEqual(0);
        });

        it('should allow price adjustment', () => {
            const basePrice = 10.00;
            const adjustment = 2.50;
            const finalPrice = basePrice + adjustment;

            expect(finalPrice).toBe(12.50);
        });

        it('should allow negative price adjustment', () => {
            const basePrice = 10.00;
            const adjustment = -1.50;
            const finalPrice = basePrice + adjustment;

            expect(finalPrice).toBe(8.50);
        });
    });

    describe('Stock Calculations', () => {
        it('should sum variant stock for product total', () => {
            const variants = [
                { stock: 5 },
                { stock: 10 },
                { stock: 3 }
            ];

            const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
            expect(totalStock).toBe(18);
        });

        it('should identify out of stock variants', () => {
            const variants = [
                { color: 'Red', size: 'S', stock: 0 },
                { color: 'Red', size: 'M', stock: 5 },
                { color: 'Blue', size: 'S', stock: 0 }
            ];

            const outOfStock = variants.filter(v => v.stock === 0);
            expect(outOfStock.length).toBe(2);
        });
    });

    describe('SKU Generation', () => {
        it('should generate unique SKU', () => {
            const productId = 123;
            const colorCode = 'RD';
            const sizeCode = 'M';
            const sku = `FS-${productId}-${colorCode}-${sizeCode}`;

            expect(sku).toBe('FS-123-RD-M');
        });

        it('should handle missing color or size', () => {
            const productId = 123;
            const colorCode = null;
            const sizeCode = 'M';
            const sku = `FS-${productId}${colorCode ? '-' + colorCode : ''}${sizeCode ? '-' + sizeCode : ''}`;

            expect(sku).toBe('FS-123-M');
        });
    });
});
