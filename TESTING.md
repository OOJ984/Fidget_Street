# Testing Documentation - Fidget Street

## Overview

This document describes the test suite for the Fidget Street e-commerce platform. The test suite uses **Vitest** for unit and integration testing, and **Playwright** for end-to-end (E2E) testing.

## Quick Start

```bash
# Run all unit/integration tests
npm run test:run

# Run tests in watch mode
npm test

# Run tests with coverage report
npm run test:coverage

# Run E2E tests (requires local server)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Test Architecture

```
tests/
├── setup.js                         # Global test setup (dotenv, mocks)
├── unit/                            # Unit tests (pure function testing)
│   ├── utils/
│   │   ├── checkout.test.js         # Shipping & price calculations
│   │   ├── crypto.test.js           # PII encryption/decryption
│   │   ├── orders.test.js           # Order number generation
│   │   ├── security.test.js         # JWT, RBAC, authentication
│   │   └── validation.test.js       # Input validation functions
│   └── cart.test.js                 # Cart operations (localStorage)
├── integration/                     # Integration tests (real database)
│   ├── auth.test.js                 # Authentication & rate limiting
│   ├── payments.test.js             # Payment validation logic
│   ├── products-api.test.js         # Product CRUD operations
│   ├── orders-api.test.js           # Order lifecycle
│   └── discounts-api.test.js        # Discount code management
├── functions/                       # Netlify function logic tests
│   ├── stripe-checkout.test.js      # Stripe session creation
│   ├── paypal-checkout.test.js      # PayPal order formatting
│   ├── webhooks.test.js             # Webhook processing logic
│   ├── validate-discount.test.js    # Discount validation
│   ├── validate-gift-card.test.js   # Gift card validation
│   └── gift-card-checkout.test.js   # Gift card purchase flow
└── e2e/                             # End-to-end browser tests
    └── checkout.spec.js             # Full checkout flow
