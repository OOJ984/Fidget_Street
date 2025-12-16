# Wicka Website Planning Document

**Project:** Wicka E-Commerce Website
**Date:** 22nd November 2024
**Author:** [Student Name]
**Course:** GCSE Business / Computer Science
**Organisation:** Young Enterprise company

---

## 1. Executive Summary

This document outlines the planning and technical decisions for creating an e-commerce website for Wicka, a Young Enterprise company selling hand-designed organisers including 3D-printed organisers, pearl accessories, and storage solutions.

The website needs to:
- Showcase products professionally
- Allow customers to browse and purchase items
- Work on all devices (mobile, tablet, desktop)
- Be accessible to users with disabilities
- Cost nothing or very little to run
- Be secure and trustworthy (HTTPS)

---

## 2. Business Requirements

### 2.1 About Wicka

Wicka is a student-run Young Enterprise company specialising in hand-designed organisers. Our unique selling point is combining modern 3D-printing technology with classic pearl aesthetics to create affordable, elegant accessories.

**Target Audience:**
- Primary: Young women aged 16-30
- Secondary: Gift buyers (parents, partners)
- Tertiary: organisers enthusiasts who appreciate handmade items

### 2.2 Website Requirements

| Requirement | Priority | Description |
|-------------|----------|-------------|
| Product catalogue | Essential | Display all products with images, descriptions, prices |
| Shopping cart | Essential | Allow customers to add items and checkout |
| Mobile responsive | Essential | Must work perfectly on phones (70%+ of traffic expected) |
| Contact form | Essential | Allow customer enquiries |
| Payment processing | Essential | Accept card payments securely |
| Search function | Important | Help customers find specific products |
| Product filtering | Important | Filter by category, price, etc. |
| About page | Important | Tell our brand story |
| HTTPS security | Essential | Secure connection (required for payments) |
| Fast loading | Important | Under 3 seconds load time |
| Accessibility | Essential | WCAG 2.1 AA compliance |

### 2.3 Success Criteria

1. Website loads in under 3 seconds on mobile
2. All products visible and purchasable
3. Works on Chrome, Firefox, Safari, Edge
4. Passes WAVE accessibility checker with no errors
5. Secure HTTPS connection active
6. Contact form delivers messages successfully
7. Payment processing works without errors
8. Monthly hosting cost: £0

---

## 3. Technology Options Analysis

### 3.1 Website Builder vs Custom Code

#### Option A: Google Sites

**Pros:**
- Completely free
- Very easy to use (drag and drop)
- No coding knowledge required
- Automatic HTTPS
- Reliable Google hosting
- Easy collaboration for team members

**Cons:**
- Very limited customisation
- No e-commerce functionality (cannot sell products)
- Cannot add custom JavaScript
- Limited to Google's templates
- Looks generic/unprofessional
- No payment integration possible
- Cannot connect to databases
- Limited SEO control

**Verdict:** Not suitable. Google Sites cannot handle e-commerce, payments, or shopping carts. It's designed for simple informational sites only.

#### Option B: Wix/Squarespace

**Pros:**
- Drag and drop builder
- E-commerce features available
- Professional templates
- Built-in payment processing

**Cons:**
- Free tier shows ads and Wix branding
- E-commerce requires paid plan (£13-27/month)
- Monthly ongoing cost not sustainable for school project
- Limited customisation on free tier

**Verdict:** Too expensive for Young Enterprise budget.

#### Option C: WordPress.com

**Pros:**
- Very popular platform
- Many themes available
- E-commerce plugins exist (WooCommerce)

**Cons:**
- Free tier very limited
- E-commerce requires Business plan (£20/month)
- Can be slow and bloated
- Security vulnerabilities if not maintained

**Verdict:** Too expensive for e-commerce features.

#### Option D: Custom HTML/CSS/JavaScript with Free Hosting

**Pros:**
- Complete control over design
- No monthly costs with free hosting
- Professional, unique appearance
- Can add any functionality needed
- Fast performance
- Great learning experience
- Full SEO control

**Cons:**
- Requires coding knowledge
- More initial development time
- Must handle our own security

**Verdict:** Best option if coding skills are available.

### 3.2 Hosting Options Comparison

