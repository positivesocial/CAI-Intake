# CAI Intake Deployment Guide

<p align="center">
  <strong>Deployment & Infrastructure Guide v2.0</strong><br>
  <em>Last Updated: January 2025</em>
</p>

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Vercel Deployment](#vercel-deployment)
4. [Supabase Setup](#supabase-setup)
5. [Stripe Setup](#stripe-setup)
6. [OCR Service Setup](#ocr-service-setup)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- Node.js 20+ installed locally
- A Vercel account (for hosting)
- A Supabase project (for database and auth)
- A Stripe account (for payments)
- An OpenAI API key (for AI parsing)
- OCR service deployed (optional, for document scanning)

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma connection string | `postgresql://user:pass@host:5432/db?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Direct DB connection (for migrations) | `postgresql://user:pass@host:5432/db` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |

### AI & Parsing

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key (primary AI) | `sk-ant-...` |
| `OPENAI_API_KEY` | OpenAI API key (fallback AI) | `sk-...` |
| `PYTHON_OCR_SERVICE_URL` | URL of Python OCR service | `https://cabinetai-ocr.onrender.com` |

### Payments (Stripe)

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

### Application

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `https://app.cai-intake.io` |
| `CRON_SECRET` | Secret for cron job authentication | `your-random-secret` |
| `NODE_ENV` | Environment mode | `production` |

### Optional

| Variable | Description | Example |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry error tracking | `https://xxx@sentry.io/xxx` |
| `AXIOM_TOKEN` | Axiom logging token | `xaat-...` |
| `RESEND_API_KEY` | Email service API key | `re_...` |

---

## Vercel Deployment

### Option 1: Deploy from GitHub

1. **Connect Repository**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Select the `main` branch

2. **Configure Project**
   - Framework Preset: Next.js
   - Root Directory: `/`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables**
   - Add all required variables from the list above
   - Mark sensitive values appropriately

4. **Deploy**
   - Click Deploy
   - Wait for build to complete

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod

# Add environment variables
vercel env add DATABASE_URL production
```

### Custom Domain

1. Go to Project Settings > Domains
2. Add your domain (e.g., `app.cai-intake.io`)
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and keys

### 2. Database Setup

```bash
# Run migrations
npm run db:push

# Or use Supabase CLI
supabase db push
```

### 3. Storage Buckets

Create the following buckets in Supabase Storage:

```sql
-- Run in SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('cutlist-files', 'cutlist-files', false),
  ('org-branding', 'org-branding', true);
```

### 4. Row Level Security

Ensure RLS is enabled on all tables:

```sql
-- Enable RLS
ALTER TABLE cutlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cut_parts ENABLE ROW LEVEL SECURITY;
-- ... (repeat for all tables)
```

### 5. Auth Configuration

1. Go to Authentication > Providers
2. Enable Email provider
3. Configure redirect URLs:
   - `https://app.cai-intake.io/auth/callback`
   - `https://app.cai-intake.io/auth/verify`

---

## Stripe Setup

### 1. Create Products

Create products and prices in Stripe Dashboard:

```
Products:
- CAI Intake Free      → $0/month
- CAI Intake Starter   → $29/month, $290/year
- CAI Intake Pro       → $79/month, $790/year
- CAI Intake Enterprise → Custom
```

### 2. Configure Webhook

1. Go to Developers > Webhooks
2. Add endpoint: `https://app.cai-intake.io/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

### 3. Enable PayPal

1. Go to Settings > Payment Methods
2. Enable PayPal
3. Connect your PayPal business account

### 4. Customer Portal

1. Go to Settings > Billing > Customer Portal
2. Configure portal settings
3. Enable invoice history, payment method updates

---

## OCR Service Setup

### Option 1: Deploy on Railway

```bash
# Clone the OCR service
git clone https://github.com/your-org/cai-ocr-service
cd cai-ocr-service

# Deploy to Railway
railway init
railway up
```

### Option 2: Docker

```bash
docker run -d \
  -p 8000:8000 \
  --name cai-ocr \
  caiintake/ocr-service:latest
```

### Option 3: Cloud Run

```bash
gcloud run deploy cai-ocr \
  --image gcr.io/your-project/cai-ocr \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Post-Deployment

### 1. Create Super Admin

```sql
-- Run in Supabase SQL Editor
UPDATE users 
SET is_super_admin = true 
WHERE email = 'admin@yourdomain.com';
```

### 2. Seed Initial Data

```bash
# Run seed script
npm run db:seed
```

### 3. Configure Cron Jobs

Verify cron is working:

```bash
# Test cleanup endpoint
curl -X GET https://app.cai-intake.io/api/cron/cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Set Up Monitoring

1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Add Sentry DSN
3. **Logging**: Configure Axiom or similar

### 5. Test Payments

1. Use Stripe test mode first
2. Complete a test purchase
3. Verify webhook handling
4. Switch to live mode when ready

---

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection Issues

1. Verify connection strings
2. Check IP allowlist in Supabase
3. Use connection pooling for serverless

### Stripe Webhook Errors

1. Verify webhook secret
2. Check endpoint URL
3. Review webhook logs in Stripe Dashboard

### OCR Service Issues

1. Check service health endpoint
2. Verify network connectivity
3. Check memory/CPU limits

### Common Errors

| Error | Solution |
|-------|----------|
| `NEXT_PUBLIC_* not found` | Add to Vercel env vars |
| `Database connection refused` | Check DATABASE_URL |
| `Stripe webhook failed` | Verify webhook secret |
| `OCR timeout` | Increase function timeout |

---

## Maintenance

### Database Backups

Supabase provides automatic daily backups. For additional safety:

```bash
# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Updates

```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### Scaling

For high traffic:

1. Upgrade Vercel plan for more functions
2. Upgrade Supabase plan for more connections
3. Consider edge deployment
4. Add CDN for static assets

---

*Last updated: December 2025*

