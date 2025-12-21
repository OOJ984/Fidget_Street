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

### Product Categories (TO UPDATE)
- Fidget Spinners
- Fidget Cubes
- Pop-Its / Sensory Toys
- Stress Balls & Squeeze Toys
- Desk Gadgets

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

### TODO (REMAINING):
1. Create logo and brand assets
2. Create playful background patterns
3. Update meta tags, og:image, etc.
4. Set up production Stripe keys (currently using test mode)
5. Configure email notifications for orders

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
```

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

- DO NOT PUSH - user has no Netlify credit currently
- This project is separate from Wicka and Print Pearl
- Logo and assets need to be created/added later
- Product images stored in Supabase Storage bucket `product-images`
- Logo/favicon stored as base64 in `website_settings` table
- Cart uses localStorage, fetches fresh product images from API
