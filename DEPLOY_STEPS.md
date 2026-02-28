# Railway Deployment - Step by Step Guide

## ✅ Completed Setup

- [x] Railway account created
- [x] Railway CLI installed
- [x] Backend updated to support Railway's DATABASE_URL
- [x] Health check endpoint added
- [x] railway.json configuration created

## 🚀 Next Steps - Follow These Exactly

### Step 1: Login to Railway (Interactive Terminal)

Open your terminal and run:

```bash
railway login
```

This will open a browser window. Click "Authorize" to link your CLI to your account.

### Step 2: Create New Project

In the Railway dashboard (https://railway.app/dashboard):

1. Click **"New Project"**
2. Choose **"Empty Project"**
3. Name it: `pos-backend` (or any name you prefer)

### Step 3: Add PostgreSQL Database

In your Railway project dashboard:

1. Click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Wait for it to deploy (takes ~30 seconds)

### Step 4: Add Redis (Optional but Recommended)

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Wait for deployment

### Step 5: Deploy Your Backend

Back in your terminal, navigate to your project:

```bash
cd /Users/admin/Documents/sadaf/Apps/POS
railway link
```

Select the project you created in Step 2.

Then deploy:

```bash
railway up
```

Railway will:
- Upload your code
- Build the Docker image
- Deploy your backend
- Automatically inject DATABASE_URL and REDIS_URL

### Step 6: Set Environment Variables

```bash
# Set JWT secret (IMPORTANT - use a strong random string)
railway variables set JWT_SECRET=your-super-secret-production-key-change-this

# Set Gin mode to release
railway variables set GIN_MODE=release
```

Generate a secure JWT secret:
```bash
openssl rand -base64 32
```

Use the output as your JWT_SECRET.

### Step 7: Get Your API URL

```bash
railway domain
```

This will show your deployment URL, something like:
`https://pos-backend-production-xxxx.up.railway.app`

If no domain exists, create one:
```bash
railway domain create
```

### Step 8: Run Database Migrations

You need to initialize your database schema. Railway provides a way to run commands:

```bash
# Get the DATABASE_URL
railway variables

# Copy the DATABASE_URL value, then run migrations
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
railway run psql $DATABASE_URL < database/init/12_aggregator_orders.sql
```

**Alternative:** Use Railway's PostgreSQL web interface:
1. Go to Railway dashboard → PostgreSQL service
2. Click "Data" tab
3. Copy-paste the SQL from each file

### Step 9: Test Your Deployment

```bash
# Replace with your actual Railway URL
curl https://pos-backend-production-xxxx.up.railway.app/health
```

Expected response:
```json
{"status":"healthy","message":"POS API is running"}
```

Test the API endpoint:
```bash
curl https://pos-backend-production-xxxx.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: JWT token response (if migrations ran successfully)

### Step 10: Update Desktop App Configuration

Create production environment file:

```bash
# Create production env file
cat > apps/desktop/.env.production << 'EOF'
VITE_API_URL=https://pos-backend-production-xxxx.up.railway.app/api/v1
EOF
```

Replace `pos-backend-production-xxxx.up.railway.app` with your actual Railway URL from Step 7.

### Step 11: Rebuild Desktop App with Production API

```bash
# Build for Mac
npm run build:mac

# Or build for Windows
npm run build:win
```

The installer will be in `apps/desktop/src-tauri/target/release/bundle/`

## 📊 Monitoring & Management

### View Logs
```bash
railway logs
```

### View Environment Variables
```bash
railway variables
```

### Open Railway Dashboard
```bash
railway open
```

### Check Service Status
```bash
railway status
```

## 🔧 Troubleshooting

### Issue: Build fails with "No Dockerfile found"

**Solution:** Make sure you ran `railway link` in the project root directory.

### Issue: Database connection error

**Solution:** Check that PostgreSQL is added and DATABASE_URL is set:
```bash
railway variables | grep DATABASE_URL
```

### Issue: Health check fails

**Solution:** Check logs:
```bash
railway logs --tail 100
```

Look for errors related to database connection or port binding.

### Issue: Can't access API from desktop app

**Solutions:**
1. Verify Railway URL is accessible: `curl https://your-url.railway.app/health`
2. Check CORS settings in backend/main.go (should allow all origins)
3. Verify .env.production has correct URL
4. Rebuild desktop app after updating .env.production

## 💰 Cost Management

### Free Tier
- $5 credit per month
- Perfect for testing and single restaurant

### Typical Usage
- Backend: ~$5/month
- PostgreSQL: ~$5/month (500MB storage)
- Redis: ~$3/month (256MB)
- **Total: ~$13/month** (minus $5 free = **$8/month**)

### Monitor Usage
- Go to Railway dashboard → Project → Usage
- Set up billing alerts in Settings

## 🔄 Continuous Deployment

### Option 1: GitHub Integration (Recommended)

1. Push your code to GitHub
2. In Railway dashboard:
   - Go to your service → Settings
   - Connect to GitHub repository
   - Every git push will auto-deploy

### Option 2: Manual Deploy via CLI

```bash
# After making changes
git add .
git commit -m "Update backend"
railway up
```

## 🎯 Next Steps After Deployment

1. **Test all API endpoints** using the desktop app
2. **Configure aggregator webhooks** in Admin → Settings → Platform Settings
   - Set webhook URLs to your Railway domain
3. **Set up monitoring** (Railway provides basic metrics)
4. **Create staging environment** (optional):
   ```bash
   railway environment create staging
   railway environment use staging
   railway up
   ```
5. **Distribute desktop app installers** to restaurant staff

## 📝 Important Notes

- Railway automatically handles SSL/HTTPS
- DATABASE_URL and REDIS_URL are auto-injected
- Backend restarts automatically if it crashes (restartPolicyType: ON_FAILURE)
- Health checks run every 30 seconds on /health endpoint
- Your local Docker setup still works for development (docker-compose up)

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app

---

**Current Status:** Ready for Step 1 (railway login)

Run the commands in order and let me know if you encounter any issues!
