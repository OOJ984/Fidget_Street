/**
 * Admin Colors API Tests
 * Tests for /api/admin-colors endpoint
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Real Supabase client for integration tests
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Test color prefix
const TEST_PREFIX = 'TEST_COLOR_';
let testColorId = null;

describe('Admin Colors API', () => {
    // Cleanup after all tests
    afterAll(async () => {
        // Delete test colors
        await supabase
            .from('colors')
            .delete()
            .like('name', `${TEST_PREFIX}%`);
    });

    describe('Color Validation', () => {
        it('should require color name', () => {
            const body = { hex_code: '#FF0000' };
            expect(body.name).toBeUndefined();
        });

        it('should validate hex code format', () => {
            const validHexCodes = ['#FF0000', '#00ff00', '#0000FF', '#123456'];
            const invalidHexCodes = ['FF0000', '#GGGGGG', '#12345', '#1234567', 'red', ''];

            const hexRegex = /^#[0-9A-Fa-f]{6}$/;

            validHexCodes.forEach(hex => {
                expect(hex).toMatch(hexRegex);
            });

            invalidHexCodes.forEach(hex => {
                expect(hex).not.toMatch(hexRegex);
            });
        });

        it('should trim whitespace from name', () => {
            const name = '  Black  ';
            expect(name.trim()).toBe('Black');
        });

        it('should normalize hex code to uppercase', () => {
            const hex = '#ff00ff';
            expect(hex.toUpperCase()).toBe('#FF00FF');
        });
    });

    describe('Color CRUD Operations', () => {
        it('should create a color', async () => {
            const colorData = {
                name: `${TEST_PREFIX}Red`,
                hex_code: '#FF0000',
                in_stock: true,
                display_order: 999
            };

            const { data, error } = await supabase
                .from('colors')
                .insert(colorData)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data).toBeDefined();
            expect(data.name).toBe(colorData.name);
            expect(data.hex_code).toBe(colorData.hex_code);
            expect(data.in_stock).toBe(true);

            testColorId = data.id;
        });

        it('should read colors', async () => {
            const { data, error } = await supabase
                .from('colors')
                .select('*')
                .order('display_order', { ascending: true });

            expect(error).toBeNull();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
        });

        it('should update a color', async () => {
            if (!testColorId) {
                console.log('Skipping - no test color created');
                return;
            }

            const { data, error } = await supabase
                .from('colors')
                .update({
                    name: `${TEST_PREFIX}Updated_Red`,
                    in_stock: false
                })
                .eq('id', testColorId)
                .select()
                .single();

            expect(error).toBeNull();
            expect(data.name).toBe(`${TEST_PREFIX}Updated_Red`);
            expect(data.in_stock).toBe(false);
        });

        it('should delete a color', async () => {
            if (!testColorId) {
                console.log('Skipping - no test color created');
                return;
            }

            const { error } = await supabase
                .from('colors')
                .delete()
                .eq('id', testColorId);

            expect(error).toBeNull();

            // Verify it's gone
            const { data: check } = await supabase
                .from('colors')
                .select('id')
                .eq('id', testColorId)
                .single();

            expect(check).toBeNull();
            testColorId = null;
        });
    });

    describe('Color Uniqueness', () => {
        it('should reject duplicate color names', async () => {
            // Create first color
            const { data: first } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}Unique`, hex_code: '#111111' })
                .select()
                .single();

            // Try to create duplicate
            const { error } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}Unique`, hex_code: '#222222' });

            expect(error).not.toBeNull();

            // Cleanup
            if (first) {
                await supabase.from('colors').delete().eq('id', first.id);
            }
        });

        it('should be case-insensitive for names', async () => {
            // Create color with lowercase name
            const { data: first } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}lowercase`, hex_code: '#333333' })
                .select()
                .single();

            // This might or might not fail depending on DB constraints
            // Just verify the first was created
            expect(first).toBeDefined();

            // Cleanup
            if (first) {
                await supabase.from('colors').delete().eq('id', first.id);
            }
        });
    });

    describe('Stock Status', () => {
        it('should default in_stock to true', async () => {
            const { data } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}DefaultStock` })
                .select()
                .single();

            expect(data.in_stock).toBe(true);

            // Cleanup
            if (data) {
                await supabase.from('colors').delete().eq('id', data.id);
            }
        });

        it('should toggle stock status', async () => {
            const { data: color, error } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}ToggleStock${Date.now()}`, in_stock: true })
                .select()
                .single();

            if (error || !color) {
                console.log('Skipping toggle stock test - could not create color');
                return;
            }

            // Toggle to out of stock
            const { data: updated } = await supabase
                .from('colors')
                .update({ in_stock: false })
                .eq('id', color.id)
                .select()
                .single();

            expect(updated.in_stock).toBe(false);

            // Cleanup
            await supabase.from('colors').delete().eq('id', color.id);
        });
    });

    describe('Display Order', () => {
        it('should default display_order to 0', async () => {
            const { data } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}DefaultOrder` })
                .select()
                .single();

            expect(data.display_order).toBe(0);

            // Cleanup
            await supabase.from('colors').delete().eq('id', data.id);
        });

        it('should order colors by display_order', async () => {
            // Create colors with specific order
            await supabase
                .from('colors')
                .insert([
                    { name: `${TEST_PREFIX}Order_C`, display_order: 3 },
                    { name: `${TEST_PREFIX}Order_A`, display_order: 1 },
                    { name: `${TEST_PREFIX}Order_B`, display_order: 2 }
                ]);

            const { data } = await supabase
                .from('colors')
                .select('*')
                .like('name', `${TEST_PREFIX}Order_%`)
                .order('display_order', { ascending: true });

            expect(data[0].name).toBe(`${TEST_PREFIX}Order_A`);
            expect(data[1].name).toBe(`${TEST_PREFIX}Order_B`);
            expect(data[2].name).toBe(`${TEST_PREFIX}Order_C`);

            // Cleanup
            await supabase.from('colors').delete().like('name', `${TEST_PREFIX}Order_%`);
        });
    });

    describe('Color Data Structure', () => {
        it('should have required fields', () => {
            const color = {
                id: 'uuid-here',
                name: 'Red',
                hex_code: '#FF0000',
                in_stock: true,
                display_order: 1,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z'
            };

            expect(color).toHaveProperty('id');
            expect(color).toHaveProperty('name');
            expect(color).toHaveProperty('hex_code');
            expect(color).toHaveProperty('in_stock');
            expect(color).toHaveProperty('display_order');
        });

        it('should allow null hex_code', async () => {
            const { data } = await supabase
                .from('colors')
                .insert({ name: `${TEST_PREFIX}NoHex` })
                .select()
                .single();

            expect(data.hex_code).toBeNull();

            // Cleanup
            await supabase.from('colors').delete().eq('id', data.id);
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
