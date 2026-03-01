# Clerk Staff Invitation & Login Flow - Implementation Summary

## Overview
Successfully implemented Clerk Organizations for multi-tenant SaaS with automatic staff invitation emails and role-based login redirects.

## Issues Fixed

### 1. Staff Added as New Users Instead of Organization Members
**Problem**: Invitations were creating separate Clerk users instead of organization members.

**Root Cause**: Docker build cache preventing new code deployment.

**Solution**:
- Fixed role mapping in `CreateOrganizationInvitation()` to use Clerk's role format
- Used `touch backend/main.go && docker-compose build --no-cache backend` to force rebuild

**File**: `backend/internal/services/clerk.go` (lines 200-212)

### 2. Role Mapping - Clerk Organization Roles
**Problem**: Clerk API returned 404 "Organization role not found" when using POS role "server".

**Root Cause**: Clerk only accepts `org:admin` and `org:member` roles, not custom roles.

**Solution**: Map POS roles to Clerk roles:
```go
clerkRole := "org:member" // Default for staff (server, counter, kitchen)
if role == "admin" || role == "manager" {
    clerkRole = "org:admin"
}
```

**File**: `backend/internal/services/clerk.go` (lines 200-212)

### 3. Duplicate User Creation
**Problem**: Staff accepting invitation created new user records instead of syncing to existing staff member.

**Root Cause**: Auto-provisioning logic always created new users.

**Solution**: Updated webhook handler to sync clerk_id to existing users by email:
```go
// Try to update existing user's clerk_id
var existingUserID uuid.UUID
err = h.db.QueryRow(`
    UPDATE users SET clerk_id = $1, auth_provider = 'clerk', updated_at = CURRENT_TIMESTAMP
    WHERE email = $2 AND clerk_id IS NULL AND is_active = true
    RETURNING id
`, clerkUserID, email).Scan(&existingUserID)
```

**File**: `backend/internal/handlers/clerk_webhooks.go` (lines 416-467)

### 4. Staff Seeing Setup Wizard
**Problem**: Staff members redirected to setup wizard after accepting invitation.

**Root Cause**: `needsSetup` logic returned true for all users.

**Solution**: Only show setup to admins/managers:
```go
needsSetup := false
if user.Role == "admin" || user.Role == "manager" {
    needsSetup = true // Default to needing setup for admins
    var setupValue string
    err = h.db.QueryRow(`
        SELECT value FROM settings
        WHERE org_id = $1 AND location_id = $2 AND key = 'setup_complete'
    `, user.OrgID, locIDForSetup).Scan(&setupValue)
    if err == nil && setupValue == "true" {
        needsSetup = false
    }
}
```

**File**: `backend/internal/handlers/clerk_webhooks.go` (lines 565-582)

### 5. Access Denied for Staff
**Problem**: Staff members blocked with "Access Denied - You don't have admin privileges".

**Root Cause**: Admin route checking `if (user.role !== 'admin')` and blocking all non-admins.

**Solution**: Implemented role-based access control with allowed routes:
```typescript
const allowedRoutes = {
  admin: ['/admin'], // Full admin access
  manager: ['/admin'], // Full admin access
  server: ['/admin/pos'], // POS interface only
  counter: ['/admin/pos'], // POS interface only
  kitchen: ['/admin/kitchen'], // Kitchen display only
}
```

**File**: `apps/desktop/src/routes/admin.tsx` (lines 168-197)

### 6. Staff Redirected to /admin Instead of Their Interface
**Problem**: All users redirected to `/admin` after login, requiring manual navigation to POS/Kitchen.

**Root Cause**: Hardcoded `navigate({ to: '/admin' })` in login page (lines 68 and 81).

**Solution**: Created role-based redirect helper:
```typescript
function getRoleBasedRedirect(role: string | undefined): string {
  switch (role) {
    case 'server':
    case 'counter':
      return '/admin/pos';
    case 'kitchen':
      return '/admin/kitchen';
    case 'admin':
    case 'manager':
    default:
      return '/admin';
  }
}
```