```

---

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Unit tests verify individual functions in isolation. They do not require network access or database connections (except where noted).

#### `tests/unit/utils/checkout.test.js`

**What it tests:**
- `SHIPPING_CONFIG` constants (thresholds, costs in GBP and pence)
- `calculateShipping()` - Free shipping threshold logic (£20)
- `calculateTotals()` - Subtotal, shipping, and total calculations
- `verifyCartPrices()` - Database price verification (requires Supabase)

**What it does NOT test:**
- Actual Stripe/PayPal API calls
- HTTP request/response handling
- Frontend cart UI updates

**Coverage:** 94%

---

#### `tests/unit/utils/orders.test.js`

**What it tests:**
- `generateOrderNumber()` - Format validation (FS-YYYYMMDD-XXXX)
- Date extraction and padding
- Uniqueness across multiple generations
- `calculateOrderTotals()` - With custom thresholds and shipping costs

**What it does NOT test:**
- Database order insertion
- Order status transitions
- Email notifications

**Coverage:** 100%

---

#### `tests/unit/utils/crypto.test.js`

**What it tests:**
- `encrypt()` - AES-256-GCM encryption of PII
- `decrypt()` - Decryption with authentication
- `hashForSearch()` - Deterministic hashing for lookups
- `isEncryptionEnabled()` - Environment configuration checks
- Error handling for tampered data, missing keys, wrong key lengths

**What it does NOT test:**
- Key rotation procedures
- Bulk re-encryption of existing data

**Coverage:** 94%

---

#### `tests/unit/utils/security.test.js`

**What it tests:**
- `generateToken()` / `verifyToken()` - JWT creation and validation
- Token expiration handling
- `checkPermission()` - Role-based access control (admin, customer)
- `sanitizeInput()` - XSS prevention
- `validateCSRFToken()` - CSRF protection
- Password hashing with bcrypt

**What it does NOT test:**
- Session management
- Multi-factor authentication flow
- OAuth integration

**Coverage:** 74%

---

#### `tests/unit/utils/validation.test.js`

**What it tests:**
- `validateEmail()` - Format validation
- `validateName()` - Script injection prevention
- `validatePhone()` - UK phone format
- `validatePostcode()` - UK postcode format
- `validateOrderItems()` - Cart item structure
- `validateShippingAddress()` - Required fields

**What it does NOT test:**
- Address verification against postal APIs
- Phone number verification via SMS

**Coverage:** 96%

---

#### `tests/unit/cart.test.js`

**What it tests:**
- `getCart()` / `saveCart()` - localStorage operations
- `addToCart()` - Adding items, quantity updates
- `removeFromCart()` - Item removal
- `updateQuantity()` - Quantity changes
- `clearCart()` - Cart reset
- `getCartTotal()` - Price calculations
- `getCartCount()` - Item counting

**What it does NOT test:**
- UI rendering
- Cart synchronization with server
- Real localStorage (uses mock)

---

### 2. Integration Tests (`tests/integration/`)

Integration tests verify components working together with the **real Supabase dev database**. They use the `TEST_` prefix for test data isolation.

#### `tests/integration/products-api.test.js`

**What it tests:**
- Product listing with active filter
- Product lookup by slug
- Category filtering (`articulated-toys`, `spinners`, etc.)
- Tag filtering (`featured`, `test`)
- Pagination and ordering
- Stock and price validation

**What it does NOT test:**
- Product image upload to Supabase Storage
- Product variant creation
- Admin product management UI

**Database cleanup:** Deletes products with `title LIKE 'TEST_%'`

---

#### `tests/integration/orders-api.test.js`

**What it tests:**
- Order creation with all required fields
- Order lookup by `order_number` and `payment_id`
- Status transitions: `pending` → `paid` → `shipped` → `delivered`
- Order totals calculation with shipping

**What it does NOT test:**
- Stripe webhook order creation (tested in functions/)
- Order confirmation emails
- Inventory deduction

**Database cleanup:** Deletes orders with `order_number LIKE 'TEST-%'`

---

#### `tests/integration/discounts-api.test.js`

**What it tests:**
- Creating percentage, fixed, and free delivery discounts
- Discount code updates and deletion
- Active/inactive filtering
- Expiration date validation
- Usage count tracking and limits
- Minimum order amount checks
- Case-insensitive code lookup

**What it does NOT test:**
- Discount application during checkout
- Stacking multiple discounts
- Customer-specific discounts

**Database cleanup:** Deletes codes with `code LIKE 'TEST_%'`

---

#### `tests/integration/auth.test.js`

**What it tests:**
- Password hashing with bcrypt (rounds = 10)
- Password verification (correct/incorrect)
- Unicode password handling
- Rate limiting configuration
- MFA token generation and verification

**What it does NOT test:**
- Full login flow with HTTP requests
- Session creation and management
- Password reset emails

---

#### `tests/integration/payments.test.js`

**What it tests:**
- Stripe payload structure validation
- PayPal order format validation
- Price conversion (GBP ↔ pence)
- Metadata structure for webhooks
- Line item formatting

**What it does NOT test:**
- Actual API calls to Stripe/PayPal
- Payment capture/completion
- Refund processing

---

### 3. Function Tests (`tests/functions/`)

Function tests verify the business logic inside Netlify serverless functions without making HTTP requests.

#### `tests/functions/stripe-checkout.test.js`

**What it tests:**
- Session line item structure
- Price conversion to pence (multiply by 100)
- Shipping rate configuration
- Metadata for webhook processing
- Discount application to session
- Gift card partial payment handling
- Success/cancel URL construction

**What it does NOT test:**
- Actual Stripe API calls (`stripe.checkout.sessions.create`)
- Stripe webhook signature verification
- 3D Secure authentication flow

---

#### `tests/functions/paypal-checkout.test.js`

**What it tests:**
- Order payload structure for PayPal API
- Price formatting in GBP (NOT pence - PayPal uses decimal)
- Item breakdown with quantities
- Shipping amount calculation
- Intent configuration (`CAPTURE`)

**What it does NOT test:**
- PayPal API authentication
- Order capture after approval
- PayPal webhook processing

---

#### `tests/functions/webhooks.test.js`

**What it tests:**
- Order number generation format (FS-YYYYMMDD-XXXX)
- Order totals calculation
- Permanent vs transient error detection (for retry logic)
- Shipping address formatting from Stripe session
- Items parsing from metadata
- Gift card balance deduction logic
- Discount code usage increment
- Duplicate order prevention by `payment_id`

**What it does NOT test:**
- Stripe signature verification (`stripe.webhooks.constructEvent`)
- Actual database transactions
- Email sending after order creation

---

#### `tests/functions/validate-discount.test.js`

**What it tests:**
- Valid discount code lookup
- Expired code detection
- Inactive code filtering
- Usage limit enforcement
- Minimum order amount validation
- Discount amount calculation (percentage, fixed, free delivery)

**What it does NOT test:**
- Discount stacking rules
- Product-specific discounts
- First-order-only discounts

---

#### `tests/functions/validate-gift-card.test.js`

**What it tests:**
- Gift card lookup by code
- Balance checking
- Expired card detection
- Status validation (`active`, `pending`, `depleted`)
- Partial balance usage calculation

**What it does NOT test:**
- Gift card purchase flow
- Email delivery of gift card codes
- Gift card refunds

---

#### `tests/functions/gift-card-checkout.test.js`

**What it tests:**
- Gift card code generation format (GC-XXXX-XXXX-XXXX)
- Character set excludes confusing characters (0, O, 1, I)
- Amount validation (£5 - £500)
- Email validation for purchaser/recipient
- Expiry date calculation (1 year from purchase)
- Stripe session metadata structure
- Database record structure

**What it does NOT test:**
- Actual Stripe session creation
- Gift card email delivery
- Gift card code uniqueness (collision handling)

---

### 4. E2E Tests (`tests/e2e/`)

End-to-end tests use Playwright to automate a real browser against a running local server.

#### `tests/e2e/checkout.spec.js`

**What it tests:**
- Product page loading and display
- Product detail navigation
- Adding products to cart
- Cart quantity updates
- Cart item removal
- Shipping cost display
- Discount code input and error handling
- Checkout button visibility
- Stripe redirect initiation
- Gift cards page loading
- Site navigation

**What it does NOT test:**
- Complete Stripe checkout (requires real payment)
- Order confirmation page after payment
- Account creation during checkout
- Guest checkout flow

**Requires:** Local server running (`npx netlify dev`)

---

## Database Test Strategy

### Test Data Isolation

All test data uses prefixes to prevent conflicts with production data:

| Data Type | Prefix | Example |
|-----------|--------|---------|
| Products | `TEST_` | `TEST_Integration_Product` |
| Orders | `TEST-` | `TEST-ORDER-1703523456789` |
| Discounts | `TEST_` | `TEST_PCT_1703523456789` |
| Gift Cards | `TEST-GC-` | `TEST-GC-1703523456789` |

### Cleanup Strategy

Each test file includes `afterAll()` hooks that clean up test data:

```javascript
afterAll(async () => {
    await supabase
        .from('orders')
        .delete()
        .like('order_number', 'TEST-%');
});
```

### Race Condition Handling

Integration tests include defensive null checks for database operations that may fail due to timing:

```javascript
if (!data) {
    console.log('Skipping - order not found after insert');
    return;
}
```

---

## Coverage Report

Current coverage for utility functions:

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| `orders.js` | 100% | 100% | 100% | 100% |
| `validation.js` | 96% | 96% | 100% | 96% |
| `checkout.js` | 94% | 92% | 100% | 94% |
| `crypto.js` | 94% | 91% | 100% | 95% |
| `security.js` | 74% | 57% | 75% | 73% |

**Note:** Overall project coverage is low (~3%) because:
1. Netlify function handlers require HTTP request mocking
2. Frontend scripts require browser environment
3. Many admin functions are not yet tested

---

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/test.yml`)

