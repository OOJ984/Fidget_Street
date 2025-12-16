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

### TODO (REMAINING):
1. Rebrand all HTML pages from "Wicka" to "Fidget Street"
2. Update navigation with fidget toy categories
3. Update footer links
4. Create new playful homepage design
5. Update product categories in database schema
6. Update all references to "organisers" to "fidget toys"
7. Create/update About page for Fidget Street brand
8. Update contact email and social links
9. Create playful background patterns
10. Update meta tags, og:image, etc.

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

## Important Notes

- DO NOT PUSH - user has no Netlify credit currently
- This project is separate from Wicka and Print Pearl
- Logo and assets need to be created/added later
- Product images stored in Supabase Storage bucket `product-images`
- Logo/favicon stored as base64 in `website_settings` table
- Cart uses localStorage, fetches fresh product images from API
