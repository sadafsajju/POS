# Deploy to Railway from GitHub (Recommended)

## ✅ Advantages of GitHub Deployment

- 🔄 **Auto-deploy** on every git push
- 📝 **Deployment history** linked to commits
- 🔙 **Easy rollbacks** to previous versions
- 👥 **Team collaboration** with git workflow
- 🚀 **Zero CLI needed** after initial setup

## 🚀 Step-by-Step Deployment

### Step 1: Go to Railway Dashboard

Open: https://railway.app/dashboard

### Step 2: Create New Project from GitHub

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Authorize Railway to access your GitHub account (if first time)
4. Search for: **`sadafsajju/POS`**
5. Click on your repository to select it

### Step 3: Configure Build Settings

Railway will detect your `railway.json` automatically, but verify:

**Root Directory:** Leave as `/` (root)
**Build Command:** Auto-detected from `railway.json`
**Start Command:** Auto-detected from `railway.json`

Click **"Deploy"**

### Step 4: Add PostgreSQL Database

While your backend is deploying:

1. In the same Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Wait ~30 seconds for deployment

Railway will automatically inject `DATABASE_URL` into your backend service.

### Step 5: Add Redis (Optional)

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Wait for deployment

Railway auto-injects `REDIS_URL`.

### Step 6: Configure Environment Variables

Click on your backend service → **"Variables"** tab:

Add these variables:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | Generate with: `openssl rand -base64 32` |
| `GIN_MODE` | `release` |

Click **"Add Variable"** for each.

**Note:** `DATABASE_URL`, `REDIS_URL`, and `PORT` are auto-injected by Railway.

### Step 7: Generate Public Domain

1. Click on your backend service
2. Go to **"Settings"** tab
3. Scroll to **"Networking"** section
4. Click **"Generate Domain"**

You'll get a URL like: `https://pos-backend-production-xxxx.up.railway.app`

**Copy this URL** - you'll need it later.

### Step 8: Run Database Migrations

Railway doesn't auto-run SQL files, so you need to initialize your schema.

**Option A: Using Railway CLI** (Recommended)

```bash
# Install CLI if you haven't
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
railway run psql $DATABASE_URL < database/init/12_aggregator_orders.sql
```

**Option B: Using Railway Web Interface**

1. Go to Railway dashboard → PostgreSQL service
2. Click **"Data"** tab
3. Click **"Query"** button
4. Copy the contents of `database/init/01_schema.sql`
5. Paste and click **"Run"**
6. Repeat for `02_seed_data.sql` and `12_aggregator_orders.sql`

### Step 9: Verify Deployment

Test your API:

```bash
# Replace with your actual Railway URL
curl https://pos-backend-production-xxxx.up.railway.app/health
```

Expected response:
```json
{"status":"healthy","message":"POS API is running"}
```

Test login:
```bash
curl https://pos-backend-production-xxxx.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Should return a JWT token.

### Step 10: Configure Desktop App for Production

Create production environment file:

```bash
# From project root
cat > apps/desktop/.env.production << EOF
VITE_API_URL=https://pos-backend-production-xxxx.up.railway.app/api/v1
EOF
```

Replace the URL with your actual Railway domain from Step 7.

### Step 11: Build Desktop App

```bash
# Build for Mac
npm run build:mac

# Or build for Windows
npm run build:win
```

Installer will be in: `apps/desktop/src-tauri/target/release/bundle/`

## 🔄 Automatic Deployments

Now every time you push to GitHub, Railway automatically deploys:

```bash
# Make changes
git add .
git commit -m "Update feature"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Builds new Docker image
# 3. Deploys to production
# 4. Runs health checks
# 5. Switches traffic to new version
```

## 📊 Monitor Deployments

### View Deployment Status

Go to Railway dashboard → Your service → **"Deployments"** tab

You'll see:
- ✅ Active deployment
- 🕒 Build logs
- 📈 Deployment history
- 🔙 Rollback options

### View Logs

Click on your service → **"Logs"** tab

Real-time logs from your Go backend.

### Set Up GitHub Branch Deployments (Optional)

Create separate Railway environments for different branches:

1. Go to Railway project → **"Settings"**
2. Scroll to **"Environments"**
3. Click **"New Environment"**
4. Name: `staging`
5. Link to branch: `develop` (create this branch in GitHub)

Now:
- Pushes to `main` → Production deployment
- Pushes to `develop` → Staging deployment

## 🔐 Environment Variables Best Practices

**Never commit these to git:**
- ❌ JWT secrets
- ❌ API keys
- ❌ Database passwords
- ❌ Webhook secrets

**Always set in Railway dashboard:**
- ✅ All variables in "Variables" tab
- ✅ Use Railway's secret management
- ✅ Different values for staging/production

## 🆘 Troubleshooting

### Deployment Failed

**Check Build Logs:**
1. Railway dashboard → Service → "Deployments" tab
2. Click failed deployment
3. View "Build Logs" and "Deploy Logs"

**Common Issues:**
- Missing `railway.json` → Pull latest from GitHub
- Dockerfile not found → Check `railway.json` paths
- Go build errors → Check `backend/main.go` compiles locally

### Service Won't Start

**Check Runtime Logs:**
1. Service → "Logs" tab
2. Look for errors

**Common Issues:**
- Database connection failed → Verify PostgreSQL is added
- `DATABASE_URL` not set → Railway should auto-inject it
- Port binding error → Don't set PORT env var (Railway sets it)

### Desktop App Can't Connect

**Checklist:**
- ✅ Railway domain is accessible: `curl https://your-url/health`
- ✅ `.env.production` exists with correct URL
- ✅ Desktop app rebuilt after updating `.env.production`
- ✅ CORS enabled in backend (already configured)

## 💰 Cost Estimate

**Free Tier:**
- $5 credit/month
- Good for testing

**Production:**
- Backend service: ~$5/month
- PostgreSQL: ~$5/month
- Redis: ~$3/month
- **Total: ~$13/month** (minus $5 free = **$8/month**)

## 🎯 Next Steps After Deployment

1. ✅ **Set up custom domain** (optional)
   - Railway Settings → Networking → Custom Domain

2. ✅ **Configure aggregator webhooks**
   - Use your Railway URL in platform settings
   - Example: `https://your-domain.railway.app/api/v1/webhooks/swiggy/order`

3. ✅ **Enable deployment notifications**
   - Railway Settings → Integrations → Slack/Discord

4. ✅ **Set up monitoring**
   - Railway provides basic metrics
   - Consider adding Sentry for error tracking

5. ✅ **Create staging environment**
   - For testing before production deploys

## 📚 Additional Resources

- Railway Docs: https://docs.railway.app
- Railway Status: https://status.railway.app
- Your Repository: https://github.com/sadafsajju/POS

---

## ⚡ Quick Start Summary

```bash
# Railway Dashboard:
1. New Project → Deploy from GitHub → sadafsajju/POS
2. Add PostgreSQL database
3. Add Redis database
4. Set JWT_SECRET and GIN_MODE variables
5. Generate domain

# Terminal:
railway login
railway link
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
railway run psql $DATABASE_URL < database/init/12_aggregator_orders.sql

# Test:
curl https://your-url.railway.app/health

# Configure desktop app:
echo "VITE_API_URL=https://your-url.railway.app/api/v1" > apps/desktop/.env.production

# Build installer:
npm run build:mac
```

**Done! 🎉**

Future git pushes will auto-deploy to Railway.
