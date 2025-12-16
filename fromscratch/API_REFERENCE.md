# Wicka API Reference

Base URL: `/api/` (maps to `/.netlify/functions/`)

## Public Endpoints

### Products

#### GET /api/products
List all active products.

**Query Parameters:**
- `slug` - Get single product by slug
- `category` - Filter by category (crystal-organisers, charm-organisers, holders)
- `tag` - Filter by tag
- `featured` - Set to "true" for featured products only

**Response (list):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Crystal Drop organisers",
      "slug": "crystal-drop-organisers",
      "price_gbp": 12.99,
      "category": "crystal-organisers",
      "tags": ["featured", "bestseller"],
      "images": ["https://..."],
      "stock": 25
    }
  ]
}
```

**Response (single - with slug):**
```json
{
  "id": 1,
  "title": "Crystal Drop organisers",
  "slug": "crystal-drop-organisers",
  "price_gbp": 12.99,
  "category": "crystal-organisers",
  "materials": ["Swarovski crystals", "Sterling silver"],
  "dimensions": "3cm drop",
  "variations": ["Gold", "Silver", "Rose Gold"],
  "stock": 25,
  "tags": ["featured"],
  "description": "Beautiful crystal organisers...",
  "images": ["https://..."],
  "variation_images": {
    "Gold": ["https://..."],
    "Silver": ["https://..."]
  }
}
```

---

### Settings

#### GET /api/settings
Get public website settings.

**Response:**
```json
{
  "companyName": "Wicka",
  "tagline": "Style Meets Purpose",
  "primaryColor": "#C4707A",
  "secondaryColor": "#1a1a1a",
  "freeShippingThreshold": 20,
  "shippingCost": 2.99,
  "contactEmail": "hello@wicka.co.uk",
  "socialInstagram": "@wicka"
}
```

---

### Health Check

#### GET /api/health
Check API and database status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "api": { "status": "healthy" },
    "database": { "status": "healthy", "latency_ms": 45 }
  }
}
```

---

## Payment Endpoints

### Stripe

#### POST /api/stripe-checkout
Create Stripe checkout session.

**Request:**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Crystal organisers",
      "price": 12.99,
      "quantity": 2,
      "variation": "Gold"
    }
  ],
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "sessionId": "cs_live_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

### PayPal

#### POST /api/paypal-checkout
Create PayPal order.

**Request:**
```json
{
  "items": [
    {
      "id": 1,
      "title": "Crystal organisers",
      "price": 12.99,
      "quantity": 2
    }
  ],
  "customer_email": "customer@example.com"
}
```

**Response:**
```json
{
  "orderID": "5O190127TN364715T",
  "status": "CREATED"
}
```

#### POST /api/paypal-capture
Capture PayPal payment after approval.

**Request:**
```json
{
  "orderID": "5O190127TN364715T",
  "items": [...],
  "customer": {
    "email": "customer@example.com",
    "name": "Jane Doe",
    "phone": "07123456789"
  }
}
```

**Response:**
```json
{
  "success": true,
  "orderNumber": "PP-20250115-1234"
}
```

---

### Webhooks

#### POST /api/webhooks
Stripe webhook handler (signature verified).

**Handled Events:**
- `payment_intent.succeeded` - Creates order
- `payment_intent.payment_failed` - Logs failure
- `checkout.session.completed` - Backup order creation

---

## Order Endpoints

### POST /api/orders
Create order (internal use, usually via webhooks).

**Request:**
```json
{
  "customer_email": "customer@example.com",
  "customer_name": "Jane Doe",
  "customer_phone": "07123456789",
  "shipping_address": {
    "line1": "123 High Street",
    "city": "London",
    "postal_code": "SW1A 1AA",
    "country": "GB"
  },
  "items": [...],
  "subtotal": 25.98,
  "shipping": 0,
  "total": 25.98,
  "payment_method": "stripe",
  "payment_id": "pi_..."
}
```

