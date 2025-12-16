# Wicka - Complete Build Specification

> A comprehensive prompt/specification to build a full-featured e-commerce website for a Young Enterprise organisers company from scratch.

## Project Overview

Build a complete e-commerce website for "Wicka", a Young Enterprise company selling handcrafted organisers (organisers) and 3D-printed organisers holders. The site must be elegant, mobile-responsive, and include full payment processing, admin management, and customer order tracking.

### Business Context
- **Company**: Wicka (Young Enterprise company - student-run business)
- **Products**: Handmade organisers (crystal, charm) and 3D-printed organisers holders
- **Target Market**: UK customers
- **Brand Style**: Luxury, elegant, black/rose-gold color scheme

### Age Requirements (Important for Young Enterprise)
- Stripe: 13+ (with guardian as account owner if under 18)
- PayPal: 18+ only (adult must hold account)

---

## Technology Stack

### Frontend
- **HTML5** - Semantic, accessible markup
- **Tailwind CSS 3.4** - Utility-first styling
- **Vanilla JavaScript** - No framework, external script files
- **Progressive Web App** - Service worker, offline support

### Backend
- **Netlify Functions** - Serverless Node.js API
- **Supabase** - PostgreSQL database + file storage
- **Stripe** - Card payments
- **PayPal** - Alternative payment method

### Development
- **Vitest** - Testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitHub Actions** - CI/CD pipeline

---

## Project Structure

```
/
├── admin/                    # Admin panel pages
│   ├── index.html           # Login page
│   ├── dashboard.html       # Main dashboard
│   ├── products.html        # Product management
│   ├── orders.html          # Order management
│   ├── media.html           # Image uploads
│   ├── users.html           # User management
│   ├── website.html         # Site settings
│   ├── audit.html           # Activity logs
│   └── mfa-setup.html       # MFA setup
├── account/                  # Customer account pages
│   ├── login.html           # Magic link login
│   ├── orders.html          # Order history
│   └── verify.html          # Email verification
├── assets/                   # Static assets
│   ├── logo.svg
│   └── icons/
├── data/                     # JSON seed data
│   ├── products.json
│   ├── events.json
│   └── instagram_sample.json
├── docs/                     # Documentation
├── netlify/functions/        # Serverless API
│   ├── utils/               # Shared utilities
│   │   ├── security.js      # CORS, auth helpers
│   │   ├── validation.js    # Input validation
│   │   ├── checkout.js      # Price verification
│   │   ├── orders.js        # Order helpers
│   │   ├── rateLimit.js     # Rate limiting
│   │   ├── crypto.js        # Encryption
│   │   └── supabase.js      # DB client
│   ├── products.js          # Public products API
│   ├── orders.js            # Order creation
│   ├── settings.js          # Public settings
│   ├── health.js            # Health check
│   ├── stripe-checkout.js   # Stripe payments
│   ├── paypal-checkout.js   # PayPal payments
│   ├── paypal-capture.js    # PayPal capture
│   ├── webhooks.js          # Payment webhooks
│   ├── admin-auth.js        # Admin authentication
│   ├── admin-products.js    # Admin products CRUD
│   ├── admin-orders.js      # Admin orders
│   ├── admin-users.js       # User management
│   ├── admin-settings.js    # Site settings
│   ├── admin-media.js       # File uploads
│   ├── admin-audit.js       # Audit logs
│   ├── admin-mfa.js         # MFA management
│   ├── customer-auth.js     # Magic link auth
│   ├── customer-orders.js   # Customer orders
│   └── customer-data.js     # GDPR data export
├── scripts/                  # Frontend JavaScript
│   ├── api.js               # API client
│   ├── main.js              # Common functionality
│   ├── cart.js              # Cart management
│   ├── settings.js          # Dynamic settings
│   ├── admin-auth.js        # Admin auth
│   ├── home.js              # Homepage
│   ├── products-page.js     # Products listing
│   ├── product-page.js      # Single product
│   ├── cart-page.js         # Cart page
│   ├── success-page.js      # Order success
│   ├── contact-page.js      # Contact form
│   ├── events-page.js       # Events calendar
│   ├── faq-page.js          # FAQ accordion
│   └── instagram-page.js    # Instagram feed
├── styles/
│   ├── tailwind.css         # Tailwind input
│   └── output.css           # Compiled CSS
├── supabase/
│   ├── schema.sql           # Database schema
│   ├── seed.sql             # Seed data
│   └── migrations/          # Schema updates
├── tests/                    # Test files
├── .github/
│   ├── workflows/ci.yml     # CI pipeline
│   ├── dependabot.yml       # Dependency updates
│   └── pull_request_template.md
├── index.html               # Homepage
├── products.html            # Product listing
├── product.html             # Single product
├── cart.html                # Shopping cart
├── success.html             # Order confirmation
├── contact.html             # Contact page
├── about.html               # About page
├── events.html              # Events calendar
├── faq.html                 # FAQ page
├── instagram.html           # Instagram feed
├── privacy.html             # Privacy policy
├── terms.html               # Terms & conditions
├── returns.html             # Returns policy
├── offline.html             # Offline fallback
├── netlify.toml             # Netlify config
├── tailwind.config.js       # Tailwind config
├── package.json             # Dependencies
└── vitest.config.js         # Test config
```

