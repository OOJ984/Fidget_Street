import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Test environment
        environment: 'node',

        // Test file patterns
        include: ['tests/**/*.test.js'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: [
                'netlify/functions/**/*.js',
                'scripts/**/*.js'
            ],
            exclude: [
                'node_modules/**',
                'tests/**'
            ]
        },

        // Global test timeout
        testTimeout: 10000,

        // Environment variables for tests
        env: {
            NODE_ENV: 'test'
        },

        // Setup files
        setupFiles: ['./tests/setup.js']
    }
});
