# Wicka Security Documentation

## Overview

This document outlines the security measures implemented in the Wicka e-commerce platform.

---

## Security Score Progress

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Critical Fixes | **COMPLETE** | bcrypt, CORS, JWT, headers, rate limiting |
| Phase 2: RBAC | **COMPLETE** | Role-based access control |
| Phase 3: Customer Auth | **COMPLETE** | Magic link authentication |
| Phase 4: MFA | **COMPLETE** | Mandatory TOTP for admin |
| Phase 5: Audit Logging | **COMPLETE** | Activity tracking |
| Phase 6: Data Protection | **COMPLETE** | Encryption, GDPR |

---

## Authentication

### Password Hashing

**Implementation:** bcrypt with 12 rounds

Passwords are hashed using bcrypt, a secure password hashing algorithm that:
- Uses a configurable work factor (12 rounds)
- Includes built-in salt generation
- Is resistant to rainbow table attacks
- Automatically increases computation time as hardware improves

**Migration:** Legacy SHA256 hashes are automatically upgraded to bcrypt on successful login.

```javascript
// Password hashing
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 12);

// Password verification
const valid = await bcrypt.compare(password, storedHash);
```

### JWT Tokens

**Configuration:**
- Secret: Required via `JWT_SECRET` environment variable (no fallback)
- Expiry: 24 hours
- Storage: Client-side (localStorage)

**Token Payload:**
```json
{
  "userId": 1,
  "email": "admin@example.com",
  "name": "Admin User",
  "role": "website_admin"
}
```

### Rate Limiting

**Login Endpoint Protection:**
- Max 5 failed attempts per email per 15 minutes
- Max 20 failed attempts per IP per hour
- Returns HTTP 429 with `Retry-After` header when exceeded

**Implementation:** Persistent rate limiting using Supabase database with automatic fallback to in-memory storage if database is unavailable.

See `netlify/functions/utils/rateLimit.js` and `supabase/migrations/005_rate_limiting.sql`.

---

## CORS (Cross-Origin Resource Sharing)

### Allowed Origins

CORS origins are configured dynamically using Netlify environment variables:

| Source | Description |
|--------|-------------|
| `SITE_URL` | Your custom domain (set manually if needed) |
| `URL` | Netlify auto-sets this to your site URL |
| `DEPLOY_PRIME_URL` | Netlify deploy preview URLs |
| `localhost:8888` | Local development |
| `localhost:3000` | Alternative local port |

**Implementation:** See `netlify/functions/utils/security.js`

```javascript
const ALLOWED_ORIGINS = [
    process.env.SITE_URL,           // Primary production URL (from env)
    process.env.URL,                // Netlify's auto-set URL
    process.env.DEPLOY_PRIME_URL,   // Netlify deploy preview URL
    'http://localhost:8888',        // Local development
    'http://localhost:3000'         // Alternative local port
].filter(Boolean);
```

**Note:** Netlify automatically sets `URL` and `DEPLOY_PRIME_URL` during builds. No configuration needed for free Netlify sites.

---

## Security Headers

Configured in `netlify.toml` for all pages:

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| X-XSS-Protection | `1; mode=block` | Legacy XSS protection |
| Referrer-Policy | `strict-origin-when-cross-origin` | Control referrer info |
| Permissions-Policy | Restrictive | Disable unused browser features |
| Content-Security-Policy | Whitelist-based | Prevent XSS, limit resource loading |

### Content Security Policy

**Public Pages (strict - no unsafe-inline for scripts):**
```
default-src 'self';
script-src 'self' https://js.stripe.com https://www.paypal.com https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
connect-src 'self' https://api.stripe.com https://*.supabase.co;
frame-src 'self' https://js.stripe.com https://www.paypal.com;
```

