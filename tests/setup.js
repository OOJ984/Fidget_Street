/**
 * Vitest Global Test Setup
 *
 * This file runs before all tests and sets up the test environment.
 */

import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { config } from 'dotenv';

// Load .env file for real Supabase credentials
config();

// Set test environment variables
beforeAll(() => {
    // Generate a test encryption key (32 bytes = 64 hex chars)
    if (!process.env.ENCRYPTION_KEY) {
        process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    }

    // Set a test JWT secret if not provided
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
    }

    // Use real Supabase from .env if available, otherwise use test values
    if (!process.env.SUPABASE_URL) {
        process.env.SUPABASE_URL = 'https://test.supabase.co';
    }
    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY) {
        process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
    }
});

// Reset mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});

// Cleanup after all tests
afterAll(() => {
    vi.restoreAllMocks();
});
