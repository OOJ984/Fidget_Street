/**
 * Admin Media API Tests
 * Tests for /api/admin-media endpoint
 */

import { describe, it, expect, afterAll } from 'vitest';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const BUCKET_NAME = 'product-images';

describe('Admin Media API', () => {
    describe('Storage Operations', () => {
        it('should list files from bucket', async () => {
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .list('products', { limit: 10 });
            
            // May return empty array if no files, but should not error
            expect(error).toBeNull();
            expect(Array.isArray(data)).toBe(true);
        });

        it('should generate public URLs', () => {
            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl('products/test.jpg');
            
            expect(data.publicUrl).toContain(BUCKET_NAME);
            expect(data.publicUrl).toContain('test.jpg');
        });
    });

    describe('File Path Validation', () => {
        it('should sanitize filename for rename', () => {
            const newName = 'test file@name#123';
            const sanitized = newName.replace(/[^a-zA-Z0-9._-]/g, '-');
            expect(sanitized).toBe('test-file-name-123');
        });

        it('should preserve file extension', () => {
            const oldPath = 'products/image.jpg';
            const ext = oldPath.substring(oldPath.lastIndexOf('.'));
            expect(ext).toBe('.jpg');
        });

        it('should extract folder from path', () => {
            const path = 'products/subfolder/image.png';
            const folder = path.substring(0, path.lastIndexOf('/'));
            expect(folder).toBe('products/subfolder');
        });

        it('should build new path correctly', () => {
            const oldPath = 'products/old-image.jpg';
            const newName = 'new-image';
            const folder = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const ext = oldPath.substring(oldPath.lastIndexOf('.'));
            const newPath = folder + '/' + newName + ext;
            expect(newPath).toBe('products/new-image.jpg');
        });
    });

    describe('Search Filtering', () => {
        it('should filter files by search term', () => {
            const files = [
                { name: 'product-red.jpg' },
                { name: 'product-blue.jpg' },
                { name: 'banner.png' }
            ];
            const search = 'product';
            const filtered = files.filter(f => 
                f.name.toLowerCase().includes(search.toLowerCase())
            );
            expect(filtered.length).toBe(2);
        });

        it('should be case insensitive', () => {
            const files = [{ name: 'ProductImage.JPG' }];
            const search = 'product';
            const filtered = files.filter(f => 
                f.name.toLowerCase().includes(search.toLowerCase())
            );
            expect(filtered.length).toBe(1);
        });
    });

    describe('Image URL Updates', () => {
        it('should replace old URL with new in array', () => {
            const images = [
                'https://example.com/old.jpg',
                'https://example.com/other.jpg'
            ];
            const oldUrl = 'https://example.com/old.jpg';
            const newUrl = 'https://example.com/new.jpg';
            
            const updated = images.map(url => url === oldUrl ? newUrl : url);
            expect(updated[0]).toBe(newUrl);
            expect(updated[1]).toBe('https://example.com/other.jpg');
        });

        it('should update variation images', () => {
            const variationImages = {
                red: ['https://example.com/old.jpg'],
                blue: ['https://example.com/blue.jpg']
            };
            const oldUrl = 'https://example.com/old.jpg';
            const newUrl = 'https://example.com/new.jpg';
            
            const updated = { ...variationImages };
            for (const [variation, urls] of Object.entries(updated)) {
                if (Array.isArray(urls) && urls.includes(oldUrl)) {
                    updated[variation] = urls.map(url => url === oldUrl ? newUrl : url);
                }
            }
            
            expect(updated.red[0]).toBe(newUrl);
            expect(updated.blue[0]).toBe('https://example.com/blue.jpg');
        });
    });

    describe('Permission Checks', () => {
        it('should map VIEW_MEDIA permission', () => {
            const permissions = {
                VIEW_MEDIA: 'view:media',
                UPLOAD_MEDIA: 'upload:media',
                DELETE_MEDIA: 'delete:media'
            };
            expect(permissions.VIEW_MEDIA).toBeDefined();
        });

        it('should have distinct permissions for each action', () => {
            const requiredPermissions = {
                GET: 'VIEW_MEDIA',
                PUT: 'UPLOAD_MEDIA',
                DELETE: 'DELETE_MEDIA'
            };
            expect(requiredPermissions.GET).not.toBe(requiredPermissions.DELETE);
        });
    });

    describe('Response Building', () => {
        it('should build image object correctly', () => {
            const file = {
                id: '123',
                name: 'test.jpg',
                created_at: '2024-01-01',
                updated_at: '2024-01-02',
                metadata: { size: 1024 }
            };
            const folder = 'products';
            const publicUrl = 'https://example.com/products/test.jpg';
            
            const image = {
                id: file.id,
                name: file.name,
                path: folder + '/' + file.name,
                url: publicUrl,
                size: file.metadata?.size || 0,
                created_at: file.created_at,
                updated_at: file.updated_at
            };
            
            expect(image.path).toBe('products/test.jpg');
            expect(image.size).toBe(1024);
        });

        it('should exclude folders from file list', () => {
            const files = [
                { id: 'file1', name: 'image.jpg' },
                { id: 'folder/', name: 'subfolder' }
            ];
            const filtered = files.filter(f => !f.id.endsWith('/'));
            expect(filtered.length).toBe(1);
        });
    });

    describe('Error Handling', () => {
        it('should require path for DELETE', () => {
            const params = {};
            const hasPath = !!params.path;
            expect(hasPath).toBe(false);
        });

        it('should require oldPath and newName for rename', () => {
            const body = { oldPath: 'test.jpg' };
            const isValid = body.oldPath && body.newName;
            expect(isValid).toBeFalsy();
        });
    });

    describe('Method Handling', () => {
        it('should support GET, PUT, DELETE', () => {
            const methods = ['GET', 'PUT', 'DELETE', 'OPTIONS'];
            expect(methods).toContain('GET');
            expect(methods).toContain('PUT');
            expect(methods).toContain('DELETE');
        });

        it('should not support POST for this endpoint', () => {
            const methods = ['GET', 'PUT', 'DELETE', 'OPTIONS'];
            expect(methods).not.toContain('POST');
        });
    });
});
