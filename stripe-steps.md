# Stripe Integration Complete Setup Plan

## Current State Summary

### What You Have Working:
- `STRIPE_SECRET_KEY` - Set in .env and Netlify
- `STRIPE_PUBLISHABLE_KEY` - Set in .env and Netlify
- `stripe-checkout.js` - Creates checkout sessions, verifies prices against DB
- `webhooks.js` - Handles payment completion, creates orders
- `cart-page.js` - Frontend checkout flow
- Price verification against database (security feature)
- `.gitignore` properly excludes `.env` files (your keys are safe)

### What's Missing/Broken:
1. `STRIPE_WEBHOOK_SECRET` not configured (shows `whsec_...` placeholder)
2. Base URL defaults to `wicka.co.uk` instead of `fidgetstreet.netlify.app`
3. Success page shows wrong email (`wicka@protonmail.com`)
4. Stripe CLI not installed for local testing
5. Stripe account may not be fully verified for UK sales

---

## PHASE 1: Stripe Account Setup (Do This First)

### Step 1.1: Verify Stripe Account for UK Sales
1. Go to https://dashboard.stripe.com/account
2. Complete **Business details**:
   - Business type (Individual/Sole trader) *** NEEDS COMPLETING ***
   - Business address (UK)
   - Industry: Retail → Toys
3. Complete **Bank account** for payouts:
   - UK bank account (sort code + account number)  *** WHOS ACCOUNT ***
4. Verify your **identity** if prompted