| Platform | Free Tier | Custom Domain | HTTPS | E-commerce | Verdict |
|----------|-----------|---------------|-------|------------|---------|
| Google Sites | Yes | Yes (paid) | Yes | No | Not suitable |
| GitHub Pages | Yes | Yes | Yes | Limited | Good for static |
| Netlify | Yes | Yes | Yes | Yes (with functions) | **Best choice** |
| Vercel | Yes | Yes | Yes | Yes | Good alternative |
| Render | Yes | Yes | Yes | Yes | Good alternative |

### 3.3 Recommended Technology Stack

After evaluating all options, the recommended stack is:

| Component | Technology | Cost | Reason |
|-----------|------------|------|--------|
| Frontend | HTML, CSS, JavaScript | Free | Full control, fast, accessible |
| CSS Framework | Tailwind CSS | Free | Modern, responsive, customisable |
| Hosting | Netlify | Free | Generous free tier, automatic HTTPS, serverless functions |
| Database | Supabase | Free | 500MB free, PostgreSQL, easy to use |
| Payments | Stripe + PayPal | Transaction fees only | Industry standard, no monthly fees |
| Domain | TBC | ~£5-10/year | See section 4 |
| SSL/HTTPS | Let's Encrypt (via Netlify) | Free | Automatic, trusted certificate |

**Total Monthly Cost: £0**
**Total Annual Cost: ~£5-10** (domain only)

---

## 4. Domain Name Options

A custom domain (e.g., wicka.co.uk) is important for:
- Professionalism and trust
- Brand recognition
- SEO benefits
- Customer memory

### 4.1 Domain Registrar Comparison

| Registrar | .co.uk Price | .com Price | Free WHOIS Privacy | Notes |
|-----------|--------------|------------|-------------------|-------|
| Namecheap | £5.48/year | £8.16/year | Yes | Best value |
| Porkbun | £4.74/year | £8.56/year | Yes | Cheapest .co.uk |
| Google Domains | £10/year | £10/year | Yes | Simple but pricier |
| GoDaddy | £0.99 first year | £0.99 first year | No (£8 extra) | Hidden costs after year 1 |
| Cloudflare | £4.95/year | £8.57/year | Yes | At-cost pricing |

### 4.2 Recommendation

**Porkbun** or **Namecheap** for best value:
- wicka.co.uk (~£5/year)
- Free WHOIS privacy (hides personal details)
- Easy DNS management
- No hidden renewal price increases

### 4.3 Free Subdomain Alternative

If budget is absolutely zero, use Netlify's free subdomain:
- wicka.netlify.app (completely free)
- Still gets HTTPS
- Can upgrade to custom domain later

---

## 5. Security Requirements

### 5.1 HTTPS (SSL/TLS)

HTTPS is essential because:
1. **Required for payments** - Card processors require secure connections
2. **Browser warnings** - Chrome shows "Not Secure" for HTTP sites
3. **SEO ranking** - Google ranks HTTPS sites higher
4. **Trust** - Customers expect the padlock icon
5. **Data protection** - Encrypts customer information

**Implementation:** Netlify provides free SSL certificates via Let's Encrypt, automatically renewed.

### 5.2 Security Headers

The website will implement security headers:

| Header | Purpose |
|--------|---------|
| Content-Security-Policy | Prevents XSS attacks |
| X-Frame-Options | Prevents clickjacking |
| X-Content-Type-Options | Prevents MIME sniffing |
| Referrer-Policy | Controls referrer information |
| Permissions-Policy | Restricts browser features |

### 5.3 Payment Security

- **No card data stored** - Stripe/PayPal handle all payment data
- **PCI Compliance** - Using Stripe Checkout means we don't need PCI certification
- **Tokenisation** - Card details never touch our server

### 5.4 Data Protection

- GDPR compliant privacy policy
- Cookie consent banner
- Secure database with row-level security
- No unnecessary data collection

---

## 6. Accessibility Requirements

The website must be accessible to users with disabilities, following WCAG 2.1 Level AA guidelines.

### 6.1 Key Requirements

