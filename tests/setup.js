/**
 * Vitest Global Test Setup
 *
 * This file runs before all tests and sets up the test environment.
 */

import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Set test environment variables
beforeAll(() => {
    // Generate a test encryption key (32 bytes = 64 hex chars)
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Set a test JWT secret
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';

    // Supabase test config (mocked)
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
});

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
    vi.restoreAllMocks();
});
