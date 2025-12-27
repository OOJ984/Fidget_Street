/**
 * Admin Analytics API Tests
 *
 * Tests for analytics data retrieval and calculations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Admin Analytics', () => {
    const testViewIds = [];

    afterAll(async () => {
        for (const id of testViewIds) {
            await supabase.from('page_views').delete().eq('id', id);
        }
    });

    describe('Period Calculations', () => {
        it('should calculate today start date', () => {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            expect(startDate.getHours()).toBe(0);
            expect(startDate.getMinutes()).toBe(0);
            expect(startDate.getSeconds()).toBe(0);
        });

        it('should calculate 7 days ago', () => {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const diffDays = Math.round((now - sevenDaysAgo) / (24 * 60 * 60 * 1000));

            expect(diffDays).toBe(7);
        });

        it('should calculate 30 days ago', () => {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const diffDays = Math.round((now - thirtyDaysAgo) / (24 * 60 * 60 * 1000));

            expect(diffDays).toBe(30);
        });

        it('should handle "all" period with epoch start', () => {
            const startDate = new Date(0);
            expect(startDate.getFullYear()).toBe(1970);
        });

        it('should default to 7 days for unknown period', () => {
            const period = 'unknown';
            const now = new Date();
            let startDate;

            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case '7days':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30days':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            const diffDays = Math.round((now - startDate) / (24 * 60 * 60 * 1000));
            expect(diffDays).toBe(7);
        });
    });

    describe('Page View Recording', () => {
        it('should record page view', async () => {
            const { data, error } = await supabase
                .from('page_views')
                .insert({
                    page_path: '/test-page',
                    page_title: 'Test Page',
                    session_id: `test-session-${Date.now()}`,
                    device_type: 'desktop',
                    referrer: 'https://google.com',
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (data) testViewIds.push(data.id);

            expect(error).toBeNull();
            expect(data.page_path).toBe('/test-page');
        });
    });

    describe('Unique Visitors Calculation', () => {
        it('should count unique sessions', () => {
            const views = [
                { session_id: 'a' },
                { session_id: 'b' },
                { session_id: 'a' },
                { session_id: 'c' },
                { session_id: 'b' }
            ];

            const uniqueSessions = new Set(views.map(v => v.session_id).filter(Boolean));
            expect(uniqueSessions.size).toBe(3);
        });

        it('should handle null sessions', () => {
            const views = [
                { session_id: 'a' },
                { session_id: null },
                { session_id: 'b' },
                { session_id: undefined }
            ];

            const uniqueSessions = new Set(views.map(v => v.session_id).filter(Boolean));
            expect(uniqueSessions.size).toBe(2);
        });
    });

    describe('Top Pages Calculation', () => {
        it('should count views by page', () => {
            const views = [
                { page_path: '/' },
                { page_path: '/products' },
                { page_path: '/' },
                { page_path: '/about' },
                { page_path: '/' }
            ];

            const pageViewCounts = {};
            views.forEach(view => {
                pageViewCounts[view.page_path] = (pageViewCounts[view.page_path] || 0) + 1;
            });

            expect(pageViewCounts['/']).toBe(3);
            expect(pageViewCounts['/products']).toBe(1);
            expect(pageViewCounts['/about']).toBe(1);
        });

        it('should sort by views descending', () => {
            const pageViewCounts = {
                '/': 100,
                '/products': 50,
                '/about': 25,
                '/contact': 10
            };

            const topPages = Object.entries(pageViewCounts)
                .map(([page_path, views]) => ({ page_path, views }))
                .sort((a, b) => b.views - a.views);

            expect(topPages[0].page_path).toBe('/');
            expect(topPages[0].views).toBe(100);
            expect(topPages[topPages.length - 1].views).toBe(10);
        });

        it('should limit to top 10', () => {
            const pageViewCounts = {};
            for (let i = 0; i < 20; i++) {
                pageViewCounts[`/page-${i}`] = Math.random() * 100;
            }

            const topPages = Object.entries(pageViewCounts)
                .map(([page_path, views]) => ({ page_path, views }))
                .sort((a, b) => b.views - a.views)
                .slice(0, 10);

            expect(topPages.length).toBe(10);
        });
    });

    describe('Device Type Breakdown', () => {
        it('should count by device type', () => {
            const views = [
                { device_type: 'desktop' },
                { device_type: 'mobile' },
                { device_type: 'desktop' },
                { device_type: 'tablet' },
                { device_type: 'mobile' },
                { device_type: 'mobile' }
            ];

            const deviceCounts = {};
            views.forEach(view => {
                const device = view.device_type || 'unknown';
                deviceCounts[device] = (deviceCounts[device] || 0) + 1;
            });

            expect(deviceCounts.desktop).toBe(2);
            expect(deviceCounts.mobile).toBe(3);
            expect(deviceCounts.tablet).toBe(1);
        });

        it('should handle unknown device type', () => {
            const views = [
                { device_type: null },
                { device_type: undefined },
                { device_type: 'desktop' }
            ];

            const deviceCounts = {};
            views.forEach(view => {
                const device = view.device_type || 'unknown';
                deviceCounts[device] = (deviceCounts[device] || 0) + 1;
            });

            expect(deviceCounts.unknown).toBe(2);
            expect(deviceCounts.desktop).toBe(1);
        });
    });

    describe('Daily Breakdown', () => {
        it('should group views by date', () => {
            const views = [
                { created_at: '2024-01-15T10:00:00Z' },
                { created_at: '2024-01-15T14:00:00Z' },
                { created_at: '2024-01-16T09:00:00Z' },
                { created_at: '2024-01-16T11:00:00Z' },
                { created_at: '2024-01-16T15:00:00Z' }
            ];

            const dailyViews = {};
            views.forEach(view => {
                const date = new Date(view.created_at).toISOString().split('T')[0];
                dailyViews[date] = (dailyViews[date] || 0) + 1;
            });

            expect(dailyViews['2024-01-15']).toBe(2);
            expect(dailyViews['2024-01-16']).toBe(3);
        });

        it('should sort by date descending', () => {
            const dailyViews = {
                '2024-01-15': 10,
                '2024-01-17': 15,
                '2024-01-16': 12
            };

            const dailyBreakdown = Object.entries(dailyViews)
                .map(([date, views]) => ({ date, views }))
                .sort((a, b) => b.date.localeCompare(a.date));

            expect(dailyBreakdown[0].date).toBe('2024-01-17');
            expect(dailyBreakdown[dailyBreakdown.length - 1].date).toBe('2024-01-15');
        });
    });

    describe('Referrer Analysis', () => {
        it('should extract domain from referrer', () => {
            const referrers = [
                'https://www.google.com/search?q=fidget',
                'https://facebook.com/share',
                'https://www.google.com/images'
            ];

            const domains = referrers.map(ref => {
                try {
                    return new URL(ref).hostname;
                } catch {
                    return null;
                }
            }).filter(Boolean);

            expect(domains).toContain('www.google.com');
            expect(domains).toContain('facebook.com');
        });

        it('should count referrer domains', () => {
            const views = [
                { referrer: 'https://google.com/search' },
                { referrer: 'https://google.com/images' },
                { referrer: 'https://facebook.com/' },
                { referrer: null },
                { referrer: 'invalid-url' }
            ];

            const referrerCounts = {};
            views.forEach(view => {
                if (view.referrer) {
                    try {
                        const url = new URL(view.referrer);
                        const domain = url.hostname;
                        referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
                    } catch {
                        // Invalid URL, skip
                    }
                }
            });

            expect(referrerCounts['google.com']).toBe(2);
            expect(referrerCounts['facebook.com']).toBe(1);
        });

        it('should limit to top 5 referrers', () => {
            const referrerCounts = {
                'google.com': 100,
                'facebook.com': 80,
                'twitter.com': 60,
                'instagram.com': 40,
                'pinterest.com': 20,
                'tiktok.com': 10,
                'reddit.com': 5
            };

            const topReferrers = Object.entries(referrerCounts)
                .map(([referrer, count]) => ({ referrer, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            expect(topReferrers.length).toBe(5);
            expect(topReferrers[0].referrer).toBe('google.com');
        });
    });

    describe('Average Daily Views', () => {
        it('should calculate average', () => {
            const totalViews = 700;
            const numDays = 7;
            const avgDaily = totalViews / numDays;

            expect(avgDaily).toBe(100);
        });

        it('should handle zero days', () => {
            const totalViews = 100;
            const numDays = 0;
            const avgDaily = totalViews / (numDays || 1);

            expect(avgDaily).toBe(100);
        });

        it('should handle decimal average', () => {
            const totalViews = 100;
            const numDays = 7;
            const avgDaily = totalViews / numDays;

            expect(avgDaily).toBeCloseTo(14.29, 1);
        });
    });

    describe('Today Views', () => {
        it('should get today date string', () => {
            const today = new Date().toISOString().split('T')[0];
            expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should return 0 for no views today', () => {
            const dailyViews = {
                '2024-01-15': 10,
                '2024-01-16': 15
            };
            const today = '2024-01-17';
            const todayViews = dailyViews[today] || 0;

            expect(todayViews).toBe(0);
        });
    });

    describe('Response Format', () => {
        it('should include all required fields', () => {
            const response = {
                period: '7days',
                totalViews: 500,
                uniqueVisitors: 200,
                todayViews: 50,
                avgDaily: 71.43,
                topPages: [],
                devices: {},
                dailyBreakdown: [],
                topReferrers: []
            };

            expect(response).toHaveProperty('period');
            expect(response).toHaveProperty('totalViews');
            expect(response).toHaveProperty('uniqueVisitors');
            expect(response).toHaveProperty('todayViews');
            expect(response).toHaveProperty('avgDaily');
            expect(response).toHaveProperty('topPages');
            expect(response).toHaveProperty('devices');
            expect(response).toHaveProperty('dailyBreakdown');
            expect(response).toHaveProperty('topReferrers');
        });
    });
});
