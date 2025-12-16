# Wicka Payment Integration

## Payment Providers

We use **Stripe** and **PayPal** to handle all payments. Both are PCI-compliant and handle sensitive data securely.

---

## Transaction Fees (UK, as of Dec 2025)

### Stripe
| Card Type | Fee |
|-----------|-----|
| Standard UK cards | 1.5% + 20p |
| Premium UK cards | 1.9% + 20p |
| EU cards | 2.5% + 20p |
| International cards | 3.25% + 20p |
| Apple Pay / Google Pay | Same as card rates |

### PayPal
| Payment Type | Fee |
|--------------|-----|
| PayPal balance (UK) | 2.9% + 30p |
| UK debit/credit cards (guest) | 2.9% + 30p |
| EU payments | 3.4% + 30p |
| International | 3.4% + 30p + 2.5% FX |

### Fee Comparison Example (£20 order, UK customer)

| Provider | Payment Method | Fee |
|----------|----------------|-----|
| Stripe | UK card | £0.50 (1.5% + 20p) |
| PayPal | PayPal balance | £0.88 (2.9% + 30p) |
| PayPal | Guest card | £0.88 (2.9% + 30p) |

**Recommendation:** Stripe is cheaper for all card payments. PayPal is valuable for customers who specifically prefer using their PayPal balance. Consider disabling PayPal guest card checkout (see below) since Stripe handles cards at lower cost.

---

## Disabling PayPal Guest Card Payments

Since Stripe handles card payments at a lower cost (1.5% vs 2.9%), you may want to disable guest card payments in PayPal so customers with cards use Stripe instead.

### Option 1: SDK Parameter (Recommended)

In `cart.html`, modify the PayPal SDK script tag:

```html
<!-- Before -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=GBP"></script>

<!-- After - disables card funding -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID&currency=GBP&disable-funding=card"></script>
```

### Option 2: PayPal Account Settings

1. Log into PayPal.com
2. Go to Settings → Account Settings → Website Payments → Website Preferences
3. Find "PayPal Account Optional" and toggle it **OFF**

With either option, customers clicking PayPal will need to log in with their PayPal account. Non-PayPal customers will use the Stripe "Pay with Card" button instead.

---

## Getting Money to Your Bank Account

### Stripe Payouts

Stripe automatically transfers your balance to your bank account on a rolling basis.

| Setting | Details |
|---------|---------|
| **Default schedule** | Daily (2 business day rolling) |
| **Minimum payout** | £1.00 |
| **Payout fee** | FREE |
| **First payout** | 7-14 days (new accounts) |
| **Instant payouts** | 1% fee (minimum 50p) |

**How to set up:**
1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to Settings → Payouts
3. Add your UK bank account (sort code + account number)
4. Choose payout schedule (daily, weekly, or monthly)

### PayPal Withdrawals

PayPal doesn't automatically transfer - you must manually withdraw or set up auto-withdraw.

| Setting | Details |
|---------|---------|
| **Manual withdrawal** | FREE to UK bank |
| **Auto-withdraw** | Available (set threshold) |
| **Minimum withdrawal** | £1.00 |
| **Processing time** | 1-3 business days |
| **Instant transfer** | Up to 1.5% fee |

**How to set up auto-withdraw:**
1. Log into [PayPal](https://www.paypal.com)
2. Go to Settings → Money, banks and cards
3. Link your UK bank account
4. Enable "Transfer money automatically" and set threshold

---

## How Shipping Address is Collected

We do NOT collect shipping address on our cart page. Both providers collect it on their secure checkout pages:

### Stripe Checkout
1. Customer clicks "Pay with Card"
2. Redirected to Stripe's hosted checkout page
3. Stripe collects: email, shipping address, card details
4. On successful payment, Stripe sends address via webhook to our `/api/webhooks` endpoint
5. We store the order with shipping details in our database

### PayPal Checkout
1. Customer clicks "Pay with PayPal"
2. PayPal popup opens (or redirect)
3. Customer logs in and uses their saved PayPal address
4. On approval, we capture payment and receive shipping address in the response
5. We store the order with shipping details in our database

---

## Data Flow

```
Customer clicks "Pay with Card" (Stripe)
    │
    ▼
Redirect to Stripe Checkout
    │
    ▼
Customer enters: Email, Shipping Address, Card
    │
    ▼
Payment successful
    │
    ├──► Redirect to /success.html?session_id=xxx
    │
    └──► Webhook POST to /api/webhooks
              │
              ▼
         Create order in database with:
         - Customer email
         - Shipping address
         - Order items
         - Payment status
              │
              ▼
         Money appears in Stripe balance
              │
              ▼ (daily payout)
         Money in your bank account
```

```
Customer clicks "Pay with PayPal"
    │
    ▼
PayPal popup/redirect
    │
    ▼
Customer logs in (PayPal account required if guest disabled)
    │
    ▼
Customer approves payment
    │
    ▼
Our code calls /api/paypal-capture
    │
    ▼
Create order in database with:
- Customer email
- Shipping address (from PayPal response)
- Order items
- Payment status
    │
    ▼
Money appears in PayPal balance
    │
    ▼ (manual or auto-withdraw)
Money in your bank account
```

---

## Additional Payment Methods (via Stripe)

These are automatically available through Stripe Checkout at no extra integration cost:

- **Apple Pay** - For Safari/iOS users
- **Google Pay** - For Chrome/Android users
- **Link** - Stripe's one-click checkout for returning customers

### Future Options (can enable in Stripe Dashboard)
- Klarna (buy now, pay later)
- Afterpay/Clearpay
- iDEAL (Netherlands)
- Bancontact (Belgium)
- SEPA Direct Debit (EU)

---

## Environment Variables Required

```env
# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_SANDBOX=false  # Set to true for testing
```

---

## Testing

### Stripe Test Cards
- Success: `4242 4242 4242 4242`
- Declined: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

### PayPal Sandbox
- Use sandbox credentials and sandbox buyer accounts
- Create test accounts at developer.paypal.com

---

## Security Notes

1. **No card data touches our servers** - All handled by Stripe/PayPal
2. **PCI Compliance** - Achieved by using hosted checkout pages
3. **Webhook verification** - All webhooks are verified with signatures
4. **HTTPS only** - All payment pages require HTTPS

---

## Order Fulfillment

After payment:
1. Order created in database with status "paid"
2. Admin notified (can add email notification)
3. Order appears in Admin > Orders
4. Admin updates status: paid → processing → shipped → delivered
5. Customer can check order status on /success.html with order number

---

## Fee Sources

- [Stripe UK Pricing](https://stripe.com/pricing)
- [PayPal UK Business Fees](https://www.paypal.com/uk/business/paypal-business-fees)
