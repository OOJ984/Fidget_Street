# Stripe Payment Methods - UK Recommendations for Fidget Street

Based on research into Stripe fees for UK merchants (December 2025).

---

## Enable (Low Fees)

| Payment Method | Fee | Notes |
|----------------|-----|-------|
| **UK Debit/Credit Cards** | 1.5% + 20p | Lowest standard rate |
| **Link** (one-click checkout) | Same as cards | No extra fee - uses card rate |
| **Apple Pay** | Same as cards | No extra fee - uses underlying card rate |
| **Google Pay** | Same as cards | No extra fee - uses underlying card rate |
| **Samsung Pay** | Same as cards | No extra fee - treated as contactless card payment |
| **Amazon Pay** | Same as cards | No additional Amazon fees beyond card rate |
| **Revolut Pay** | **0.8% + 2p** | Cheapest option! Lower than cards |

---

## Consider Carefully (Higher Fees)

| Payment Method | Fee | Notes |
|----------------|-----|-------|
| **Klarna** | **4.99% + 35p** | Very high! Only enable if you need BNPL |
| **EEA Cards** | 2.5% + 20p | Higher than UK cards |
| **International Cards** | 3.25% + 20p | Highest card rate |
| **PayPal** | ~2.9% + 30p | Higher than Stripe cards, separate integration needed |

---

## Avoid / Don't Need (For UK-focused business)

| Payment Method | Fee | Reason |
|----------------|-----|--------|
| **Afterpay/Clearpay** | ~5% | Similar high fees to Klarna, overlap |
| **Bancontact** | 1.5% + method fee | Belgium-only, +1.5% Brexit surcharge |
| **EPS** | 1.5% + method fee | Austria-only, +1.5% Brexit surcharge |
| **SEPA Direct Debit** | 1.5% | EU-focused, +1.5% Brexit surcharge |
| **iDEAL** | 1.5% + method fee | Netherlands-only, +1.5% Brexit surcharge |
| **Kakao Pay** | Unknown | South Korea only - no UK customer base |
| **Naver Pay** | Unknown | South Korea only - no UK customer base |
| **PayCo** | Unknown | South Korea only - no UK customer base |

### Important: Post-Brexit EU Payment Surcharge

Since June 2024, UK businesses are charged an additional **1.5% international transaction fee** when customers pay with European bank-based methods (Bancontact, EPS, SEPA, iDEAL, Giropay, Sofort, etc.). This makes them uneconomical for UK merchants unless you specifically target those markets.

---

## Full Payment Method Analysis

### Wallet Payment Methods (No Extra Fees)

| Method | Recommendation | Notes |
|--------|---------------|-------|
| **Apple Pay** | ✅ Enable | Uses card rate, popular with iPhone users |
| **Google Pay** | ✅ Enable | Uses card rate, popular with Android users |
| **Samsung Pay** | ✅ Enable | Uses card rate, contactless payment |
| **Amazon Pay** | ✅ Enable | Uses card rate, no A-to-z claim fees |
| **Revolut Pay** | ✅ Enable | **Cheapest at 0.8% + 2p**, growing UK user base |
| **Link** | ✅ Enable | Stripe's one-click checkout, uses card rate |

### Buy Now Pay Later (BNPL)

| Method | Recommendation | Notes |
|--------|---------------|-------|
| **Klarna** | ❓ Maybe | 4.99% + 35p - only if high AOV or conversion issues |
| **Afterpay/Clearpay** | ❌ Skip | Similar fees to Klarna, redundant |

### Regional Methods (Skip for UK focus)

| Method | Recommendation | Notes |
|--------|---------------|-------|
| **Bancontact** | ❌ Skip | Belgium only + 1.5% Brexit fee |
| **EPS** | ❌ Skip | Austria only + 1.5% Brexit fee |
| **Kakao Pay** | ❌ Skip | South Korea only |
| **Naver Pay** | ❌ Skip | South Korea only |
| **PayCo** | ❌ Skip | South Korea only |