---

## Customer Endpoints

### POST /api/customer-auth
Request magic link or verify token.

**Request (request link):**
```json
{
  "action": "request",
  "email": "customer@example.com"
}
```

**Request (verify token):**
```json
{
  "action": "verify",
  "token": "abc123..."
}
```

**Response (verify):**
```json
{
  "success": true,
  "token": "session_token_here",
  "email": "customer@example.com"
}
```

---

### GET /api/customer-orders
Get customer's orders (requires session token).

**Headers:**
```
Authorization: Bearer <session_token>
```

**Query Parameters:**
- `id` - Get single order by ID

**Response:**
```json
{
  "orders": [
    {
      "id": 1,
      "order_number": "PP-20250115-1234",
      "status": "shipped",
      "total": 25.98,
      "item_count": 2,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### GET /api/customer-data
Export customer data (GDPR).

**Headers:**
```
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "export_date": "2025-01-15T10:00:00Z",
  "customer": {
    "email": "customer@example.com"
  },
  "orders": [...],
  "data_retention": {
    "policy": "Orders retained for 7 years for legal compliance"
  }
}
```

---

## Admin Endpoints

All admin endpoints require:
```
Authorization: Bearer <jwt_token>
```

### POST /api/admin-auth
Admin login.

**Request:**
```json
{
  "email": "admin@wicka.co.uk",
  "password": "...",
  "mfa_code": "123456"
}
```

**Response:**
```json
{
  "token": "eyJ...",
  "user": {
    "id": 1,
    "email": "admin@wicka.co.uk",
    "name": "Admin",
    "role": "website_admin"
  },
  "requiresMfa": false
}
```

---

### Admin Products

#### GET /api/admin-products
List all products (including inactive).

#### POST /api/admin-products
Create product.

#### PUT /api/admin-products
Update product.

**Request:**
```json
{
  "id": 1,
  "title": "Updated Title",
  "price_gbp": 14.99,
  "stock": 30
}
```

#### DELETE /api/admin-products
Delete product.

**Request:**
```json
{
  "id": 1
}
```

---

### Admin Orders

#### GET /api/admin-orders
List orders.

**Query Parameters:**
- `status` - Filter by status
- `limit` - Limit results

#### PUT /api/admin-orders
Update order status.

**Request:**
```json
{
  "id": 1,
  "status": "shipped",
  "notes": "Tracking: ABC123"
}
```

---

### Admin Users

#### GET /api/admin-users
List admin users (website_admin only).

#### POST /api/admin-users
Create user.

#### PUT /api/admin-users
Update user.

#### DELETE /api/admin-users
Delete user.

---

### Admin Settings

#### GET /api/admin-settings
Get all settings.

#### PUT /api/admin-settings
Update settings.

---

### Admin Media

#### GET /api/admin-media
List uploaded files.

#### POST /api/admin-media
Upload file (multipart/form-data).

#### DELETE /api/admin-media
Delete file.

---

### Admin Audit

#### GET /api/admin-audit
Get audit logs (website_admin only).

**Query Parameters:**
- `limit` - Number of entries (default 100)
- `action` - Filter by action type
- `user_id` - Filter by user

---

### Admin MFA

#### POST /api/admin-mfa

**Actions:**
- `setup` - Generate new TOTP secret
- `verify` - Verify and enable MFA
- `disable` - Disable MFA (website_admin only)

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

**Status Codes:**
- `400` - Bad request / validation error
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `405` - Method not allowed
- `429` - Rate limited
- `500` - Server error

---

## Rate Limiting

- Login: 5 attempts per email per 15 minutes
- Login: 20 attempts per IP per hour
- General API: No limits (stateless)

**Rate Limited Response:**
```json
{
  "error": "Too many attempts. Please try again later.",
  "retryAfter": 900
}
```

Headers:
```
Retry-After: 900
```
