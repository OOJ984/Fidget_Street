# Wicka SEO Documentation

## Overview

This document outlines the SEO (Search Engine Optimization) implementation for the Wicka e-commerce website.

---

## Technical SEO (Implemented)

### Meta Tags

All pages include proper meta tags:
- `<title>` - Unique, descriptive titles for each page
- `<meta name="description">` - Unique descriptions for each page
- `<link rel="canonical">` - Canonical URLs to prevent duplicate content
- `<meta name="robots">` - Indexing controls (admin pages set to noindex)

### Open Graph & Social

All public pages include Open Graph meta tags for social sharing:
- `og:title`, `og:description`, `og:type`, `og:url`, `og:image`
- Twitter Card tags for Twitter/X sharing

### Structured Data (JSON-LD)

| Page | Schema Type | Description |
|------|-------------|-------------|
| Homepage | Organization | Business info, logo, social profiles |
| Product pages | Product + BreadcrumbList | Product details, pricing, availability |
| FAQ page | FAQPage | All questions and answers |
| Events page | Event | Event details, dates, locations |

### Sitemap

**Dynamic Sitemap API** (`/api/sitemap` → `/sitemap.xml`)
- Automatically includes all static pages
- Dynamically fetches all active products from database
- Products use their `updated_at` timestamp for `lastmod`
- Returns proper XML sitemap format
- 1-hour cache for performance

Included pages:
- Homepage (priority 1.0)
- Products listing (priority 0.9)
- Individual product pages (priority 0.8, dynamic)
- About, Events, Contact, FAQ (priority 0.6-0.7)
- Legal pages (priority 0.3)

### Robots.txt

Located at `/robots.txt`:
- Allows all crawlers access to public pages
- Blocks `/admin/` and `/api/` directories
- References sitemap location
- Allows CSS, JS, and assets for rendering

### URL Structure

- Clean, descriptive URLs
- Product pages: `/product.html?slug=product-name`
- Category filtering: `/products.html?category=crystal-organisers`

### Performance & Core Web Vitals

- CSS preloading (`rel="preload"`)
- Image lazy loading (`loading="lazy"`)
- Font preconnect for Google Fonts
- Static asset caching (1 year via netlify.toml)

### Accessibility

- Semantic HTML structure
- Skip links for keyboard navigation
- ARIA labels on interactive elements
- Alt text on images

---

## Maintenance Guide

### What's Automatic (No Action Needed)

| Item | Why It's Automatic |
|------|-------------------|
| **Sitemap** | Dynamic API fetches products from database automatically |
| **Product schema** | Generated from database when product page loads |
| **Breadcrumb schema** | Generated dynamically on product pages |

### What Requires Manual Updates

#### FAQ Page (`faq.html`)

When adding, removing, or editing FAQ questions:

1. Update the visible HTML accordion (the `<div class="faq-item">` elements)
2. **Also update the JSON-LD schema** in the `<head>` section

The schema is located near the top of the file inside:
```html
<script type="application/ld+json">
{
    "@type": "FAQPage",
    "mainEntity": [
        // Each question needs an entry here
    ]
}
</script>
```

**Example - Adding a new question:**
```json
{
    "@type": "Question",
    "name": "Your question here?",
    "acceptedAnswer": {
        "@type": "Answer",
        "text": "Your answer here. Keep it plain text, no HTML."
    }
}
```

#### Events Page (`events.html`)

When adding new events, update the Event schema in the `<head>` section with:
- Event name, description
- Start/end dates (ISO 8601 format: `2025-03-15T10:00:00`)
- Location details

#### Homepage (`index.html`)

Update Organization schema only if:
- Business name changes
- Logo URL changes
- Social media profiles change
- Contact information changes

#### Other Pages

When creating new pages:
- Add appropriate `<title>` and `<meta name="description">`
- Add Open Graph tags for social sharing
- Add to `STATIC_PAGES` array in `netlify/functions/sitemap.js` if it should appear in sitemap

### Quick Checklist

When updating content, ask yourself:

- [ ] Did I add/remove FAQ questions? → Update FAQ schema
- [ ] Did I add/remove events? → Update Event schema
- [ ] Did I create a new page? → Add to sitemap, add meta tags
- [ ] Did I change business info? → Update Organization schema

---

## Content SEO (Future Enhancement)

When the website content is finalized, consider implementing:

### 1. Keyword Optimization
- Research target keywords for organisers/handmade products
- Optimize page titles and descriptions
- Include keywords naturally in product descriptions
- Add alt text with relevant keywords to images

### 2. Content Improvements
- Detailed product descriptions (100+ words each)
- Blog/news section for content marketing
- Customer testimonials/reviews
- Behind-the-scenes/making-of content

### 3. Local SEO
- Google Business Profile setup
- Local keywords (e.g., "handmade organisers UK")
- Location pages if selling at specific markets

### 4. Link Building
- Social media profile links
- Young Enterprise directory listing
- Local business directories
- Influencer/blogger outreach

### 5. Review Schema
- Add aggregate rating schema to products (when reviews available)
- Implement customer review functionality

### 6. Additional Considerations
- Image optimization (WebP format, compression)
- Mobile-first content strategy
- Page speed optimization
- A/B testing for conversion

---

## Verification & Monitoring

### Search Console Setup
1. Verify site ownership in Google Search Console
2. Submit sitemap URL: `https://wicka.co.uk/sitemap.xml`
3. Monitor indexing status and fix any crawl errors

### Testing Tools
- [Google Rich Results Test](https://search.google.com/test/rich-results) - Validate structured data
- [Schema Markup Validator](https://validator.schema.org/) - Detailed schema testing
- [PageSpeed Insights](https://pagespeed.web.dev/) - Performance and Core Web Vitals
- [Mobile-Friendly Test](https://search.google.com/test/mobile-friendly) - Mobile usability

---

## Files Reference

| File | Purpose |
|------|---------|
| `netlify/functions/sitemap.js` | Dynamic sitemap API |
| `robots.txt` | Crawler instructions |
| `scripts/product-page.js` | Product & Breadcrumb schema injection |
| `faq.html` | FAQ schema (static) |
| `index.html` | Organization schema (static) |
| `events.html` | Event schema (static) |

---

## Changelog

- **2025-01-15**: Initial Technical SEO implementation
  - Dynamic sitemap with products
  - FAQ schema on FAQ page
  - Verified existing Product, Breadcrumb, Organization, and Event schemas
  - Created SEO documentation