---

## Database Schema (Supabase/PostgreSQL)

### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    price_gbp DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'GBP',
    category TEXT NOT NULL CHECK (category IN ('crystal-organisers', 'charm-organisers', 'holders')),
    materials TEXT[] DEFAULT '{}',
    dimensions TEXT,
    variations TEXT[] DEFAULT '{}',
    stock INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    description TEXT,
    images TEXT[] DEFAULT '{}',
    variation_images JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Orders Table
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,  -- Format: PP-YYYYMMDD-XXXX
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    shipping DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_method TEXT CHECK (payment_method IN ('stripe', 'paypal')),
    payment_id TEXT,
    payment_status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_orders_payment_id ON orders(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_orders_customer_email_created_at ON orders(customer_email, created_at DESC);
```

### Admin Users Table
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,  -- bcrypt, 12 rounds
    name TEXT,
    role TEXT DEFAULT 'business_processing' CHECK (role IN ('website_admin', 'business_processing')),
    mfa_secret TEXT,              -- TOTP secret
    mfa_enabled BOOLEAN DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Customers Table
```sql
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    magic_link_token TEXT,
    magic_link_expires TIMESTAMPTZ,
    session_token TEXT,
    session_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);
```

### Website Settings Table
```sql
CREATE TABLE website_settings (
    id SERIAL PRIMARY KEY,
    company_name TEXT DEFAULT 'Wicka',
    tagline TEXT,
    primary_color TEXT DEFAULT '#C4707A',
    secondary_color TEXT DEFAULT '#1a1a1a',
    logo_base64 TEXT,
    favicon_base64 TEXT,
    free_shipping_threshold DECIMAL(10,2) DEFAULT 20.00,
    shipping_cost DECIMAL(10,2) DEFAULT 2.99,
    contact_email TEXT,
    social_instagram TEXT,
    social_tiktok TEXT,
    footer_tagline TEXT,
    copyright_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id),
    user_email TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Rate Limits Table
```sql
CREATE TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'ip')),
    attempts INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ,
    UNIQUE(key, type)
);

-- Rate limiting functions
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_type TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER
) RETURNS TABLE(allowed BOOLEAN, attempts INTEGER, blocked_until TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION record_failed_attempt(
    p_key TEXT,
    p_type TEXT,
    p_max_attempts INTEGER,
    p_window_minutes INTEGER,
    p_block_minutes INTEGER
) RETURNS VOID;

CREATE OR REPLACE FUNCTION clear_rate_limit(
    p_key TEXT,
    p_type TEXT
) RETURNS VOID;
```

---

## Security Implementation

### Authentication

#### Admin Authentication
- bcrypt password hashing (12 rounds)
- JWT tokens (24-hour expiry)
- Mandatory TOTP MFA for all admins
- Persistent rate limiting (5 attempts per email, 20 per IP)
- Session validation on every request

#### Customer Authentication
- Magic link emails (passwordless)
- 24-hour session tokens
- No permanent accounts required

### CORS Configuration
```javascript
const ALLOWED_ORIGINS = [
    process.env.SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    'http://localhost:8888',
    'http://localhost:3000'
].filter(Boolean);

function getCorsHeaders(origin, methods = ['GET', 'POST', 'OPTIONS']) {
    const isAllowed = ALLOWED_ORIGINS.some(allowed =>
        origin === allowed || (allowed && origin?.endsWith(allowed.replace(/^https?:\/\//, '')))
    );

    return {
        'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    };
}
```

### Content Security Policy
```toml
# netlify.toml - Public pages (strict)
Content-Security-Policy = "default-src 'self'; script-src 'self' https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://api.stripe.com https://www.paypal.com https://*.supabase.co; frame-src 'self' https://js.stripe.com https://www.paypal.com; object-src 'none'; base-uri 'self'; form-action 'self' https://www.paypal.com;"

# Admin pages (with unsafe-inline for now)
[[headers]]
  for = "/admin/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; ..."
```

### Input Validation
All API endpoints must validate:
- Email format (RFC 5322)
- Phone numbers (UK format)
- Item quantities (1-99)
- Price ranges (£0.01-£10,000)
- String lengths (max 500 chars)
- Required fields

### Price Verification
Checkout endpoints MUST verify prices against database:
```javascript
async function verifyCartPrices(items) {
    const { data: products } = await supabase
        .from('products')
        .select('id, title, price_gbp, stock, is_active')
        .in('id', items.map(i => i.id))
        .eq('is_active', true);

    // Use DB prices, not client prices
    return products.map(p => ({
        id: p.id,
        title: p.title,
        price: parseFloat(p.price_gbp),
        // ...
    }));
}
```

### RBAC (Role-Based Access Control)
| Permission | business_processing | website_admin |
|------------|---------------------|---------------|
| View orders | Yes | Yes |
| Update orders | Yes | Yes |
| Manage products | Yes | Yes |
| Manage media | Yes | Yes |
| Site settings | No | Yes |
| Manage users | No | Yes |
| View audit logs | No | Yes |

