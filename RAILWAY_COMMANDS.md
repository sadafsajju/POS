# Railway Quick Reference Commands

## Initial Setup (One Time)

```bash
# 1. Login
railway login

# 2. Link to project (after creating project in Railway dashboard)
cd /Users/admin/Documents/sadaf/Apps/POS
railway link

# 3. Deploy
railway up

# 4. Set environment variables
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set GIN_MODE=release

# 5. Create public domain
railway domain create

# 6. Run migrations
railway run psql $DATABASE_URL < database/init/01_schema.sql
railway run psql $DATABASE_URL < database/init/02_seed_data.sql
railway run psql $DATABASE_URL < database/init/12_aggregator_orders.sql
```

## Daily Development Workflow

```bash
# Make changes to code
# ...

# Deploy updates
railway up

# Check logs
railway logs --tail 50

# Restart service
railway restart
```

## Useful Commands

```bash
# View all environment variables
railway variables

# Set a new variable
railway variables set KEY=value

# Delete a variable
railway variables delete KEY

# View logs (live)
railway logs

# View recent logs
railway logs --tail 100

# Open Railway dashboard in browser
railway open

# Check service status
railway status

# Get your deployment URL
railway domain

# Run a command in Railway environment
railway run <command>

# Connect to PostgreSQL shell
railway run psql $DATABASE_URL

# View database tables
railway run psql $DATABASE_URL -c "\dt"

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql

# Restore database
railway run psql $DATABASE_URL < backup.sql
```

## Multiple Environments

```bash
# Create staging environment
railway environment create staging

# Switch to staging
railway environment use staging

# Deploy to staging
railway up

# Switch back to production
railway environment use production
```

## Debugging

```bash
# Check build logs
railway logs --deployment

# View environment variables (check DATABASE_URL exists)
railway variables | grep DATABASE_URL

# Test database connection
railway run psql $DATABASE_URL -c "SELECT 1;"

# Check service health
curl $(railway domain)/health
```

## Cost Monitoring

```bash
# View current usage
railway open  # Then go to Usage tab

# View project info
railway status
```

## Emergency Commands

```bash
# Restart crashed service
railway restart

# Rollback to previous deployment
railway up --detach  # Then use dashboard to rollback

# View error logs
railway logs --tail 500 | grep -i error

# Force redeploy
railway up --force
```

## Tips

- Use `railway link` in project root, not in backend/ directory
- `railway up` deploys from current directory
- Environment variables are automatically injected (DATABASE_URL, REDIS_URL, PORT)
- Health check endpoint must return 200 status
- Free tier includes $5/month credit
- Logs are retained for 7 days
