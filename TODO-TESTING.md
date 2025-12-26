# Testing TODO - Remaining Work

This document tracks testing work that still needs to be completed. Each item can be converted to a GitHub issue.

---

## High Priority

### [ ] Add Stripe Webhook Signature Verification Tests
**Labels:** `testing`, `priority-high`, `payments`

Currently, webhook tests skip the `stripe.webhooks.constructEvent()` signature verification. This is a critical security feature.

**Tasks:**
- [ ] Mock Stripe SDK in tests
- [ ] Test valid signature verification
- [ ] Test invalid/tampered signature rejection
- [ ] Test expired timestamp rejection

**Files to modify:**
- `tests/functions/webhooks.test.js`

---

### [ ] Add HTTP Request/Response Tests for Netlify Functions
**Labels:** `testing`, `priority-high`, `api`

Netlify function handlers are currently untested at the HTTP level. Only the internal logic is tested.

**Tasks:**
- [ ] Add `supertest` or similar HTTP testing library
- [ ] Test all function endpoints with proper request/response
- [ ] Test error responses (400, 401, 403, 500)
- [ ] Test CORS headers

**Functions to test:**
- `stripe-checkout.js`
- `paypal-checkout.js`
- `webhooks.js`
- `validate-discount.js`
- `validate-gift-card.js`
- `products.js`
- `orders.js`

---

### [ ] Add Inventory Management Tests
**Labels:** `testing`, `priority-high`, `inventory`

Stock management is not tested. This is critical for preventing overselling.

**Tasks:**
- [ ] Test stock deduction after successful order
- [ ] Test out-of-stock rejection at checkout
- [ ] Test concurrent purchase handling (race conditions)
- [ ] Test stock restoration on order cancellation

---

### [ ] Add Email Notification Tests
**Labels:** `testing`, `priority-high`, `notifications`

Email sending is not tested at all.

**Tasks:**
- [ ] Mock email service (or use test mode)
- [ ] Test order confirmation email sending
- [ ] Test email content and formatting
- [ ] Test gift card delivery email
- [ ] Test password reset email

---

## Medium Priority

### [ ] Add Admin Panel API Tests
**Labels:** `testing`, `priority-medium`, `admin`

Admin functions have 0% test coverage.

**Tasks:**
- [ ] Test admin authentication
- [ ] Test product CRUD operations
- [ ] Test order management
- [ ] Test user management
- [ ] Test discount management
- [ ] Test gift card management

**Functions to test:**
- `admin-auth.js`
- `admin-products.js`
- `admin-orders.js`
- `admin-users.js`
- `admin-discounts.js`
- `admin-gift-cards.js`

---

### [ ] Add Customer Account Tests
**Labels:** `testing`, `priority-medium`, `customer`

Customer authentication and account features are untested.

**Tasks:**
- [ ] Test customer registration
- [ ] Test customer login/logout
- [ ] Test password change
- [ ] Test order history retrieval
- [ ] Test account details update

**Functions to test:**
- `customer-auth.js`
- `customer-data.js`
- `customer-orders.js`

---

### [ ] Add PayPal Webhook Tests
**Labels:** `testing`, `priority-medium`, `payments`, `paypal`

PayPal webhook handling is not tested.

**Tasks:**
- [ ] Test order capture webhook
- [ ] Test refund webhook
- [ ] Test dispute webhook
- [ ] Verify PayPal signature validation

---

### [ ] Increase security.js Test Coverage
**Labels:** `testing`, `priority-medium`, `security`

Current coverage is 74%. Key areas missing:

**Tasks:**
- [ ] Test all RBAC permission combinations
- [ ] Test session expiration handling
- [ ] Test rate limit window reset
- [ ] Test blocked IP handling

---

## Lower Priority

### [ ] Add Image Upload Tests
**Labels:** `testing`, `priority-low`, `media`

Image upload to Supabase Storage is untested.

**Tasks:**
- [ ] Test image upload endpoint
- [ ] Test file type validation
- [ ] Test file size limits
- [ ] Test image optimization

---

### [ ] Add Product Search Tests
**Labels:** `testing`, `priority-low`, `search`

Search functionality is untested.

**Tasks:**
- [ ] Test product title search
- [ ] Test category filtering
- [ ] Test tag filtering
- [ ] Test price range filtering
- [ ] Test search result ordering

---

### [ ] Add Mobile E2E Tests
**Labels:** `testing`, `priority-low`, `e2e`, `mobile`

E2E tests only run on desktop viewport.

**Tasks:**
- [ ] Add Playwright mobile device emulation
- [ ] Test checkout flow on mobile
- [ ] Test navigation menu on mobile
- [ ] Test cart operations on mobile

---

### [ ] Add Performance Tests
**Labels:** `testing`, `priority-low`, `performance`

No performance or load testing exists.

**Tasks:**
- [ ] Add API response time assertions
- [ ] Add load testing for checkout endpoint
- [ ] Test database query performance
- [ ] Add Lighthouse CI integration

---

## Infrastructure Improvements

### [ ] Add Test Database Seeding Script
**Labels:** `testing`, `infrastructure`

Tests create their own data, but a seeding script would improve consistency.

**Tasks:**
- [ ] Create `tests/seed.js` with test fixtures
- [ ] Add products, discounts, gift cards for testing
- [ ] Run seeding before test suite
- [ ] Clean up after test suite

---

### [ ] Add Visual Regression Testing
**Labels:** `testing`, `infrastructure`, `e2e`

No visual regression testing for UI changes.

**Tasks:**
- [ ] Add Percy or similar visual testing tool
- [ ] Capture baseline screenshots
- [ ] Add to CI pipeline
- [ ] Test critical pages (home, products, cart, checkout)

---

### [ ] Add API Contract Testing
**Labels:** `testing`, `infrastructure`, `api`

No contract testing between frontend and backend.

**Tasks:**
- [ ] Define OpenAPI/Swagger spec for API
- [ ] Add contract tests to verify API matches spec
- [ ] Test request/response schemas

---

## Test Quality Improvements

### [ ] Reduce Test Flakiness
**Labels:** `testing`, `tech-debt`

Some integration tests are flaky due to database timing.

**Tasks:**
- [ ] Add explicit waits where needed
- [ ] Improve test data cleanup
- [ ] Add retry logic for known flaky operations
- [ ] Consider test database isolation

---

### [ ] Add Test Documentation Comments
**Labels:** `testing`, `documentation`

Some test files lack detailed comments.

**Tasks:**
- [ ] Add JSDoc comments to all test files
- [ ] Document test data requirements
- [ ] Document setup/teardown procedures

---

## Completed

- [x] Create unit tests for utility functions
- [x] Create integration tests with real Supabase
- [x] Create payment function tests
- [x] Create E2E checkout test
- [x] Set up GitHub Actions CI pipeline
- [x] Add test coverage reporting
- [x] Create comprehensive test documentation

---

## Converting to GitHub Issues

To convert these items to GitHub issues, use the GitHub CLI:

```bash
# Example: Create an issue
gh issue create \
  --title "Add Stripe Webhook Signature Verification Tests" \
  --body "Currently, webhook tests skip signature verification. See TODO-TESTING.md for details." \
  --label "testing,priority-high,payments"

# Or use GitHub web interface to create issues from this document
```

---

## Priority Definitions

- **High**: Critical for production safety, should be done before major releases
- **Medium**: Important for code quality, can be done incrementally
- **Low**: Nice to have, do when time permits
