# Supabase Integration Guide

## Recommended Hybrid Architecture

Use Supabase **only for customer-facing features**, keep Go backend for POS operations.

## Setup Steps

### 1. Create Supabase Project
```bash
npm install -g supabase
supabase init
supabase login
```

### 2. Schema Sync (Read-Only for Customers)
Create a subset of your schema in Supabase:
- `products` (read-only view)
- `categories` (read-only view)
- `customer_orders` (customer-submitted orders)
- `order_items`

### 3. Customer Web App Package
```bash
# Create new customer web app
cd apps
npx create-next-app customer-web --typescript --tailwind --app
cd customer-web
npm install @supabase/supabase-js
```

### 4. Supabase Client Setup
```typescript
// apps/customer-web/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 5. Sync Service (Go Backend)
Add a service to sync products from your PostgreSQL to Supabase:

```go
// backend/internal/services/supabase_sync.go
package services

import (
    "bytes"
    "encoding/json"
    "net/http"
    "os"
)

type SupabaseSync struct {
    url    string
    apiKey string
}

func NewSupabaseSync() *SupabaseSync {
    return &SupabaseSync{
        url:    os.Getenv("SUPABASE_URL"),
        apiKey: os.Getenv("SUPABASE_SERVICE_KEY"),
    }
}

func (s *SupabaseSync) SyncProduct(product Product) error {
    // Upsert product to Supabase
    data, _ := json.Marshal(product)
    req, _ := http.NewRequest("POST",
        s.url+"/rest/v1/products?on_conflict=id",
        bytes.NewBuffer(data),
    )
    req.Header.Set("apikey", s.apiKey)
    req.Header.Set("Authorization", "Bearer "+s.apiKey)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Prefer", "resolution=merge-duplicates")

    _, err := http.DefaultClient.Do(req)
    return err
}
```

## What to Sync vs Keep Local

| Data Type | Storage | Why |
|-----------|---------|-----|
| Products | Supabase (read-only) | Customer menu browsing |
| Categories | Supabase (read-only) | Menu organization |
| Customer Orders | Supabase → Go Backend | Submitted via web, processed by POS |
| POS Orders | Local PostgreSQL only | Offline-first, privacy |
| Payments | Local only | PCI compliance, sensitive data |
| Staff/Users | Local only | Security |
| Tables | Local only | Restaurant-specific |
| Inventory | Local only | Real-time tracking |

## Cost Considerations

Supabase Free Tier:
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users

For a single restaurant, this is sufficient. For multi-tenant SaaS, you'll need paid plans.

## Alternative: Skip Supabase, Use Your Go Backend

Your current architecture is **already better** for a POS system:
- True offline-first
- Direct hardware control
- No vendor lock-in
- Lower latency
- Better privacy

**Recommendation**: Deploy your Go backend to Railway/Fly.io instead of adding Supabase complexity.