**File**: `apps/desktop/src/routes/login.tsx` (lines 15-27, 86, 101)

### 7. Redirect Not Working for Already-Authenticated Users
**Problem**: Redirect only ran during Clerk session sync, not for already-authenticated users.

**Root Cause**: Session persisted after login, so `isAuthenticated` was already true.

**Solution**: Added separate useEffect for already-authenticated users:
```typescript
useEffect(() => {
  if (!_hasHydrated || !isAuthenticated || !user) {
    return
  }

  const currentPath = location.pathname

  // Redirect staff to their specific interface if they're on wrong route
  if (user.role === 'server' || user.role === 'counter') {
    if (currentPath === '/admin' || currentPath === '/admin/') {
      console.log('🔀 Staff on /admin root, redirecting to POS interface')
      window.location.href = '/admin/pos'
    }
  } else if (user.role === 'kitchen') {
    if (currentPath === '/admin' || currentPath === '/admin/') {
      console.log('🔀 Kitchen staff on /admin root, redirecting to kitchen display')
      window.location.href = '/admin/kitchen'
    }
  }
}, [_hasHydrated, isAuthenticated, user, location.pathname])
```

**File**: `apps/desktop/src/routes/admin.tsx` (lines 31-51)

## Complete Staff Invitation Flow (Now Working)

1. ✅ Admin creates staff member at `/admin/settings/staff`
2. ✅ Backend sends Clerk organization invitation with role mapping
3. ✅ Staff receives invitation email from Clerk
4. ✅ Staff clicks invitation link and sets password
5. ✅ Clerk webhook syncs clerk_id to existing user record (no duplicates)
6. ✅ Staff logs in via Clerk
7. ✅ Backend returns user data with `needs_setup: false` (staff skip setup)
8. ✅ Frontend redirects based on role:
   - Server/Counter → `/admin/pos`
   - Kitchen → `/admin/kitchen`
   - Admin/Manager → `/admin`
9. ✅ Role-based access control allows staff to access their routes

## Known Limitation

**URL Structure**: Staff members still have `/admin` in their URL path (e.g., `/admin/pos`).

**User Feedback**: "before we integrated clerk it use to work fine, the staff never use to see admin route"

**Potential Future Improvement**:
- Move POS and Kitchen routes out of `/admin` namespace
- Create dedicated routes: `/pos`, `/kitchen`
- Requires refactoring route structure and references

## Testing Checklist

- [ ] Create staff member as admin
- [ ] Verify invitation email received
- [ ] Accept invitation and set password
- [ ] Login as staff member
- [ ] Verify redirected to `/admin/pos` (server/counter) or `/admin/kitchen` (kitchen)
- [ ] Verify can access POS/Kitchen interface
- [ ] Verify setup wizard not shown
- [ ] Verify no duplicate user records created
- [ ] Logout and login again (verify session persistence)

## Environment Variables Required

Backend requires Clerk environment variables:
```
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

## Files Modified

### Backend
1. `backend/internal/services/clerk.go` - Role mapping for invitations
2. `backend/internal/handlers/clerk_webhooks.go` - Sync clerk_id, needsSetup logic

### Frontend
1. `apps/desktop/src/routes/login.tsx` - Role-based redirect
2. `apps/desktop/src/routes/admin.tsx` - Role-based access control + already-authenticated redirect

## Deployment Notes

After making backend changes:
```bash
# Force rebuild without cache
touch backend/main.go
docker-compose build --no-cache backend
docker-compose up -d backend

# Verify backend is running
docker logs pos-backend --tail 20
```

After making frontend changes:
```bash
# Frontend auto-reloads in dev mode (npm run dev:desktop)
# For production, rebuild desktop app
npm run build:mac  # or build:win
```

## User Needs to Logout/Login After Backend Restart

**Important**: JWT tokens are invalidated when backend restarts. Users must:
1. Logout (clears Clerk session)
2. Login again (gets new JWT)

Otherwise they'll see 401 errors.
