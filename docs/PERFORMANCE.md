# Wicka Performance & PWA Documentation

## Overview

This document covers performance optimizations and Progressive Web App (PWA) features implemented in the Wicka website.

---

## Performance Optimizations

### Script Loading

All local scripts use the `defer` attribute for non-blocking loading:

```html
<script defer src="scripts/api.js"></script>
<script defer src="scripts/main.js"></script>
```

**Benefits:**
- HTML parsing isn't blocked by script downloads
- Scripts execute in order after HTML is parsed
- Improves First Contentful Paint (FCP)

**Exception:** Payment provider scripts (Stripe, PayPal) on cart.html load synchronously because `cart-page.js` depends on them being available.

### Image Loading

- **Lazy loading:** Product images use `loading="lazy"` attribute
- **Async decoding:** Images use `decoding="async"` for non-blocking decode
- **Placeholder gradients:** Shown while images load

```javascript
// In main.js product card rendering
<img src="${img}" loading="lazy" decoding="async" alt="...">
```

### CSS Optimization

- **Preload:** CSS is preloaded in `<head>` for faster discovery
- **Single file:** All styles compiled to one `output.css` file
- **Minified:** Tailwind CSS compiled with `--minify` flag

```html
<link rel="preload" href="styles/output.css" as="style">
<link href="styles/output.css" rel="stylesheet">
```

### Caching (netlify.toml)

| Resource | Cache Duration | Strategy |
|----------|----------------|----------|
| `/assets/*` | 1 year | Immutable |
| `/styles/output.css` | 1 year | Immutable |
| `/scripts/*` | 1 year | Immutable |
| HTML pages | Default | Revalidate on deploy |
| API responses | None | Always fresh |

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="...&display=swap" rel="stylesheet">
```

- **Preconnect:** Early connection to font servers
- **Font display swap:** Text visible immediately with fallback font

---

## Progressive Web App (PWA)

### Features

| Feature | Status | Notes |
|---------|--------|-------|
| Installable | Ready | Manifest configured |
| Offline support | Ready | Service worker with fallback |
| Home screen icon | Needs icons | See asset requirements |
| App shortcuts | Ready | Shop and Cart shortcuts |
| Push notifications | Infrastructure ready | Handler in sw.js |

### Manifest (`manifest.json`)

```json
{
  "name": "Wicka",
  "short_name": "Wicka",
  "display": "standalone",
  "theme_color": "#C4707A",
  "background_color": "#000000",
  "start_url": "/",
  "shortcuts": [...]
}
```

### Service Worker (`sw.js`)

**Caching Strategy:** Stale-while-revalidate
- Serves cached content immediately
- Updates cache in background
- Falls back to network if not cached

**Precached Assets:**
- Homepage, products, cart pages
- Core scripts and styles
- Logo and manifest

**API Handling:** API requests bypass cache for fresh data

**Offline Fallback:** Shows `/offline.html` when network unavailable

### Required Assets (Content Dependent)

These files are referenced but need to be created:

| File | Size | Purpose |
|------|------|---------|
| `assets/icon-192.png` | 192x192 | App icon |
| `assets/icon-512.png` | 512x512 | App icon (large) |
| `assets/icon-maskable.png` | 512x512 | Adaptive icon |
| `assets/screenshot-wide.png` | 1280x720 | Install prompt |
| `assets/screenshot-narrow.png` | 750x1334 | Mobile install prompt |

**Icon Guidelines:**
- Use PNG format with transparency
- Maskable icon should have 40% safe zone padding
- Match brand colors (rose gold #C4707A on black #000000)

---

## Testing Performance

### Lighthouse

Run a Lighthouse audit in Chrome DevTools:
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" and "PWA" categories
4. Click "Analyze page load"

**Target Scores:**
- Performance: 90+
- Best Practices: 90+
- PWA: All checks pass

### Core Web Vitals

| Metric | Target | Description |
|--------|--------|-------------|
| LCP | < 2.5s | Largest Contentful Paint |
| FID | < 100ms | First Input Delay |
| CLS | < 0.1 | Cumulative Layout Shift |

### PWA Testing

1. **Install prompt:** Visit site in Chrome, look for install icon in address bar
2. **Offline mode:** Enable airplane mode in DevTools, navigate site
3. **Service worker:** Check Application > Service Workers in DevTools

---

## Future Improvements

### When Content Is Ready

1. **Create PWA icons** - Generate from logo
2. **Create screenshots** - Capture actual site
3. **Image optimization** - Convert to WebP format
4. **Responsive images** - Add srcset for different sizes

### Optional Enhancements

- HTTP/2 Server Push for critical assets
- Critical CSS extraction for above-the-fold content
- JavaScript bundling (reduce HTTP requests)
- AVIF image format support
- Resource hints (prefetch likely navigation)

---

## Files Reference

| File | Purpose |
|------|---------|
| `sw.js` | Service worker |
| `manifest.json` | PWA manifest |
| `offline.html` | Offline fallback page |
| `netlify.toml` | Cache headers |
| `scripts/main.js` | SW registration (line 388) |