### PayPal (Separate from Stripe)

| Aspect | Details |
|--------|---------|
| **Fee** | ~2.9% + 30p (higher than Stripe cards) |
| **Recommendation** | ❓ Optional - offer via separate integration |
| **Pros** | Some customers prefer PayPal, buyer protection perception |
| **Cons** | Higher fees, complex fee structure, separate dashboard |

---

## Recommended Dashboard Settings

**In Stripe Dashboard → Settings → Payment Methods:**

### Enable These:
1. **Cards** → ✅ Enabled
2. **Link** → ✅ Enabled
3. **Apple Pay** → ✅ Enabled
4. **Google Pay** → ✅ Enabled
5. **Samsung Pay** → ✅ Enabled
6. **Amazon Pay** → ✅ Enabled
7. **Revolut Pay** → ✅ Enabled (cheapest option!)

### Disable These:
- **Klarna** → ❌ Disabled (unless needed)
- **Afterpay/Clearpay** → ❌ Disabled
- **Bancontact** → ❌ Disabled
- **EPS** → ❌ Disabled
- **All Korean methods** → ❌ Disabled
- **All EU bank methods** → ❌ Disabled

---

## Cost Comparison Example (£20 fidget toy order)

| Method | Fee Calculation | You Receive | vs UK Card |
|--------|----------------|-------------|------------|
| **Revolut Pay** | 0.8% + 2p = 18p | **£19.82** | Save 32p |
| UK Card | 1.5% + 20p = 50p | **£19.50** | Baseline |
| Apple/Google/Samsung Pay | 1.5% + 20p = 50p | **£19.50** | Same |
| Amazon Pay | 1.5% + 20p = 50p | **£19.50** | Same |
| PayPal | 2.9% + 30p = 88p | **£19.12** | Lose 38p |
| Klarna | 4.99% + 35p = £1.35 | **£18.65** | Lose 85p |
| Bancontact/EPS | ~3%+ with Brexit fee | ~£19.00 | Lose 50p+ |

---

## Final Recommendation for Fidget Street

For mostly UK customers buying lower-value fidget toys:

```
ENABLE (in Stripe):
  - Cards
  - Link
  - Apple Pay
  - Google Pay
  - Samsung Pay
  - Amazon Pay
  - Revolut Pay  ← Cheapest option!

DISABLE (in Stripe):
  - Klarna
  - Afterpay/Clearpay
  - Bancontact
  - EPS
  - All Korean methods (Kakao, Naver, PayCo)
  - All EU bank methods

SEPARATE (not in Stripe):
  - PayPal (optional, via separate integration if customers request)
```

### Priority Order by Fee Efficiency:
1. **Revolut Pay** - 0.8% + 2p (best!)
2. **Cards/Wallets** - 1.5% + 20p (standard)
3. **PayPal** - 2.9% + 30p (if needed)
4. **BNPL** - ~5% (avoid unless necessary)

---

## Production Setup Checklist

Before going live, complete these steps:

### 1. Stripe Dashboard Configuration
- [ ] Switch from Test Mode to Live Mode in Stripe Dashboard
- [ ] Get Live API keys from https://dashboard.stripe.com/apikeys
- [ ] Update Netlify environment variables:
  - `STRIPE_SECRET_KEY` → Live secret key (`sk_live_...`)
  - `STRIPE_PUBLISHABLE_KEY` → Live publishable key (`pk_live_...`)
- [ ] Configure payment methods at https://dashboard.stripe.com/settings/payment_methods
- [ ] Set up branding at https://dashboard.stripe.com/settings/branding

### 2. Webhook Configuration (Production)
- [ ] Create production webhook at https://dashboard.stripe.com/webhooks
- [ ] Set endpoint URL: `https://fidgetstreet.co.uk/.netlify/functions/webhooks`
- [ ] Select events to listen for:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- [ ] Copy webhook signing secret
- [ ] Update `STRIPE_WEBHOOK_SECRET` in Netlify environment variables

