# Wicka - 2025 Best Practice Improvements

A prioritized roadmap of improvements based on 2025 web development best practices.

*Last updated: December 2025*

---

## High Priority

### Accessibility (WCAG 2.2 Compliance)

- [x] Add `:focus-visible` styles distinct from `:focus` for keyboard navigation
- [x] Add `@media (prefers-reduced-motion: reduce)` to disable animations
- [x] Verify/fix color contrast - Updated to `#C4707A` (5.0:1 ratio)
- [x] Add `aria-live="polite"` regions for cart updates and search results
- [ ] Add `role="alert"` for form validation error messages
- [ ] Test with screen reader (NVDA/VoiceOver)

### Security

- [x] Add Content-Security-Policy server headers (in netlify.toml)
- [x] Add security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- [ ] Add Subresource Integrity (`integrity` attribute) to external resources
- [ ] Implement CSRF token handling for forms

### Performance (Core Web Vitals)

- [x] Add `<link rel="preconnect">` for Google Fonts
- [x] Add `font-display: swap` to Google Fonts URL
- [x] Add `<link rel="preload">` for critical CSS
- [x] Add `<link rel="dns-prefetch">` for external domains (Stripe, PayPal)
- [x] Add `loading="lazy"` and `decoding="async"` to images
- [x] Add `fetchpriority="high"` to hero/LCP images
- [ ] Consider inlining critical CSS for above-the-fold content
- [ ] Use `<picture>` element with WebP/AVIF formats

---

## Medium Priority

### SEO & Structured Data

- [x] Add JSON-LD structured data for:
  - [x] Product schema on product pages (dynamic)
  - [x] Organization schema site-wide
  - [x] BreadcrumbList schema (dynamic on product page)
  - [x] LocalBusiness schema (for events)
- [x] Add Twitter Card meta tags (`twitter:card`, `twitter:site`)
- [x] Add `<meta name="theme-color" content="#C4707A">`
- [ ] Add hreflang tags if targeting multiple regions

### PWA Features

- [x] Create `manifest.json` for web app installability
- [x] Implement Service Worker for:
  - [x] Offline support
  - [x] Asset caching
  - [x] Faster repeat visits
- [x] Create `offline.html` fallback page
- [x] Add `apple-touch-icon` for iOS home screen
- [ ] Add splash screen images for installed app

### Privacy & Compliance

- [ ] Add GDPR-compliant cookie consent banner
- [ ] Add privacy controls / opt-out for analytics
- [ ] Display notice about localStorage usage for cart
- [ ] Review and update Privacy Policy with actual data practices

---

## Lower Priority

### Modern JavaScript

- [ ] Convert scripts to ES modules (`type="module"`)
- [ ] Lazy-load `cart.js` only on pages that need it
- [ ] Defer non-critical data fetching (products.json on search)
- [ ] Add try-catch with user-friendly error states
- [ ] Consider TypeScript for cart logic type safety

### Build & Tooling

- [ ] Upgrade to Tailwind CSS v4 (when stable)
- [ ] Consider Vite for:
  - [ ] Hot Module Replacement (HMR)
  - [ ] Automatic minification
  - [ ] Code splitting/chunking
- [x] Add ESLint configuration
- [x] Add Prettier for code formatting
- [ ] Add stylelint for CSS
- [ ] Set up pre-commit hooks (husky + lint-staged)

### UX Enhancements

- [x] Add skeleton loaders for dynamic content
- [ ] Implement optimistic UI for cart updates
- [ ] Add View Transitions API for smooth page navigation
- [ ] Preserve scroll position on back navigation
- [x] Add "Add to cart" animation feedback
- [x] Implement toast notifications for actions

---

## Quick Wins (< 1 hour each)

- [x] Add `theme-color` meta tag
- [x] Add `loading="lazy"` to all images
- [x] Add `fetchpriority="high"` to hero image
- [x] Add Twitter Card meta tags
- [x] Add `prefers-reduced-motion` media query
- [x] Add `aria-live` to cart count badge

---

## Resources

- [Web Vitals](https://web.dev/vitals/)
- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security)
- [Schema.org Product](https://schema.org/Product)
- [PWA Checklist](https://web.dev/pwa-checklist/)

---

*Generated: December 2024 | Updated: December 2025*
