# Wicka - E-commerce Website

A modern, luxury e-commerce website for Wicka, a student-run Young Enterprise company creating handcrafted organisers and 3D-printed accessories.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [File Structure](#file-structure)
- [Installation](#installation)
- [Development](#development)
- [Customization](#customization)
- [Deployment](#deployment)
- [Adding Products](#adding-products)
- [Integrations](#integrations)
- [SEO](#seo)
- [License](#license)

## Overview

Wicka is a fully responsive, client-side e-commerce website built with:

- **HTML5** - Semantic, accessible markup
- **TailwindCSS** - Utility-first CSS framework
- **Vanilla JavaScript** - No framework dependencies
- **JSON** - Local data storage for products and events
- **localStorage** - Client-side cart persistence

### Design System

- **Primary Color (Rose Gold):** `#B76E79`
- **Accent Color (Pastel Pink):** `#F6D1D8`
- **Background:** `#000000` (Black)
- **Text:** `#FFFFFF` (White)
- **Gray Scale:** Custom gray palette

### Fonts

- **Serif:** Playfair Display (headings)
- **Sans-serif:** Inter (body text)

## Features

- Responsive design (mobile-first)
- Product catalog with filtering and search
- Client-side shopping cart (localStorage)
- Product variations support
- Stock management display
- Events calendar with Google Calendar integration
- Contact form (configurable endpoint)
- Newsletter signup
- Instagram feed integration
- FAQ accordion
- Legal pages (Privacy, Terms, Returns)
- SEO optimized (meta tags, Open Graph, sitemap)
- Accessibility features (ARIA labels, keyboard navigation)

## File Structure

```
wicka/
├── index.html              # Homepage
├── products.html           # Product catalog
├── product.html            # Single product page
├── cart.html               # Shopping cart & checkout
├── about.html              # About us page
├── events.html             # Events & markets
├── contact.html            # Contact form
├── faq.html                # FAQ page
├── instagram.html          # Instagram feed
├── privacy.html            # Privacy policy
├── terms.html              # Terms & conditions
├── returns.html            # Returns policy
├── scripts/
│   ├── main.js             # Main JavaScript
│   └── cart.js             # Cart functionality
├── styles/
│   ├── tailwind.css        # Tailwind entry file
│   └── output.css          # Compiled CSS (generated)
├── data/
│   ├── products.json       # Product data
│   ├── events.json         # Events data
│   └── instagram_sample.json # Instagram feed data
├── assets/
│   └── logo.svg            # Logo placeholder
├── tailwind.config.js      # Tailwind configuration
├── package.json            # NPM configuration
├── sitemap.xml             # Sitemap for SEO
├── robots.txt              # Robots configuration
├── LICENSE                 # License file
└── README.md               # This file
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Setup

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/wicka.git
   cd wicka
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the CSS:
   ```bash
   npm run build
   ```

4. Open `index.html` in your browser or use a local server:
   ```bash
   npm run preview
   ```

## Development

### Watch Mode

During development, run Tailwind in watch mode to automatically rebuild CSS:

```bash
npm run dev
```

This will watch for changes in HTML and JS files and rebuild `styles/output.css`.

### Building for Production

Create a minified production build:

```bash
npm run build
```

## Customization

### Changing Brand Colors

Edit `tailwind.config.js`:

```javascript
colors: {
  'rose-gold': '#B76E79',    // Change this
  'pastel-pink': '#F6D1D8',  // Change this
}
```

Then rebuild CSS with `npm run build`.

### Updating CSS Variables

Edit `styles/tailwind.css` to add custom component styles or utilities.

### Changing Fonts

1. Update Google Fonts links in all HTML files
2. Update `fontFamily` in `tailwind.config.js`
3. Rebuild CSS

## Deployment

### Netlify (Recommended)

1. Push code to GitHub/GitLab
2. Connect repository to Netlify
3. Build command: `npm run build`
4. Publish directory: `.` (root)

### Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Framework preset: Other
4. Build command: `npm run build`
5. Output directory: `.`

### GitHub Pages

1. Build CSS: `npm run build`
2. Enable GitHub Pages in repository settings
3. Select branch and root folder

### Manual Hosting

Upload all files (excluding `node_modules`) to your web server.

## Adding Products

### Product JSON Structure

Edit `data/products.json`:

```json
{
  "id": 11,
  "title": "Product Name",
  "slug": "product-name",
  "price_gbp": 9.99,
  "currency": "GBP",
  "category": "crystal-organisers",
  "materials": ["Material 1", "Material 2"],
  "dimensions": "Size info",
  "variations": ["Option 1", "Option 2"],
  "stock": 10,
  "tags": ["featured", "new"],
  "description": "Product description...",
  "image": ""
}
```

### Categories

Available categories:
- `crystal-organisers`
- `charm-organisers`
- `holders`

### Tags

Available tags:
- `featured` - Shows on homepage
- `new` - New arrival badge
- `bestseller` - Bestseller badge
- `gift` - Gift ideas filter

### Adding Images

1. Add product images to `assets/products/`
2. Update the `image` field in products.json
3. Replace IMAGE_PLACEHOLDER comments with actual `<img>` tags

## Integrations

### Payment Gateway (Stripe/PayPal)

See commented instructions in `cart.html` for:
- Stripe integration
- PayPal integration

### Contact Form

Options in `contact.html`:
1. **Formspree** - Add your form ID
2. **Netlify Forms** - Add netlify attribute
3. **Custom API** - Replace endpoint URL

### Newsletter

Replace the newsletter form handler with your service:
- Mailchimp
- ConvertKit
- Custom API

### Instagram Feed

Options in `instagram.html`:
1. Instagram embed code
2. Third-party widgets (Elfsight, SnapWidget)
3. Instagram Basic Display API

## SEO

### Meta Tags

Each page includes:
- Title tag
- Meta description
- Canonical URL
- Open Graph tags

### Sitemap

`sitemap.xml` includes all pages. Update URLs when deploying to your domain.

### robots.txt

Configure crawling permissions as needed.

### Improving SEO

1. Replace placeholder text with unique content
2. Add actual product images with descriptive alt text
3. Submit sitemap to Google Search Console
4. Set up Google Analytics
5. Add structured data (JSON-LD) for products

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

## Performance Tips

1. Optimize images before uploading
2. Use WebP format where possible
3. Enable compression on your server
4. Consider lazy loading for images
5. Use a CDN for static assets

## Accessibility

The site includes:
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Skip links
- Focus indicators
- Alt text placeholders

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Support

For questions about this template:
- Email: hello@wicka.co.uk
- GitHub Issues: [Create an issue](https://github.com/yourusername/wicka/issues)

## Credits

- Built with [TailwindCSS](https://tailwindcss.com)
- Fonts from [Google Fonts](https://fonts.google.com)
- Icons from inline SVGs

---

**Wicka** - A Young Enterprise company

*Handcrafted with love by young designers*
