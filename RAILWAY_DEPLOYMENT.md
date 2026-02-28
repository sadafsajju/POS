# Railway Deployment Guide

## Quick Deploy (5 Minutes)

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Initialize Project
```bash
# From your project root
cd /Users/admin/Documents/sadaf/Apps/POS
railway init
```

### 3. Add PostgreSQL
```bash
railway add --database postgresql
```

### 4. Add Redis
```bash
railway add --database redis
```

### 5. Deploy Backend
```bash
# Railway auto-detects your Dockerfile
railway up
```

### 6. Set Environment Variables
```bash
railway variables set JWT_SECRET=your-super-secret-production-key
railway variables set PORT=8080
# PostgreSQL and Redis URLs are auto-injected by Railway
```

### 7. Get Your API URL
```bash
railway domain
# Returns: https://your-app.railway.app
```

### 8. Update Desktop App
```bash
# apps/desktop/.env.production (create this file)
VITE_API_URL=https://your-app.railway.app/api/v1
```

## Project Structure for Railway

Railway will deploy your backend service. Create `railway.json` for configuration:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "./main",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## Environment Variables (Auto-injected by Railway)

Railway automatically provides:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PORT` - Application port (Railway assigns this)
- `RAILWAY_ENVIRONMENT` - production/staging

Update your Go backend to use these:

```go
// backend/main.go
import (
    "os"
    "net/url"
)

func getDatabaseConfig() string {
    // Railway provides DATABASE_URL in format:
    // postgresql://user:pass@host:port/dbname
    dbURL := os.Getenv("DATABASE_URL")
    if dbURL != "" {
        return dbURL
    }

    // Fallback to individual env vars (local development)
    return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
        os.Getenv("DB_HOST"),
        os.Getenv("DB_PORT"),
        os.Getenv("DB_USER"),
        os.Getenv("DB_PASSWORD"),
        os.Getenv("DB_NAME"),
    )
}
```

## Health Check Endpoint

Add this to your Go backend for Railway's health checks:

```go
// backend/internal/api/routes.go
func SetupRoutes(r *gin.Engine, db *sql.DB) {
    // Health check (no auth required)
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    // ... rest of your routes
}
```

## Database Migrations

Railway runs your migrations automatically if you add this to `railway.json`:

```json
{
  "deploy": {
    "startCommand": "./migrate && ./main"
  }
}
```

Or run manually:
```bash
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
```

## Webhook Configuration for Aggregators

After deployment, update your platform configs with the Railway URL:

**Webhook URLs:**
- Swiggy: `https://your-app.railway.app/api/v1/webhooks/swiggy/order`
- Zomato: `https://your-app.railway.app/api/v1/webhooks/zomato/order`

Configure these in:
1. Your cloud relay server
2. Admin > Settings > Platform Settings in the POS app

## Custom Domain (Optional)

```bash
railway domain add yourdomain.com
# Follow DNS instructions to point your domain
```

## Monitoring & Logs

```bash
# View live logs
railway logs

# Check service status
railway status

# Open Railway dashboard
railway open
```

## Cost Estimate

**Free Tier:**
- $5 credit/month
- Covers small restaurant usage

**Typical Production Cost:**
- Backend service: $5/month
- PostgreSQL (512MB): $5/month
- Redis (256MB): $3/month
- **Total: ~$13/month** (minus $5 free credit = **$8/month**)

For multiple restaurants, add ~$5/month per additional location.

## Deployment Workflow

```bash
# 1. Commit your changes
git add .
git commit -m "Update backend"

# 2. Deploy to Railway
git push origin main  # Railway auto-deploys from GitHub
# OR
railway up  # Manual deploy via CLI

# 3. Check logs
railway logs --tail

# 4. Test API
curl https://your-app.railway.app/health
```

## Multi-Environment Setup

Create separate Railway projects for staging and production:

```bash
# Create staging environment
railway environment create staging
railway environment use staging
railway up

# Create production environment
railway environment create production
railway environment use production
railway up
```

## Backup Strategy

Railway auto-backs up PostgreSQL, but for extra safety:

```bash
# Manual backup
railway run pg_dump $DATABASE_URL > backup.sql

# Restore
railway run psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### Backend won't start
```bash
railway logs --tail 100
# Check for:
# - Database connection errors
# - Missing environment variables
# - Port binding issues
```

### Database connection failed
```bash
railway variables
# Verify DATABASE_URL is set
# Check if PostgreSQL service is running
railway status
```

### Desktop app can't connect
1. Check `apps/desktop/.env` has correct `VITE_API_URL`
2. Verify Railway domain is accessible: `curl https://your-app.railway.app/health`
3. Check CORS settings in `backend/main.go`

## Next Steps After Deployment

1. ✅ Update desktop app API URL
2. ✅ Configure aggregator webhooks
3. ✅ Set up monitoring alerts
4. ✅ Enable Railway's automatic backups
5. ✅ Add custom domain (optional)
6. ✅ Set up CI/CD with GitHub Actions (optional)

## Desktop App Distribution

Railway hosts your **backend only**. For desktop app:

1. **Build installers locally:**
   ```bash
   npm run build:mac  # Creates .dmg
   npm run build:win  # Creates .exe
   ```

2. **Distribute via:**
   - Direct download (host .dmg/.exe on Railway static files or S3)
   - GitHub Releases (recommended)
   - Update server (Tauri has built-in updater)

3. **Update app configuration:**
   ```bash
   # apps/desktop/.env.production
   VITE_API_URL=https://your-app.railway.app/api/v1
   ```

## Complete Architecture

```
┌─────────────────────────────────────────┐
│ Railway (Cloud)                         │
│ ├─ Go Backend (Docker)                  │
│ ├─ PostgreSQL (managed)                 │
│ ├─ Redis (managed)                      │
│ └─ HTTPS: your-app.railway.app          │
└─────────────────────────────────────────┘
              ↓ API calls (internet)
┌─────────────────────────────────────────┐
│ Restaurant (Local)                      │
│ ├─ Tauri Desktop App (.dmg/.exe)       │
│ ├─ Local SQLite (offline mode)         │
│ ├─ Printer/hardware                     │
│ └─ Syncs when online                    │
└─────────────────────────────────────────┘
```

## Advantages Over Other Platforms

| Platform | Pros | Cons |
|----------|------|------|
| **Railway** ✅ | Docker, PostgreSQL, Redis, easy deploy, $5 free | Small company |
| Vercel | Great for Next.js | No PostgreSQL, no Docker backend |
| Supabase | Free PostgreSQL | No Go support, vendor lock-in |
| Heroku | Mature platform | Expensive ($25+/month) |
| AWS/GCP | Enterprise scale | Complex setup, expensive |
| DigitalOcean | Full control | Manual setup required |
| Fly.io | Global edge | More complex than Railway |

**Railway wins for your use case:** Docker + PostgreSQL + Redis + simple deployment.
