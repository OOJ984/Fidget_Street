# Changelog

All notable changes to Wicka are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- LocalBusiness JSON-LD schema on events page for SEO
- Cart button animation with checkmark feedback on add to cart
- CSS preload (`<link rel="preload">`) on all HTML pages for faster rendering
- `animateCartButton()` function for consistent cart feedback
- **Website Settings admin page** (`/admin/website.html`) with:
  - Branding settings (company name, tagline, logo, favicon)
  - Color customization (primary accent, secondary color) with live preview
  - Contact information (email, phone, address)
  - Social media links (Instagram, TikTok, Facebook, Twitter)
  - SEO defaults (title suffix, meta description, OG image)
  - Shipping settings (free shipping threshold, shipping cost, currency)
  - Footer content (tagline, copyright, additional note)
  - Reset to Defaults button to restore original settings
- **Supabase persistence for website settings** - changes now apply site-wide for all visitors
- Settings API endpoints (`/api/settings` and `/api/admin-settings`)
- Cache with background refresh strategy for settings (fast loads, automatic updates)
- Automatic image resizing on upload (logo: 200x200, favicon: 64x64, OG: 1200x630)
- `settings.js` frontend loader that applies custom colors and branding site-wide
- Dynamic shipping thresholds from admin settings
- SQL migration file for `website_settings` table (`/supabase/website_settings.sql`)

### Changed
- Service worker cache bumped to v8
- Quick Add buttons now use unified animation system
- Cart totals now use configurable shipping settings
- Added Website link to all admin page navigation
- Settings now persist to database instead of just browser localStorage

---

## [2.3.0] - 2025-12-04

### Added
- Toast notification system for cart actions (add/remove)
- Skeleton loaders for featured products on homepage
- DNS prefetch hints for Stripe and PayPal on index.html and cart.html
- Preconnect hint for Stripe on cart.html

### Changed
- Service worker cache bumped to v6

---

## [2.2.0] - 2025-12-04

### Added
- `loading="lazy"` and `decoding="async"` attributes on dynamic product images
- `fetchpriority="high"` on main product image for LCP optimization
- `aria-live="polite"` on cart count badges (all 12 HTML files)
- `aria-live="polite"` on search results container
- Dynamic Product JSON-LD schema on product detail page
- Dynamic BreadcrumbList JSON-LD schema on product detail page

### Changed
- Service worker cache bumped to v5

---

## [2.1.0] - 2025-12-04

### Added
- Media Library page (`/admin/media.html`) for centralized image management
- Bulk upload functionality with drag-and-drop support
- Image copy URL and delete functions
- Grid view of all uploaded images with metadata

---

## [2.0.0] - 2025-12-04

### Added
- Per-variation product images (e.g., different images for Gold vs Silver)
- `variation_images` field in product data structure
- Automatic gallery switching when selecting product variations
- Cart item images based on selected variation

### Changed
- Product gallery now updates dynamically when variation is selected
- Image structure supports both default images and variation-specific images

---

## [1.2.0] - 2025-12-04

### Added
- Admin panel (`/admin/`) with authentication
- Dashboard with sales overview and recent orders
- Products management page with inline editing
- Orders management page with status updates
- Supabase integration for database and file storage
- Image upload functionality for product images
- JWT-based admin authentication

### Security
- Admin routes protected with authentication
- Secure file uploads to Supabase Storage

---

## [1.1.0] - 2025-12-03

### Added
- `IMPROVEMENTS.md` roadmap document with 2025 best practices
- Prioritized improvement tasks for accessibility, security, performance
- Quick wins checklist for immediate enhancements

---

## [1.0.0] - 2025-12-03

### Added
- Initial Wicka e-commerce website
- Homepage with featured products and hero section
- Products page with category filtering and search
- Product detail page with variations and quantity selector
- Shopping cart with localStorage persistence
- Checkout flow (Stripe + PayPal integration)
- About, Contact, Events, FAQ pages
- Privacy Policy, Terms & Conditions, Returns Policy pages
- Instagram feed page
- Mobile-responsive navigation with hamburger menu
- PWA support with manifest.json and service worker
- Offline fallback page
- Organization JSON-LD schema
- Twitter Card and Open Graph meta tags
- WCAG 2.2 accessibility features:
  - Skip to main content link
  - Focus-visible styles
  - Reduced motion support
  - Semantic HTML structure
  - ARIA labels
- Security headers via Netlify (CSP, X-Frame-Options, etc.)
- Tailwind CSS v3 with custom rose-gold color palette
- Google Fonts (Playfair Display, Inter)

### Technical
- Static HTML/CSS/JS architecture
- Netlify Functions for serverless API
- LocalStorage cart management
- ESLint and Prettier configuration

---

## Version History Summary

| Version | Date       | Highlights                                    |
|---------|------------|-----------------------------------------------|
| 2.3.0   | 2025-12-04 | Toast notifications, skeleton loaders         |
| 2.2.0   | 2025-12-04 | Accessibility improvements, JSON-LD schemas   |
| 2.1.0   | 2025-12-04 | Media library for image management            |
| 2.0.0   | 2025-12-04 | Per-variation product images                  |
| 1.2.0   | 2025-12-04 | Admin panel with Supabase                     |
| 1.1.0   | 2025-12-03 | Improvements roadmap                          |
| 1.0.0   | 2025-12-03 | Initial release                               |

---

*A Young Enterprise Company*