**Admin Pages (/admin/*):**
```
script-src 'self' https://cdn.jsdelivr.net;
```
Admin pages also use strict CSP - all inline scripts have been extracted to external files.

---

## Environment Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | **CRITICAL** - Must be set, no fallback |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for magic link emails |
| `EMAIL_FROM` | Sender email address (e.g., `Wicka <orders@domain.com>`) |
| `SITE_URL` | Custom domain URL (Netlify auto-sets `URL` and `DEPLOY_PRIME_URL`) |

### Security Notes

- `JWT_SECRET` must be a strong, random string (32+ characters)
- Never commit secrets to version control
- Use Netlify environment variables for production
- Rotate secrets regularly

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `website_admin` | Full access to all features including settings and user management |
| `business_processing` | Product and order management (no settings or user management) |
| `customer` | View own orders only (via magic link - Phase 3) |

### Permission Matrix

| Permission | business_processing | website_admin |
|------------|---------------------|---------------|
| View all orders | ✓ | ✓ |
| Update order status | ✓ | ✓ |
| View products | ✓ | ✓ |
| Create/Edit/Delete products | ✓ | ✓ |
| View/Upload/Delete media | ✓ | ✓ |
| View/Edit website settings | ✗ | ✓ |
| Manage users | ✗ | ✓ |
| View audit logs | ✗ | ✓ |

### Implementation

Permissions are checked at the API level using the security utility:

```javascript
const { requirePermission, PERMISSIONS } = require('./utils/security');

// In API handler:
const permError = requirePermission(user, PERMISSIONS.EDIT_SETTINGS, headers);
if (permError) return permError;
```

### Database Migration

Run `supabase/migrations/002_rbac.sql` to:
- Update role constraint to new roles
- Add MFA-related columns
- Create customers table
- Link orders to customers

---

## API Security

### Admin Endpoints

All admin endpoints (`/api/admin-*`) require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. Origin matching allowed CORS list
3. `JWT_SECRET` environment variable configured

### Public Endpoints

All endpoints use restricted CORS (see CORS section above):

| Endpoint | Purpose | CORS |
|----------|---------|------|
| `/api/products` | Read-only product listing | Restricted |
| `/api/settings` | Read-only website settings | Restricted |
| `/api/orders` | Order creation and lookup | Restricted |
| `/api/stripe-checkout` | Creates Stripe checkout sessions | Restricted |
| `/api/paypal-checkout` | Creates PayPal orders | Restricted |
| `/api/paypal-capture` | Captures PayPal payments | Restricted |
| `/api/webhooks` | Stripe webhook (signature verified) | N/A (server-to-server) |

### Customer Endpoints

- `/api/customer-auth` - Magic link authentication
  - `POST`: Request magic link (rate limited: 3/hour per email)
  - `GET`: Verify magic link token
- `/api/customer-orders` - Customer order access
  - `GET`: List customer's own orders (requires customer session)
  - `GET ?id=xxx`: View single order detail

---

## Customer Authentication (Magic Links)

Customers can view their orders using passwordless magic link authentication. No account creation required.

### Flow

1. Customer enters email at `/account/login.html`
2. If orders exist for that email, a magic link is sent
3. Customer clicks link, token is verified at `/account/verify.html`
4. JWT session issued (7 days), redirects to `/account/orders.html`
5. Customer can view all orders for their email

### Security Features

- **Rate Limiting:** 3 magic link requests per email per hour
- **Token Expiry:** Magic links expire after 15 minutes
- **Single Use:** Tokens are invalidated after first use
- **Email Enumeration Prevention:** Same response regardless of whether email has orders
- **Separate Token Type:** Customer JWTs marked with `type: 'customer'` to prevent admin access

### Email Configuration

Magic links require an email service. Configure Resend (recommended):

```bash
# Add to Netlify environment variables
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=Wicka <orders@yourdomain.com>
```

**Development Mode:** Without `RESEND_API_KEY`, magic links are logged to console.

### Customer Portal Pages

```
account/
├── login.html    # Email entry form
├── verify.html   # Token verification
└── orders.html   # Order history & details
```

---

## File Structure

```
netlify/functions/
├── utils/
│   └── security.js         # Shared security utilities + audit logging
├── admin-auth.js           # Authentication + rate limiting
├── admin-products.js       # Product management
├── admin-orders.js         # Order management
├── admin-media.js          # Media management
├── admin-settings.js       # Settings management
├── admin-users.js          # User management
├── admin-mfa.js            # MFA setup/verify
├── admin-audit.js          # Audit log viewer API
├── customer-auth.js        # Customer magic link auth
└── customer-orders.js      # Customer order viewing

admin/
├── index.html              # Admin login with MFA
├── mfa-setup.html          # MFA setup wizard
├── audit.html              # Audit log viewer
├── users.html              # User management (website_admin only)
└── ...                     # Other admin pages

account/
├── login.html              # Magic link request
├── verify.html             # Token verification
└── orders.html             # Order history

supabase/migrations/
├── 002_rbac.sql            # RBAC schema
└── 003_audit_logs.sql      # Audit logs table
```

---

## Secure Development Practices

### DO:
- Always use parameterized queries (Supabase handles this)
- Validate and sanitize all user input
- Use HTTPS everywhere
- Log security events
- Keep dependencies updated

### DON'T:
- Store sensitive data in localStorage
- Trust client-side data
- Expose stack traces to users
- Use weak or default secrets
- Disable security features for convenience

---

## Incident Response

If you suspect a security breach:

1. **Rotate secrets immediately**
   - Generate new `JWT_SECRET`
   - Regenerate Supabase API keys

2. **Review audit logs** (when implemented)
   - Check for unusual login patterns
   - Review recent admin actions

3. **Notify stakeholders**
   - Report to team lead
   - Document timeline and actions

---

## Multi-Factor Authentication (MFA)

MFA is **mandatory** for all admin users (`business_processing` and `website_admin` roles).

### Implementation

- **Algorithm:** TOTP (Time-based One-Time Password)
- **Compatible Apps:** Google Authenticator, Authy, Microsoft Authenticator, 1Password, etc.
- **Token Window:** 30 seconds with 1-step tolerance
- **Backup Codes:** 10 single-use recovery codes

### Authentication Flow

1. User enters email + password
2. If MFA not set up → Redirect to `/admin/mfa-setup.html`
3. If MFA enabled → Show 6-digit code input
4. Verify TOTP or backup code
5. Issue final JWT with `mfaVerified: true`

### API Endpoints

```
POST /api/admin-mfa/setup     - Generate QR code and secret
POST /api/admin-mfa/verify    - Verify code and enable MFA
POST /api/admin-mfa/validate  - Validate code during login
POST /api/admin-mfa/backup    - Use backup code during login
POST /api/admin-mfa/regenerate - Generate new backup codes
GET  /api/admin-mfa/status    - Check MFA status
```

### Security Features

- Pre-MFA tokens expire in 5 minutes
- Setup tokens expire in 30 minutes
- Backup codes are hashed with SHA256 before storage
- Each backup code is single-use (removed after use)
- Low backup code warning when < 3 codes remain

### Files

```
admin/
├── index.html      # Updated login with MFA flow
└── mfa-setup.html  # MFA setup wizard

netlify/functions/
└── admin-mfa.js    # MFA API
```

---

## Audit Logging

All admin actions are tracked in the audit_logs table for security and compliance purposes.

### Tracked Actions

| Category | Actions |
|----------|---------|
| Authentication | login_success, login_failed, logout, mfa_setup, mfa_verified, password_changed |
| Products | product_created, product_updated, product_deleted |
| Orders | order_status_updated |
| Media | media_uploaded, media_deleted, media_renamed |
| Settings | settings_updated, settings_reset |
| Users | user_created, user_updated, user_deactivated, user_role_changed |

### Audit Log Entry Fields

| Field | Description |
|-------|-------------|
| user_id | ID of the user who performed the action |
| user_email | Email of the user |
| action | Action type (see above) |
| resource_type | Type of resource affected (product, order, user, etc.) |
| resource_id | ID of the affected resource |
| details | Additional context as JSON (changed fields, old/new values) |
| ip_address | Client IP address |
| user_agent | Browser/client user agent |
| created_at | Timestamp of the action |

### Audit Log Viewer

Access the audit log viewer at `/admin/audit.html` (website_admin only).

Features:
- Filter by action type, user email, and date range
- Paginated results (25 per page)
- Detailed view with full log entry information
- Export to CSV

### API Endpoint

```
GET /api/admin-audit
  - Query params: action, user_id, user_email, resource_type, resource_id, from, to, page, limit
  - Requires: VIEW_AUDIT_LOGS permission (website_admin only)
```

### Database Migration

Run `supabase/migrations/003_audit_logs.sql` to create the audit_logs table.

---

## Data Protection (Phase 6)

### PII Encryption at Rest

Sensitive customer data is encrypted using AES-256-GCM before storage.

**Encrypted Fields:**
- `customer_phone` - Phone numbers
- `shipping_address` - Full address objects (stored as encrypted JSON)

**Not Encrypted (needed for lookups):**
- `customer_email` - Required for order queries and customer authentication
- `customer_name` - Commonly displayed and searched

**Setup:**

Generate an encryption key:
```bash
# Generate 32-byte (64 hex character) key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to Netlify environment variables:
```
ENCRYPTION_KEY=<your-64-character-hex-key>
```

**Encryption Format:** `iv:authTag:ciphertext` (all base64 encoded)

**Graceful Degradation:** If `ENCRYPTION_KEY` is not set, data is stored unencrypted with a console warning. Existing unencrypted data remains readable.

### GDPR Compliance

Customer data endpoints support GDPR rights via `/api/customer-data`:

#### Right to Access (Data Export)

```
GET /api/customer-data
Authorization: Bearer <customer-token>

Response:
{
  "export_date": "2025-01-15T...",
  "customer": { "email": "...", "name": "...", ... },
  "orders": [...],
  "total_orders": 5,
  "total_spent": 249.99
}
```

#### Right to be Forgotten (Data Deletion)

```
DELETE /api/customer-data
Authorization: Bearer <customer-token>

Response (preview):
{
  "message": "This will permanently delete all your data...",
  "data_to_delete": { "orders": 5, "customer_record": 1 },
  "warning": "This action cannot be undone..."
}

DELETE /api/customer-data?confirm=true
Authorization: Bearer <customer-token>

Response:
{
  "success": true,
  "message": "All your data has been permanently deleted.",
  "deleted": { "orders": 5, "customer_record": true }
}
```

**Deleted Data:**
- All orders for the customer email
- Customer record from customers table
- Magic link tokens

### Data Retention Policy

| Data Type | Retention | Notes |
|-----------|-----------|-------|
| Orders | Indefinite | Business records requirement |
| Audit logs | 2 years | Security compliance |
| Failed login attempts | 30 days | Auto-purged |
| Customer sessions | 7 days | JWT expiry |
| Magic link tokens | 15 minutes | Single use, auto-expire |

---

## Security Checklist

- [x] bcrypt password hashing (12 rounds)
- [x] JWT with required secret (no fallback)
- [x] Restricted CORS origins (all endpoints including payments)
- [x] Rate limiting on login
- [x] HSTS header
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Content Security Policy
- [x] Shared security module
- [x] Role-based access control (RBAC)
- [x] Permission-based API protection
- [x] User management API
- [x] Customer magic link auth
- [x] Customer order viewing portal
- [x] Rate limiting on magic links
- [x] MFA for admin users (mandatory TOTP)
- [x] Backup recovery codes
- [x] MFA setup wizard
- [x] Audit logging
- [x] Audit log viewer with filtering and export
- [x] PII encryption (AES-256-GCM)
- [x] GDPR data export endpoint
- [x] GDPR data deletion endpoint

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Mozilla Security Guidelines](https://infosec.mozilla.org/guidelines/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
