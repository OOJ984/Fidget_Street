# Wicka Troubleshooting Guide

## Common Issues and Solutions

---

## Logo/Favicon Not Updating

### Symptom
After uploading a new logo or favicon in the admin panel, the website reverts to the old logo after a few minutes.

### Root Cause
There were two layers of caching causing this issue:

1. **API Response Caching** (`netlify/functions/settings.js`)
   - The `/api/settings` endpoint was caching responses for 5 minutes
   - Fixed by setting `Cache-Control: no-cache, no-store, must-revalidate`

2. **Frontend localStorage Caching** (`scripts/settings.js`)
   - The frontend JavaScript was caching settings in localStorage for 5 minutes
   - If the cache was "fresh", it would skip the API call entirely
   - Fixed by setting `CACHE_MAX_AGE = 0` to always fetch fresh settings

### Solution (Already Applied)
Both caching layers have been disabled for settings. Changes to logo/favicon/colors should now appear immediately.

### If Issue Persists
1. Clear your browser's localStorage:
   - Open DevTools (F12) → Application → Local Storage
   - Delete `wicka_website_settings` and `wicka_website_settings_ts`
2. Hard refresh the page (Ctrl+Shift+R)
3. Clear Netlify's CDN cache from the Netlify dashboard

---

## Netlify Build Failures

### "Secrets scanning found secrets in build"

The Netlify secrets scanner detected values that match your environment variable secrets in your code files.

**Common Causes:**
- Documentation files with placeholder values that match Stripe/Supabase secret formats
- These prefixes match real Stripe/Supabase credential formats

**Solution:**
Use descriptive placeholder values that don't match real secret formats:
```env
# Bad (matches real secret prefix)
STRIPE_WEBHOOK_SECRET=<webhook-secret-here>

# Good (clearly a placeholder)
STRIPE_WEBHOOK_SECRET=your_webhook_secret_here
```

**Alternative:**
Add to Netlify environment variables:
- `SECRETS_SCAN_OMIT_KEYS=STRIPE_WEBHOOK_SECRET` - Excludes specific keys
- `SECRETS_SCAN_OMIT_PATHS=docs/,fromscratch/` - Excludes specific paths

---

## Admin Panel Issues

### Can't Upload Images

**Check:**
1. Supabase Storage bucket `product-images` exists and is public
2. Storage policies allow service role uploads
3. `SUPABASE_SERVICE_KEY` is set in Netlify environment variables

### Admin Login Not Working

**Check:**
1. Admin user exists in `admin_users` table
2. Password is bcrypt hashed (starts with `$2a$` or `$2b$`)
3. `JWT_SECRET` environment variable is set

---

## Payment Issues

### Stripe Checkout Not Redirecting

**Check:**
1. `STRIPE_PUBLISHABLE_KEY` is set (for frontend)
2. `STRIPE_SECRET_KEY` is set (for backend)
3. Stripe account is activated (not in test mode if using live keys)

### PayPal Not Working

**Check:**
1. `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set
2. `PAYPAL_SANDBOX` is `false` for production
3. PayPal account has proper permissions enabled

---

## Database Connection Issues

### "relation does not exist" Errors

The database tables haven't been created. Run the schema script:
1. Go to Supabase SQL Editor
2. Run the contents of `supabase/schema.sql`

### Row Level Security (RLS) Errors

If you see "new row violates row-level security policy":
1. Make sure you're using the `SUPABASE_SERVICE_KEY` (not anon key) for write operations
2. Check that RLS policies are correctly set up in Supabase

---

## Performance Issues

### Slow Page Loads

**Check:**
1. Images are optimized (use WebP format)
2. Tailwind CSS is built with `--minify` flag
3. No large JavaScript bundles

### API Timeouts

Netlify functions have a 10-second timeout. If operations take longer:
1. Optimize database queries
2. Add pagination for large data sets
3. Consider background processing for long tasks