The pipeline runs on push to `main`/`master` and on pull requests:

1. **Unit & Integration Tests**
   - Installs dependencies
   - Runs `npm run test:run`
   - Generates coverage report
   - Uploads coverage artifact

2. **E2E Tests** (runs after unit tests pass)
   - Installs Playwright browsers
   - Starts local dev server
   - Runs Playwright tests
   - Uploads test report artifact

3. **Lint** (runs in parallel)
   - ESLint check
   - Prettier format check

### Required GitHub Secrets

```
SUPABASE_URL          # Supabase project URL
SUPABASE_SERVICE_KEY  # Service role key (for tests)
JWT_SECRET            # JWT signing secret
STRIPE_SECRET_KEY     # Stripe test mode secret
STRIPE_PUBLISHABLE_KEY # Stripe test mode publishable
```

---

## What Is NOT Tested (Known Gaps)

### High Priority (Should Be Added)

1. **Stripe Webhook Signature Verification**
   - Tests currently skip `stripe.webhooks.constructEvent()`
   - Requires mocking Stripe SDK

2. **Full HTTP Request/Response Cycle**
   - Netlify function handlers not tested end-to-end
   - Need to add supertest or similar

3. **Email Notifications**
   - Order confirmation emails
   - Gift card delivery emails
   - Password reset emails