---

## Payment Integration

### Stripe
```javascript
// stripe-checkout.js
const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: verifiedItems.map(item => ({
        price_data: {
            currency: 'gbp',
            product_data: { name: item.title },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    })),
    mode: 'payment',
    success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/cart.html`,
    shipping_address_collection: { allowed_countries: ['GB'] },
});
```

### PayPal
```javascript
// paypal-checkout.js
const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [{
        amount: {
            currency_code: 'GBP',
            value: total.toFixed(2),
            breakdown: {
                item_total: { currency_code: 'GBP', value: subtotal.toFixed(2) },
                shipping: { currency_code: 'GBP', value: shipping.toFixed(2) }
            }
        },
        items: orderItems,
    }],
};
```

### Webhook Handling
- Verify Stripe signatures
- Handle payment_intent.succeeded, payment_intent.payment_failed
- Idempotency check via payment_id
- Return 400 for permanent errors, 500 for transient (triggers retry)

---

## Frontend Features

### Shopping Cart
- localStorage persistence
- Real-time quantity updates
- Variation support
- Stock validation
- Shipping calculation (free over £20)

### Product Display
- Category filtering
- Tag filtering
- Image galleries
- Variation selection with images
- Add to cart with feedback

### Checkout Flow
1. Cart review
2. Customer info collection
3. Payment method selection (Stripe/PayPal)
4. Redirect to payment provider
5. Success page with order number

### Customer Account
- Magic link login (no password)
- Order history view
- GDPR data export

### Admin Panel
- Dashboard with stats
- Product CRUD
- Order management with status updates
- Media library (Supabase Storage)
- User management
- Site settings
- Audit log viewer
- MFA setup

---

## Design Specifications

### Color Palette
```css
:root {
    --rose-gold: #C4707A;
    --pastel-pink: #E8C4C4;
    --black: #000000;
    --gray-900: #171717;
    --gray-800: #262626;
    --white: #FFFFFF;
}
```

### Typography
- **Headings**: Playfair Display (serif)
- **Body**: Inter (sans-serif)

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Accessibility
- Skip links
- ARIA labels
- Keyboard navigation
- Focus indicators
- Alt text for images
- Semantic HTML

---

## Environment Variables

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
JWT_SECRET=your-32-char-random-string
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=your_webhook_secret_here
PAYPAL_CLIENT_ID=your_client_id_here
PAYPAL_CLIENT_SECRET=your_client_secret_here

# Optional
RESEND_API_KEY=your_resend_api_key    # For magic link emails
EMAIL_FROM=Wicka <orders@domain.com>
SITE_URL=https://wicka.co.uk
PAYPAL_SANDBOX=false
ENCRYPTION_KEY=32-byte-hex     # For PII encryption
```

---

## Testing Requirements

### Unit Tests
- Input validation functions
- Cart calculations
- Security utilities
- Crypto functions

### Integration Tests
- Authentication flows
- Payment simulations
- API endpoint responses

### Test Coverage Targets
- Critical paths: 100%
- Security functions: 100%
- API endpoints: 80%+

---

## CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:run

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
```

---

## Deployment Checklist

1. **Environment Setup**
   - [ ] Supabase project created
   - [ ] Database schema applied
   - [ ] Storage bucket created
   - [ ] RLS policies configured

2. **Payment Providers**
   - [ ] Stripe account verified
   - [ ] Stripe webhook configured
   - [ ] PayPal business account
   - [ ] PayPal app created

3. **Netlify Configuration**
   - [ ] Site connected to repo
   - [ ] Environment variables set
   - [ ] Custom domain configured
   - [ ] HTTPS enabled

4. **Security Verification**
   - [ ] JWT secret is strong (32+ chars)
   - [ ] CORS origins correct
   - [ ] Rate limiting working
   - [ ] Admin MFA enabled

5. **Testing**
   - [ ] All tests passing
   - [ ] Test purchase with Stripe
   - [ ] Test purchase with PayPal
   - [ ] Mobile responsive check

---

## Key Implementation Notes

1. **No inline scripts** - All JavaScript in external files for CSP compliance
2. **Server-side price verification** - Never trust client prices
3. **Persistent rate limiting** - Survives serverless cold starts
4. **Graceful degradation** - Fallbacks for failed API calls
5. **Optimistic updates** - Cart updates feel instant
6. **Progressive enhancement** - Works without JavaScript for basic browsing
7. **Audit everything** - Log all admin actions

---

## Summary

This specification describes a complete, production-ready e-commerce platform with:

- **Security-first design**: bcrypt, JWT, MFA, CORS, CSP, rate limiting, input validation, price verification
- **Modern architecture**: Jamstack, serverless, PostgreSQL
- **Full e-commerce features**: Products, cart, checkout, orders, payments
- **Admin capabilities**: CRUD, user management, settings, audit logs
- **Customer self-service**: Order tracking, GDPR exports
- **Developer experience**: Tests, CI/CD, linting, documentation

The codebase is designed to be maintainable by a Young Enterprise team while meeting professional security and quality standards.
