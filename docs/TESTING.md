# Testing Guide

This document covers the testing setup, conventions, and how to run tests for the Wicka codebase.

## Quick Start

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI/CD)
npm run test:run

# Run with coverage report
npm run test:coverage
```

## Test Stack

| Package | Purpose |
|---------|---------|
| [Vitest](https://vitest.dev/) | Fast test runner compatible with Netlify Functions |
| [@testing-library/dom](https://testing-library.com/) | DOM testing utilities |
| [jsdom](https://github.com/jsdom/jsdom) | Browser environment simulation |

## Test Structure

```
tests/
├── setup.js                    # Global test setup (env vars, mocks)
├── unit/
│   ├── utils/
│   │   ├── crypto.test.js      # PII encryption/decryption
│   │   └── security.test.js    # RBAC, JWT verification
│   └── cart.test.js            # Cart operations, XSS escaping
└── integration/
    └── auth.test.js            # Authentication security functions
```

## Test Categories

### Unit Tests (`tests/unit/`)

Fast, isolated tests for pure functions with no external dependencies.

#### `crypto.test.js` - PII Encryption (26 tests)

Tests the AES-256-GCM encryption used for customer PII:

- Encrypt/decrypt roundtrip verification
- Random IV generation (same plaintext → different ciphertext)
- Tamper detection (modified ciphertext/auth tag rejected)
- Graceful fallback when encryption key not configured
- Unicode and long string handling
- Order PII field encryption (`customer_phone`, `shipping_address`)

#### `security.test.js` - RBAC & JWT (43 tests)

Tests the role-based access control system:

- JWT token verification and rejection of invalid tokens
- `hasPermission()`, `hasRole()`, `hasAnyPermission()`, `hasAllPermissions()`
- Role permission mappings (website_admin, business_processing, customer)
- `requirePermission()` and `requireRole()` authorization guards
- CORS origin validation
- Response helpers (`errorResponse`, `successResponse`)

#### `cart.test.js` - Cart Operations (29 tests)

Tests frontend cart functionality:

- Add/remove items with quantity management
- Variation handling (same product, different variations)
- Quantity cap at 10 items
- Price calculations and shipping thresholds
- `escapeHtmlCart()` XSS prevention
- localStorage persistence

### Integration Tests (`tests/integration/`)

Tests for security-critical flows and multi-component interactions.

#### `auth.test.js` - Authentication Security (44 tests)

Tests authentication and security functions:

**Rate Limiting:**
- Per-email limit (5 attempts before 15-minute lockout)
- Per-IP limit (20 attempts)
- Case-insensitive email tracking
- Rate limit clearing on successful login

**Password Hashing:**
- bcrypt hashing and verification
- Legacy SHA256 hash detection (for migration)
- Unique salts for same password
- Unicode password support

**JWT Token Security:**
- Token generation with required claims
- Expiration time validation
- Rejection of wrong secret, expired, and malformed tokens
- Tampered payload detection (prevents privilege escalation)

**MFA Tokens:**
- Pre-MFA token creation (5-minute expiry)
- MFA setup token with `mfaSetupRequired` flag
- Privilege restrictions on partial tokens

**Backup Codes:**
- 10-code generation (8-char hex format)
- SHA256 hashing for storage
- Case-insensitive verification
- Single-use enforcement

## Writing Tests

### Test File Naming

- Unit tests: `<module>.test.js`
- Integration tests: `<feature>.test.js`

### Test Structure

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModuleName', () => {
    beforeEach(() => {
        // Reset state before each test
    });

    describe('functionName()', () => {
        it('should do expected behavior', () => {
            // Arrange
            const input = 'test';

            // Act
            const result = functionName(input);

            // Assert
            expect(result).toBe('expected');
        });

        it('should handle edge case', () => {
            expect(functionName(null)).toBeNull();
        });
    });
});
```

### Mocking

```javascript
import { vi } from 'vitest';

// Mock a module
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockSupabase)
}));

// Mock environment variables
beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
});

// Clear mocks between tests
afterEach(() => {
    vi.clearAllMocks();
});
```

### Testing Async Code

```javascript
it('should handle async operations', async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
});

it('should reject invalid input', async () => {
    await expect(asyncFunction('invalid')).rejects.toThrow();
});
```

## Environment Variables

Tests use mock environment variables defined in `tests/setup.js`:

```javascript
process.env.ENCRYPTION_KEY = 'a'.repeat(64);  // 32-byte hex key
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
```

## Coverage

Run coverage report:

```bash
npm run test:coverage
```

Coverage reports are generated in:
- Terminal: Summary table
- `coverage/`: HTML report (open `coverage/index.html`)
- `coverage/lcov.info`: For CI integration

### Coverage Targets

| Category | Target | Current |
|----------|--------|---------|
| Crypto utilities | 90%+ | Tested |
| Security/RBAC | 90%+ | Tested |
| Cart functions | 80%+ | Tested |
| Auth functions | 80%+ | Tested |

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run tests
  run: npm run test:run

# With coverage
- name: Run tests with coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests Timing Out

Increase timeout in `vitest.config.js`:

```javascript
test: {
    testTimeout: 30000  // 30 seconds
}
```

### Module Mocking Issues

Vitest hoists `vi.mock()` calls. For dynamic mocking, use `vi.doMock()`:

```javascript
beforeEach(async () => {
    vi.resetModules();
    vi.doMock('./module', () => ({ fn: vi.fn() }));
    const module = await import('./module');
});
```

### Environment Variable Leaks

Reset environment between tests:

```javascript
const originalEnv = { ...process.env };

afterEach(() => {
    process.env = { ...originalEnv };
});
```

## Future Testing

Planned test additions:

1. **Payment Integration** - Stripe/PayPal flows with MSW mocking
2. **E2E Tests** - Playwright for critical user journeys
3. **API Contract Tests** - Ensure endpoint response schemas