4. **Inventory Management**
   - Stock deduction after purchase
   - Out-of-stock handling

### Medium Priority

5. **Admin Panel Functions**
   - Product CRUD via admin API
   - Order management
   - User management

6. **Customer Account**
   - Registration flow
   - Login/logout
   - Order history

7. **PayPal Webhooks**
   - Order capture webhook
   - Refund webhook

### Lower Priority

8. **Image Upload**
   - Product image upload to Supabase Storage
   - Image optimization

9. **Search Functionality**
   - Product search
   - Category filtering in UI

10. **Mobile Responsiveness**
    - E2E tests on mobile viewports

---

## Running Tests Locally

### Prerequisites

1. Node.js 20+
2. `.env` file with test credentials
3. Access to dev Supabase database

### Environment Setup

```bash
# Copy example env (if exists) or create .env
cp .env.example .env

# Required variables:
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=your-test-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Running Specific Tests

```bash
# Run single test file
npx vitest run tests/unit/utils/orders.test.js

# Run tests matching pattern
npx vitest run -t "order number"

# Run with verbose output
npx vitest run --reporter=verbose

# Run E2E tests in headed mode
npx playwright test --headed
```

---

## Adding New Tests

### Unit Test Template

```javascript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../path/to/module.js';

describe('myFunction()', () => {
    it('should handle valid input', () => {
        const result = myFunction('valid');
        expect(result).toBe(expected);
    });

    it('should handle edge case', () => {
        expect(() => myFunction(null)).toThrow();
    });
});
```

### Integration Test Template

```javascript
import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

describe('Feature Integration', () => {
    const testIds = [];

    afterAll(async () => {
        // Clean up test data
        for (const id of testIds) {
            await supabase.from('table').delete().eq('id', id);
        }
    });

    it('should create record', async () => {
        const { data, error } = await supabase
            .from('table')
            .insert([{ name: 'TEST_item' }])
            .select()
            .single();

        expect(error).toBeNull();
        testIds.push(data.id);
    });
});
```

---

## Troubleshooting

### Tests Timing Out

- Increase timeout in vitest.config.js
- Check network connectivity to Supabase
- Ensure `.env` variables are loaded

### Flaky Integration Tests

- Tests use defensive null checks for race conditions
- If a test consistently fails, check database constraints
- Look for "Skipping -" console messages

### E2E Tests Failing

- Ensure `npx netlify dev` can start successfully
- Check that port 8888 is available
- Run in headed mode to debug: `npx playwright test --headed`

### Coverage Not Updating

- Delete `coverage/` directory and re-run
- Ensure `@vitest/coverage-v8` is installed
