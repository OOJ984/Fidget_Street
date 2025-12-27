# Fidget Street - Claude Code Context

## Project Overview

E-commerce website for Fidget Street, selling fidget toys and stress relief items for kids 6+ and adults.

**Stack:**
- Frontend: HTML, Tailwind CSS, Vanilla JavaScript
- Backend: Netlify Functions (serverless)
- Database: Supabase (PostgreSQL)
- Storage: Supabase Storage (product images)
- Payments: Stripe + PayPal

## Brand Design

### Color Palette (Playful & Calming)
- **Soft Blue (#71c7e1)** - Primary calming base
- **Mint Green (#A8E0A2)** - Fresh accent
- **Lemon Yellow (#F9F92F)** - Playful pop/highlights
- **Lavender Purple (#D8B4E2)** - Calming undertone
- **Bright Coral (#FF6F61)** - Highlight warmth (accent color)

### Design Vibe
- Playful yet calming
- Minimalist, not cluttered
- Organic/fluid shapes (curves and swirls)
- Soft gradients between colors
- Suitable for kids 6+ AND adults
- Subtle fidget toy patterns in backgrounds

### Product Categories
- Articulated Toys
- Fidget Cubes
- Spinners
- Push Bubbles
- Shapeshifters
- Flexiforms
- Bundles

## Progress Status

### COMPLETED:
1. Created fidget_street folder (copied from Wicka as base)
2. Updated tailwind.config.js with new color palette
3. Removed node_modules, .git, .netlify from copy
4. Stripe payment integration configured and tested
5. Order number format changed from PP- to FS- prefix
6. Webhook retrieves full session for shipping details
7. Success page displays actual order number
8. Admin panel shows full order details with shipping address
9. Instagram feed on homepage (manual upload system)
10. Logo and brand assets added
11. Page view analytics system
12. Colors, sizes, and product variants management
13. Discount codes system
14. Gift cards system
15. Newsletter subscribers and email builder
16. Admin navigation with dropdown menu
17. Database sync script for prod/non-prod parity
18. Email notification system (order confirmation, shipping, gift cards, password reset)

### TODO (REMAINING):
1. Create playful background patterns
2. Update meta tags, og:image, etc.
3. Set up production Stripe keys (currently using test mode)
4. Configure RESEND_API_KEY in Netlify for production email sending

## Key Files to Update

### Branding (text replacement):
- All .html files: "Wicka" -> "Fidget Street"
- All .html files: "organisers" -> "fidget toys"
- supabase/schema.sql: Update categories

### Nav/Footer Categories:
- index.html
- products.html
- All pages with nav

### Colors to Replace:
- Navy (#051745) -> Soft Blue (#71c7e1) for primary
- Keep coral (#FF6F61) as accent (mapped from rose-gold)

## Project Structure

```
/
├── 3d-designs/         # OpenSCAD fidget toy designs and STL exports
├── admin/              # Admin panel pages
├── assets/             # Static assets (logo, icons)
├── data/               # JSON seed data
├── docs/               # Documentation
├── netlify/functions/  # Serverless API endpoints
├── scripts/            # Frontend JavaScript
├── styles/             # CSS (Tailwind)
├── supabase/           # Database schemas and migrations
└── *.html              # Public pages
```

### Admin Pages
- `/admin/` - Login
- `/admin/dashboard.html` - Overview
- `/admin/products.html` - Product management
- `/admin/orders.html` - Order management
- `/admin/colors.html` - Color management
- `/admin/sizes.html` - Size management
- `/admin/media.html` - Media library
- `/admin/analytics.html` - Page view stats
- `/admin/subscribers.html` - Newsletter subscribers
- `/admin/email-builder.html` - Marketing emails
- `/admin/discounts.html` - Discount codes
- `/admin/gift-cards.html` - Gift card management
- `/admin/website.html` - Site settings
- `/admin/users.html` - Admin user management
- `/admin/audit.html` - Audit logs

## Environment Variables

Required in `.env` or Netlify dashboard:
```
SUPABASE_URL
SUPABASE_SERVICE_KEY
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
JWT_SECRET
# INSTAGRAM_ACCESS_TOKEN  # Not needed - using manual uploads (see docs/instagram-setup.md)
```

## Production Deployment Checklist

### Required Environment Variables (Netlify Dashboard)
Set these in Netlify > Site Settings > Environment Variables before deploying:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ Yes | Production Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ Yes | Production Supabase service role key |
| `STRIPE_SECRET_KEY` | ✅ Yes | Live Stripe secret key (sk_live_...) |
| `STRIPE_PUBLISHABLE_KEY` | ✅ Yes | Live Stripe publishable key (pk_live_...) |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | Live webhook signing secret (whsec_...) |
| `PAYPAL_CLIENT_ID` | ✅ Yes | PayPal live client ID |
| `PAYPAL_CLIENT_SECRET` | ✅ Yes | PayPal live client secret |
| `JWT_SECRET` | ✅ Yes | Strong random string (32+ chars) |
| `ENCRYPTION_KEY` | ✅ Yes | 64-char hex string for PII encryption |
| `ADMIN_ALLOWED_IPS` | Optional | Comma-separated IP allowlist for admin |
| `RESEND_API_KEY` | ✅ Yes | For email notifications (order confirmations, etc.) |
| `EMAIL_FROM` | Optional | Sender address (default: Fidget Street <Fidget.Street@protonmail.com>) |

### Security Environment Variables (New)
```bash
# Generate ENCRYPTION_KEY (required in production):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ADMIN_ALLOWED_IPS (optional - restrict admin access to specific IPs):
# Leave empty to allow all IPs, or set comma-separated list:
ADMIN_ALLOWED_IPS=203.0.113.50,198.51.100.25
```

### Pre-Deployment Steps
1. [ ] Run `supabase/sync_all.sql` on production database
2. [ ] Set all required environment variables in Netlify
3. [ ] Generate and set `ENCRYPTION_KEY` (see above)
4. [ ] Configure Stripe webhook endpoint: `https://yourdomain.com/.netlify/functions/webhooks`
5. [ ] Verify CSP headers in `netlify.toml` include your domain

### Post-Deployment Verification
1. [ ] Test checkout flow with Stripe test card
2. [ ] Verify admin login works
3. [ ] Test MFA enrollment and verification
4. [ ] Check CSP violations in browser console
5. [ ] Verify orders appear in admin panel

## Common Tasks

### Run locally
```bash
cd C:\Users\coxj5\Documents\claudecode\fidget_street
npm install
npx netlify dev
```

### Build CSS
```bash
npm run build
```

### Test admin login
- URL: http://localhost:8888/admin/
- Email: admin@fidgetstreet.co.uk

### Stripe CLI (local webhook testing)
```bash
# Login (expires after 90 days)
C:\Users\coxj5\scoop\apps\stripe\current\stripe.exe login

# Forward webhooks to local dev server
C:\Users\coxj5\scoop\apps\stripe\current\stripe.exe listen --forward-to localhost:8888/.netlify/functions/webhooks

# Test checkout webhook
C:\Users\coxj5\scoop\apps\stripe\current\stripe.exe trigger checkout.session.completed
```

## Stripe Payment Configuration

See `stripe-payment-settings.md` for detailed payment method recommendations.

**Recommended payment methods (UK-focused):**
- Cards (1.5% + 20p)
- Apple Pay, Google Pay, Samsung Pay (same as cards)
- Link (same as cards)
- Amazon Pay (same as cards)
- Revolut Pay (0.8% + 2p - cheapest!)

**Avoid for UK:** Klarna (~5%), EU bank methods (+1.5% Brexit fee)

## Important Notes

- This project is separate from Wicka and Print Pearl
- Product images stored in Supabase Storage bucket `product-images`
- Logo/favicon stored as base64 in `website_settings` table
- Cart uses localStorage, fetches fresh product images from API
- Two Supabase databases: prod (`ppprhhctcfqkbpfsebcr`) and non-prod (`qyvojrjxzkwqljghlkoe`)
- Local dev uses non-prod database (configured in `.env`)

## Product Variations System

Products can have color and size variations that customers select before adding to cart.

### Database Tables
- **colors** - Central color management (name, hex_code, in_stock, display_order)
- **sizes** - Central size management (name, short_code, display_order)
- **product_variants** - Links products to color/size combinations with:
  - Individual stock per variant
  - Price adjustment (+/- from base price)
  - Variant-specific images
  - SKU per variant

### API Endpoints
**Public:**
- `GET /api/colors` - List all colors
- `GET /api/sizes` - List all sizes
- `GET /api/product-variants?product_id=X` - Get variants for a product

**Admin:**
- `GET/POST/PUT/DELETE /api/admin-colors` - Manage colors
- `GET/POST/PUT/DELETE /api/admin-sizes` - Manage sizes
- `GET/POST/PUT/DELETE /api/admin-product-variants` - Manage product variants

### Migration
Run `supabase/migrations/010_variations.sql` to create the tables.

### How It Works
1. Admin creates colors and sizes in the Colors/Sizes admin pages
2. For each product, admin creates variants (color + size combinations)
3. On product page, customer selects color and size
4. Selected variant info stored in cart with product
5. Order contains the specific variant (color, size, adjusted price)

## Analytics System

Tracks page views for understanding site traffic.

### Database Tables
- **page_views** - Individual page view records (path, title, referrer, device, session)
- **page_view_stats** - Aggregated daily stats per page

### API Endpoints
- `POST /api/track` - Record a page view (called from frontend)
- `GET /api/admin-analytics` - Get analytics data for admin dashboard

### Frontend
`scripts/analytics.js` automatically tracks page views on every page load.

## Discount Codes System

Supports percentage, fixed amount, and free delivery discounts.

### Database Tables
- **discount_codes** - Code definitions with limits and expiry
- **discount_usage** - Tracks per-customer usage

### API Endpoints
- `GET/POST/PUT/DELETE /api/admin-discounts` - Manage discount codes
- `POST /api/validate-discount` - Validate code at checkout

### Features
- Percentage or fixed amount discounts
- Free delivery option
- Start/end dates
- Max total uses
- Max uses per customer
- Minimum order amount

## Gift Cards System

Digital gift cards that can be purchased and redeemed.

### Database Tables
- **gift_cards** - Card details (code, balance, purchaser, recipient)
- **gift_card_transactions** - Transaction history

### API Endpoints
- `GET/POST/PUT/DELETE /api/admin-gift-cards` - Manage gift cards
- `POST /api/check-gift-card` - Check balance
- `POST /api/validate-gift-card` - Validate at checkout
- `POST /api/gift-card-checkout` - Purchase gift cards

### Public Pages
- `/gift-cards.html` - Purchase gift cards
- `/check-balance.html` - Check gift card balance
- `/gift-card-success.html` - Purchase confirmation

## Newsletter System

Email subscriber management and marketing emails.

### Database Tables
- **newsletter_subscribers** - Subscriber list with status

### API Endpoints
- `GET/POST/DELETE /api/subscribers` - Manage subscribers
- `POST /api/subscribe` - Public subscription endpoint

### Admin Pages
- `/admin/subscribers.html` - View/manage subscribers
- `/admin/email-builder.html` - Create marketing emails

## Email Notification System

Centralized email service using Resend API with branded HTML templates.

### Email Utility Module
`netlify/functions/utils/email.js` provides:

**Transactional Emails:**
- `sendOrderConfirmation(order)` - Sent when order is paid
- `sendGiftCardDelivery(giftCard)` - Sent when gift card is activated
- `sendShippingNotification(order, trackingInfo)` - Sent when order ships
- `sendAdminPasswordReset(email, resetUrl, expiryMinutes)` - Password reset link
- `sendMagicLink(email, magicLink)` - Customer order viewing access

**Marketing Emails:**
- `sendNewsletterWelcome(email)` - Sent on newsletter subscription
- `sendMarketingEmail(email, { subject, headline, body, ctaText, ctaUrl })` - Promotional emails

### Automatic Triggers
- **Order confirmation** - webhooks.js after successful Stripe payment
- **Gift card delivery** - webhooks.js after gift card activation
- **Shipping notification** - admin-orders.js when status changes to 'shipped'
- **Newsletter welcome** - subscribe.js on new subscription

### Development Mode
Without `RESEND_API_KEY`, emails are logged to console instead of sent.

### Email Templates
- Branded with Fidget Street colors (#71c7e1 primary, #FF6F61 accent)
- Mobile-responsive HTML templates
- Automatic unsubscribe link in marketing emails

### Password Reset Flow
1. User requests reset: `POST /api/reset-admin-password?action=request` with `{ email }`
2. System sends reset email with token (60-minute expiry)
3. User completes reset: `POST /api/reset-admin-password?action=reset` with `{ token, newPassword }`

## Database Sync

Two databases are used: prod and non-prod (for local development).

### Sync Script
Run `supabase/sync_all.sql` in Supabase SQL Editor for both databases to ensure they're identical.

**Non-prod:** https://supabase.com/dashboard/project/qyvojrjxzkwqljghlkoe/sql
**Prod:** https://supabase.com/dashboard/project/ppprhhctcfqkbpfsebcr/sql

The script is idempotent (safe to run multiple times).

## Security Features

### Authentication & Sessions
- **httpOnly Cookies** - Access and refresh tokens stored in httpOnly cookies (XSS-resistant)
- **CSRF Protection** - Double-submit cookie pattern for state-changing requests
- **Refresh Token Rotation** - Tokens rotated on refresh to limit exposure window
- **JWT Tokens** - 15-minute access tokens, 7-day refresh tokens
- **MFA Support** - TOTP-based two-factor authentication for admin accounts

### Rate Limiting
- **Login Rate Limiting** - Database-backed (survives serverless cold starts)
- **MFA Rate Limiting** - 5 attempts per 15-minute window, stored in `mfa_rate_limits` table
- **Magic Link Rate Limiting** - Prevents email enumeration

### Input Validation
- **XSS Prevention** - `containsXSS()` detects script tags, event handlers, JS protocol
- **HTML Encoding** - `encodeHTML()` for safe display of user content
- **Length Limits** - All text inputs validated:
  - Email: 254 chars
  - Name: 100 chars
  - Description: 5000 chars
  - Discount code: 50 chars
  - Personal message: 500 chars

### Error Handling
- **Error Sanitization** - `sanitizeErrorMessage()` removes database details, stack traces
- **Generic Errors** - Clients receive safe messages; details logged server-side only
- **Patterns Filtered**: SQL errors, table names, file paths, Supabase/Postgres references

### Network Security
- **CORS** - Restricted to `ALLOWED_ORIGINS` (no wildcards)
- **HSTS** - `max-age=63072000; includeSubDomains; preload`
- **CSP** - Content Security Policy with violation reporting to `/api/csp-report`
- **IP Allowlisting** - Optional `ADMIN_ALLOWED_IPS` for admin panel access

### Encryption
- **PII Encryption** - AES-256-GCM encryption for sensitive data
- **Production Enforcement** - `ENCRYPTION_KEY` required in production (throws error if missing)

### Anomaly Detection
- **Login Anomalies** - Detects brute force attempts per IP/email
- **Gift Card Anomalies** - Detects enumeration attacks
- **Amount Anomalies** - Detects price manipulation attempts

### Audit Logging
- All admin actions logged to `audit_logs` table
- Includes: user, action, resource, IP address, user agent, timestamp

### Security Utilities Location
```
netlify/functions/utils/
├── security.js        # CORS, JWT, RBAC, audit logging, IP allowlist
├── validation.js      # Input validation, XSS prevention, error sanitization
├── cookies.js         # httpOnly cookie management, CSRF tokens
├── crypto.js          # AES-256-GCM encryption/decryption
├── anomalyDetection.js # Threat detection and alerting
└── rateLimit.js       # Rate limiting configuration
```

## Known Issues / Gotchas

### Supabase Variable Name Conflict
**NEVER** declare a variable named `supabase` in frontend scripts that load alongside the Supabase CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
The CDN creates a global `window.supabase` object. Using `let supabase = ...` causes:
```
Identifier 'supabase' has already been declared
```
This breaks all JavaScript on the page and causes "Loading..." to hang forever.

**Solution:** Use `supabaseClient` instead:
```javascript
let supabaseClient = null;
supabaseClient = window.supabase.createClient(url, key);
```

Affected files (already fixed): `admin-products.js`, `admin-media.js`
