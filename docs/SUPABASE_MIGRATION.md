# Supabase Migration Guide

Complete guide for migrating Wicka to a new Supabase account.

## Step 1: Create New Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for it to be ready (~2 minutes)
4. Note down these values from **Settings > API**:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: (copy from dashboard)
   - **service_role secret key**: (copy from dashboard - keep this secret!)

---

## Step 2: Run Database Setup SQL

Go to **SQL Editor** in your new Supabase project and run the complete script from `supabase/schema.sql`.

---

## Step 3: Create Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Click **New Bucket**
3. Create bucket with these settings:
   - **Name**: `product-images`
   - **Public**: Yes (toggle ON)
4. Click on the bucket, then go to **Policies**
5. Add these policies:

**Policy 1 - Public Read:**
- Policy name: `Public can view images`
- Allowed operation: `SELECT`
- Target roles: (leave empty for public)
- Policy: `true`

**Policy 2 - Service Role Upload:**
- Policy name: `Service role can upload`
- Allowed operation: `INSERT`
- Policy: `auth.role() = 'service_role'`

**Policy 3 - Service Role Delete:**
- Policy name: `Service role can delete`
- Allowed operation: `DELETE`
- Policy: `auth.role() = 'service_role'`

---

## Step 4: Update Environment Variables

### Local Development (.env file)

Update your `.env` file with the new Supabase credentials:

```env
# Supabase - UPDATE THESE
SUPABASE_URL=https://YOUR_NEW_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_new_anon_key_here
SUPABASE_SERVICE_KEY=your_new_service_key_here

# Keep these the same (or update if changing)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_SANDBOX=true
JWT_SECRET=your_secure_random_string_here
```

### Netlify Dashboard

1. Go to your Netlify site dashboard
2. **Site configuration** > **Environment variables**
3. Update these variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

---

## Step 5: Test the Migration

The code now fetches Supabase config from the `/api/supabase-config` endpoint, so no hardcoded URLs need updating.

1. Restart your local dev server: `npx netlify dev`
2. Test these endpoints:
   - Visit http://localhost:8888 - homepage should load
   - Visit http://localhost:8888/admin - should show login
   - Login with `admin@wicka.co.uk` / `password`
   - **IMMEDIATELY** go to admin settings and change password!

---

## Step 6: Deploy to Production

1. Commit your changes:
```bash
git add .
git commit -m "Migrate to new Supabase project"
git push
```

2. Netlify will auto-deploy (if connected)
3. Verify environment variables are set in Netlify dashboard

---

## Migration Checklist

| Task | Status |
|------|--------|
| Create new Supabase project | ⬜ |
| Run SQL schema script | ⬜ |
| Create storage bucket `product-images` | ⬜ |
| Set storage bucket policies | ⬜ |
| Update `.env` file | ⬜ |
| Update Netlify environment variables | ⬜ |
| Test local dev server | ⬜ |
| Change admin password | ⬜ |
| Deploy to production | ⬜ |
| Test production site | ⬜ |

---

## Rollback (if needed)

If something goes wrong, you can switch back by:
1. Reverting the `.env` file to old values
2. Updating Netlify environment variables back to old values