### 3. Checkout Settings
- [ ] Review checkout session configuration in `netlify/functions/stripe-checkout.js`
- [ ] Update `baseUrl` from `wicka.co.uk` to `fidgetstreet.co.uk`
- [ ] Verify shipping countries list (currently GB only)
- [ ] Configure shipping rates if needed

### 4. Business Verification
- [ ] Complete Stripe account verification
- [ ] Add business details and bank account
- [ ] Set payout schedule

### 5. Final Testing
- [ ] Test one real transaction with small amount
- [ ] Verify order appears in Supabase
- [ ] Verify order appears in admin panel
- [ ] Test refund process

---

## Test Plan (Non-Production / Test Mode)

### Test Cards
Use these Stripe test card numbers:

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 3220` | 3D Secure authentication required |
| `4000 0000 0000 9995` | Payment declined |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Requires authentication |

**For all test cards:** Use any future expiry date, any 3-digit CVC, any postcode.

### Test Scenarios

#### Scenario 1: Successful Checkout
1. Add item(s) to cart
2. Click Checkout
3. Enter test card `4242 4242 4242 4242`
4. Complete shipping address
5. Submit payment
6. **Expected:**
   - Redirect to success page with order number (FS-XXXXXXXX-XXXX)
   - Order created in Supabase with status "paid"
   - Shipping address captured correctly
   - Order visible in admin panel

#### Scenario 2: Failed Payment
1. Add item(s) to cart
2. Click Checkout
3. Enter test card `4000 0000 0000 9995`
4. Complete form and submit
5. **Expected:**
   - Error message displayed
   - No order created
   - User can retry with different card

#### Scenario 3: 3D Secure Authentication
1. Add item(s) to cart
2. Click Checkout
3. Enter test card `4000 0000 0000 3220`
4. Complete 3D Secure popup (click "Complete")
5. **Expected:**
   - Payment succeeds after authentication
   - Order created normally

#### Scenario 4: Webhook Processing
1. Complete successful checkout
2. Check Netlify dev console for webhook logs
3. **Expected:**
   - `checkout.session.completed` event received
   - 200 response returned
   - Order created in database

#### Scenario 5: Admin Order View
1. Complete successful checkout
2. Login to admin panel
3. Go to Orders
4. Click "View" on the order
5. **Expected:**
   - Full customer details visible
   - Shipping address displayed
   - Order items listed
   - Totals correct

### Webhook Testing with Stripe CLI

```bash
# Start webhook forwarding
stripe listen --forward-to localhost:8888/.netlify/functions/webhooks

# In another terminal, trigger test events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

### Checklist Before Each Test Session

- [ ] Netlify dev server running (`npx netlify dev`)
- [ ] Stripe CLI webhook forwarding running
- [ ] `.env` has correct test keys
- [ ] Browser dev tools open (Network tab)
- [ ] Supabase dashboard open to orders table

---

## Sources

- [Stripe UK Pricing](https://stripe.com/gb/pricing)
- [Stripe Local Payment Methods Pricing](https://stripe.com/pricing/local-payment-methods)
- [Amazon Pay on Stripe](https://pay.amazon.co.uk/integration/stripe)
- [Revolut Pay on Stripe](https://docs.stripe.com/payments/revolut-pay)
- [June 2024 Brexit Pricing Update](https://support.stripe.com/questions/june-2024-pricing-update-for-european-bank-based-payment-methods-for-uk-businesses)
- [Stripe vs PayPal UK Comparison](https://tipalti.com/en-uk/resources/learn/stripe-vs-paypal/)
- [Merchant Savvy - Stripe Review 2025](https://www.merchantsavvy.co.uk/payment-processors/stripe-payments/)
- [Noda - Stripe Fees Explained](https://noda.live/articles/stripe-fees-explained)