| Requirement | Implementation |
|-------------|----------------|
| Colour contrast | Minimum 4.5:1 ratio for text |
| Keyboard navigation | All functions accessible without mouse |
| Screen reader support | Proper ARIA labels and semantic HTML |
| Alt text | All images have descriptive alternatives |
| Focus indicators | Visible focus states for interactive elements |
| Text sizing | Works at 200% zoom |
| Motion | Respect prefers-reduced-motion |

### 6.2 Testing Tools

- WAVE browser extension
- Lighthouse (Chrome DevTools)
- axe DevTools
- Manual keyboard testing

---

## 7. Performance Requirements

### 7.1 Targets

| Metric | Target | Reason |
|--------|--------|--------|
| First Contentful Paint | < 1.5s | User perceives page loading |
| Largest Contentful Paint | < 2.5s | Main content visible |
| Time to Interactive | < 3.0s | Page becomes usable |
| Cumulative Layout Shift | < 0.1 | Prevents annoying jumps |

### 7.2 Optimisation Strategies

1. **Image optimisation** - WebP format, lazy loading, responsive sizes
2. **Minimal JavaScript** - No heavy frameworks
3. **CSS optimisation** - Purge unused styles
4. **Caching** - Long cache times for static assets
5. **CDN** - Netlify's global CDN included free

---

## 8. Development Approach

### 8.1 Tools Required

| Tool | Purpose | Cost |
|------|---------|------|
| VS Code | Code editor | Free |
| Git | Version control | Free |
| GitHub | Code repository | Free |
| Chrome DevTools | Testing/debugging | Free |
| Figma | Design mockups | Free |

### 8.2 Development Phases

**Phase 1: Foundation (Week 1)**
- Set up project structure
- Create basic HTML pages
- Implement CSS styling
- Mobile responsive layout

**Phase 2: Functionality (Week 2)**
- Product catalogue
- Shopping cart
- Search and filtering
- Contact form

**Phase 3: Backend (Week 3)**
- Database setup
- Product management
- Order processing
- Admin panel

**Phase 4: Payments (Week 4)**
- Stripe integration
- PayPal integration
- Order confirmation
- Email notifications

**Phase 5: Polish (Week 5)**
- Testing
- Bug fixes
- Performance optimisation
- Accessibility audit

### 8.3 Testing Strategy

| Test Type | Tools | When |
|-----------|-------|------|
| Cross-browser | BrowserStack / Manual | After each phase |
| Mobile responsive | Chrome DevTools | Continuous |
| Accessibility | WAVE, Lighthouse | Phase 5 |
| Performance | Lighthouse, WebPageTest | Phase 5 |
| Payment testing | Stripe/PayPal test mode | Phase 4 |

---

## 9. Conclusion and Recommendation

### 9.1 Final Technology Decision

After careful analysis, **Google Sites is not suitable** for Wicka because:
- It cannot process payments
- It cannot have a shopping cart
- It looks unprofessional for e-commerce
- It lacks necessary customisation

**The recommended solution is:**

| Component | Choice | Justification |
|-----------|--------|---------------|
| Development | Custom HTML/CSS/JS | Full control, professional result, learning value |
| Hosting | Netlify | Free, fast, includes HTTPS and serverless functions |
| Database | Supabase | Free tier sufficient, modern, easy API |
| Payments | Stripe + PayPal | Give customers choice, no monthly fees |
| Domain | Porkbun/Namecheap | ~£5/year for .co.uk |

### 9.2 Cost Summary

| Item | One-time Cost | Annual Cost |
|------|---------------|-------------|
| Hosting (Netlify) | £0 | £0 |
| Database (Supabase) | £0 | £0 |
| SSL Certificate | £0 | £0 |
| Domain name | - | £5-10 |
| Payment processing | - | Transaction fees only (1.4% + 20p) |
| **Total** | **£0** | **~£5-10** |

### 9.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Exceeding free tier limits | Low | Medium | Monitor usage, paid tiers affordable if needed |
| Technical difficulties | Medium | Medium | Allow buffer time, seek help if stuck |
| Payment issues | Low | High | Use test mode extensively before launch |
| Security vulnerabilities | Low | High | Follow security best practices, use established providers |

---

## 10. Approval

This planning document requires approval before development begins.

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Student Developer | | | |
| Teacher/Supervisor | | | |
| Young Enterprise Advisor | | | |

---

*Document Version: 1.0*
*Last Updated: 22nd November 2024*
