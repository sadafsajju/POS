# Railway GitHub Deployment - Ultra Quick Guide

## 🎯 Your Repository is Ready!

✅ Code pushed to: `https://github.com/sadafsajju/POS`
✅ Railway configuration files committed
✅ Backend supports Railway environment variables

## 🚀 Deploy in 5 Minutes

### 1️⃣ Create Railway Project (2 minutes)

Go to: **https://railway.app/dashboard**

Click: **"New Project"** → **"Deploy from GitHub repo"**

Select: **`sadafsajju/POS`**

Railway will:
- ✅ Clone your repository
- ✅ Detect `railway.json`
- ✅ Build Docker image from `backend/Dockerfile`
- ✅ Start your backend

**Wait for build to complete** (~2-3 minutes)

### 2️⃣ Add Databases (30 seconds)

In the same project:

Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
*(Wait 30 seconds)*

Click **"+ New"** → **"Database"** → **"Add Redis"**
*(Wait 30 seconds)*

### 3️⃣ Set Environment Variables (1 minute)

Click on **backend service** → **"Variables"** tab

Click **"+ New Variable"**:
- **Name:** `JWT_SECRET`
- **Value:** Run this in terminal: `openssl rand -base64 32` and paste output

Click **"+ New Variable"**:
- **Name:** `GIN_MODE`
- **Value:** `release`

Click **"Deploy"** (or wait for auto-redeploy)

### 4️⃣ Get Your API URL (10 seconds)

Click on **backend service** → **"Settings"** tab

Scroll to **"Networking"**

Click **"Generate Domain"**

**Copy the URL** (looks like: `https://pos-backend-production-abc123.up.railway.app`)

### 5️⃣ Run Database Setup (1 minute)

**Easy Option - Railway Web UI:**

1. Click **PostgreSQL service** in your project
2. Click **"Data"** tab
3. Click **"Query"** button
4. Open `database/init/01_schema.sql` in VS Code
5. Copy entire contents → Paste in Railway → **"Run"**
6. Repeat for `02_seed_data.sql`
7. Repeat for `12_aggregator_orders.sql`

**CLI Option (if you prefer):**

```bash
railway login
railway link  # Select your project
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
railway run psql $DATABASE_URL < database/init/12_aggregator_orders.sql
```

### 6️⃣ Test Deployment (30 seconds)

```bash
# Replace with your actual URL
curl https://pos-backend-production-abc123.up.railway.app/health
```

Expected: `{"status":"healthy","message":"POS API is running"}`

```bash
# Test login
curl https://pos-backend-production-abc123.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: JWT token response

### 7️⃣ Update Desktop App (30 seconds)

```bash
cd /Users/admin/Documents/sadaf/Apps/POS

# Create production config (replace URL with yours)
cat > apps/desktop/.env.production << 'EOF'
VITE_API_URL=https://pos-backend-production-abc123.up.railway.app/api/v1
EOF

# Build installer
npm run build:mac
```

**Done! 🎉**

## 🔄 What Happens Next?

Every time you push code to GitHub:

```bash
git add .
git commit -m "New feature"
git push origin main
```

Railway automatically:
1. 🔍 Detects the push
2. 🏗️ Builds new Docker image
3. 🚀 Deploys to production
4. ✅ Runs health check on `/health`
5. 🔄 Switches traffic if successful

**No manual deploys needed!**

## 📊 Monitor Your App

**Logs:** Railway Dashboard → Your Service → "Logs" tab

**Deployments:** Railway Dashboard → Your Service → "Deployments" tab

**Metrics:** Railway Dashboard → Your Service → "Metrics" tab

## 💡 Pro Tips

### Custom Domain (Optional)

Railway Settings → Networking → Custom Domain
Example: `api.myrestaurant.com`

### Multiple Environments

Create `develop` branch in GitHub:
```bash
git checkout -b develop
git push origin develop
```

Railway Dashboard → New Environment → Link to `develop` branch

Now:
- `main` branch → Production
- `develop` branch → Staging

### Rollback if Needed

Railway Dashboard → Deployments → Click previous deployment → "Redeploy"

## ❓ Troubleshooting

### Build Failed
- Check Railway → Deployments → Build Logs
- Verify `railway.json` exists in repo root
- Ensure `backend/Dockerfile` exists

### Can't Connect to Database
- Verify PostgreSQL service is running (green status)
- Check backend logs for connection errors
- DATABASE_URL should be auto-injected (check Variables tab)

### Desktop App Can't Connect
- Verify Railway URL: `curl https://your-url/health`
- Check `.env.production` has correct URL
- Rebuild desktop app after changing env file

## 📞 Need Help?

- Full guide: [GITHUB_DEPLOY.md](GITHUB_DEPLOY.md)
- Commands: [RAILWAY_COMMANDS.md](RAILWAY_COMMANDS.md)
- Railway Docs: https://docs.railway.app

---

## ⚡ Copy-Paste Checklist

```
□ Go to https://railway.app/dashboard
□ New Project → Deploy from GitHub repo → sadafsajju/POS
□ Wait for build to complete
□ + New → Database → PostgreSQL
□ + New → Database → Redis
□ Backend service → Variables → Add JWT_SECRET
□ Backend service → Variables → Add GIN_MODE=release
□ Backend service → Settings → Generate Domain
□ PostgreSQL → Data → Run 01_schema.sql
□ PostgreSQL → Data → Run 02_seed_data.sql
□ PostgreSQL → Data → Run 12_aggregator_orders.sql
□ Test: curl https://your-url/health
□ Create apps/desktop/.env.production with API URL
□ npm run build:mac
□ Done! 🎉
```

**Start here:** https://railway.app/dashboard