### Step 1.2: Important Stripe Settings
1. **Branding** (https://dashboard.stripe.com/settings/branding):  *** DONE ***
   - Add business name: "Fidget Street"
   - Add logo
   - Set brand color: #71c7e1
2. **Customer emails** (https://dashboard.stripe.com/settings/emails):  *** DONE ***
   - Enable "Successful payments" email
   - Enable "Refunds" email
3. **Payment methods** (https://dashboard.stripe.com/settings/payment_methods):  *** DONE ***
   - Ensure "Cards" is enabled
   - Consider enabling Apple Pay / Google Pay

### Step 1.3: Security Settings
1. **Two-factor authentication** - Enable on your Stripe account  *** DONE ***
2. **Team members** - Only add trusted people DONE
3. **API key restrictions** - Consider restricting keys by IP in production  *** DO THIS HOW ??? ***

---

## PHASE 2: Local Development Setup (Stripe CLI)

### Step 2.1: Install Stripe CLI
**Option A - Using Scoop (recommended for Windows):**
```bash
scoop install stripe
```

**Option B - Manual download:**
1. Go to https://github.com/stripe/stripe-cli/releases
2. Download `stripe_X.X.X_windows_x86_64.zip`
3. Extract to a folder (e.g., `C:\stripe`)
4. Add that folder to your system PATH

### Step 2.2: Login to Stripe CLI
```bash
stripe login
```
This opens your browser to authenticate with Stripe.

### Step 2.3: Start Webhook Forwarding (Get Local Secret)
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/webhooks
```

This will display something like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx
```

**Copy this secret!**

### Step 2.4: Update Your .env File
Open `.env` and change:
```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```
(Replace with the actual secret from Step 2.3)

### Step 2.5: Test Locally
**Terminal 1 - Run the site:**
```bash
npx netlify dev
```

**Terminal 2 - Forward webhooks:**
```bash
stripe listen --forward-to localhost:8888/.netlify/functions/webhooks
```

**Terminal 3 (optional) - Trigger test events:**
```bash
stripe trigger checkout.session.completed
```

---

## PHASE 3: Production Webhook Setup

### Step 3.1: Create Production Webhook in Stripe Dashboard
1. Go to https://dashboard.stripe.com/webhooks
2. Click **Add endpoint**
3. Enter URL: `https://fidgetstreet.netlify.app/.netlify/functions/webhooks`
4. Click **Select events** and choose:
   - `checkout.session.completed` (required)
   - `payment_intent.payment_failed` (recommended)
5. Click **Add endpoint**

### Step 3.2: Get Production Webhook Secret
1. Click on the webhook you just created
2. Under "Signing secret", click **Reveal**
3. Copy the secret (starts with `whsec_`)

### Step 3.3: Add to Netlify Environment Variables
1. Go to https://app.netlify.com
2. Select fidgetstreet → Site configuration → Environment variables
3. Click **Add a variable**
4. Add:
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_xxxxx` (your production secret)
5. Click **Create variable**

### Step 3.4: Redeploy Site
Redeploy for the new environment variable to take effect.

---

## PHASE 4: Code Fixes Required

### Fix 4.1: Update Base URL
**File:** `netlify/functions/stripe-checkout.js` (line 101)
```javascript
// Change from:
const baseUrl = process.env.URL || 'https://wicka.co.uk';

// Change to:
const baseUrl = process.env.URL || 'https://fidgetstreet.netlify.app';
```

### Fix 4.2: Update Success Page Email
**File:** `success.html` (line 173)
```html
<!-- Change from: -->
<a href="mailto:wicka@protonmail.com">wicka@protonmail.com</a>

<!-- Change to your actual email: -->
<a href="mailto:hello@fidgetstreet.co.uk">hello@fidgetstreet.co.uk</a>
```

---

## PHASE 5: Testing

### Test Card Numbers (Test Mode Only)
| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (generic) |
| `4000 0025 0000 3155` | Requires 3D Secure |

**For all test cards:** Any future expiry date, any 3-digit CVC, any postcode

### Local Testing Checklist
- [ ] `npx netlify dev` running
- [ ] `stripe listen` running and forwarding
- [ ] Add product to cart
- [ ] Click "Pay with Card"
- [ ] Use test card `4242 4242 4242 4242`
- [ ] Complete checkout
- [ ] Verify redirect to success page
- [ ] Check Supabase `orders` table for new order
- [ ] Check Stripe CLI output shows webhook received

### Production Testing Checklist
- [ ] Deploy to Netlify
- [ ] Test with test card on live site
- [ ] Check Stripe Dashboard → Payments
- [ ] Check Stripe Dashboard → Webhooks → Recent events
- [ ] Check Supabase → orders table

---

## PHASE 6: Go Live Checklist

### Before Accepting Real Payments:
- [ ] Stripe account fully verified (identity + bank)
- [ ] Test mode working completely (local + production)
- [ ] Production webhook configured and tested
- [ ] Switch from test keys to live keys in Netlify:
  - `STRIPE_SECRET_KEY`: `sk_live_xxx`
  - `STRIPE_PUBLISHABLE_KEY`: `pk_live_xxx`
- [ ] Create new webhook for live mode (separate from test)
- [ ] Add live `STRIPE_WEBHOOK_SECRET` to Netlify
- [ ] Test one real £1 purchase yourself
- [ ] Refund your test purchase

### Security Checklist:
- [x] `.env` in `.gitignore` (already done)
- [ ] Secret key NEVER in frontend code
- [ ] Webhook signature verification working
- [ ] Prices verified against database
- [ ] HTTPS only (Netlify handles this)
- [ ] Stripe account has 2FA enabled

---

## Quick Reference Commands

```bash
# Install Stripe CLI
scoop install stripe

# Login to Stripe
stripe login

# Forward webhooks to local dev
stripe listen --forward-to localhost:8888/.netlify/functions/webhooks

# Trigger test webhook
stripe trigger checkout.session.completed

# View recent events
stripe events list --limit 5

# Run local dev server
npx netlify dev

# Deploy to Netlify
npx netlify deploy --prod --site fidgetstreet
```

---

## Files Summary

| File | Status | Action Needed |
|------|--------|---------------|
| `.env` | Exists | Add real `STRIPE_WEBHOOK_SECRET` |
| `.gitignore` | OK | Already excludes `.env` |
| `netlify/functions/stripe-checkout.js` | Needs fix | Update baseUrl |
| `netlify/functions/webhooks.js` | OK | Working |
| `success.html` | Needs fix | Update email |
| Netlify Dashboard | Needs update | Add `STRIPE_WEBHOOK_SECRET` |
