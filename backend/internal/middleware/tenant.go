package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"pos-backend/internal/models"
)

// TenantContextKey is the key for storing tenant info in context
const TenantContextKey = "tenant_context"

// TenantContext holds tenant information for the current request
type TenantContext struct {
	TenantID     string `json:"tenant_id"`
	BusinessName string `json:"business_name"`
	Plan         string `json:"plan"`
	Status       string `json:"subscription_status"`
	LocationID   string `json:"location_id,omitempty"`
}

// TenantMiddleware extracts tenant from JWT claims and sets PostgreSQL session variable
func TenantMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract tenant_id from JWT claims (set by AuthMiddleware)
		userClaims, exists := c.Get("user")
		if !exists {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Message: "Authentication required",
				Error:   stringPtr("unauthorized"),
			})
			c.Abort()
			return
		}

		claims, ok := userClaims.(map[string]interface{})
		if !ok {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Invalid user claims",
				Error:   stringPtr("invalid_claims"),
			})
			c.Abort()
			return
		}

		// Get tenant_id from claims
		tenantID, ok := claims["tenant_id"].(string)
		if !ok || tenantID == "" {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Tenant context not found",
				Error:   stringPtr("missing_tenant"),
			})
			c.Abort()
			return
		}

		// Verify tenant is active and get tenant info
		var tenantCtx TenantContext
		err := db.QueryRow(`
			SELECT id, business_name, plan, subscription_status
			FROM tenants
			WHERE id = $1
			  AND is_active = true
			  AND deleted_at IS NULL
		`, tenantID).Scan(
			&tenantCtx.TenantID,
			&tenantCtx.BusinessName,
			&tenantCtx.Plan,
			&tenantCtx.Status,
		)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Tenant not found or inactive",
				Error:   stringPtr("tenant_not_found"),
			})
			c.Abort()
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to verify tenant",
				Error:   stringPtr("database_error"),
			})
			c.Abort()
			return
		}

		// Check subscription status
		if tenantCtx.Status != "active" {
			c.JSON(http.StatusPaymentRequired, models.APIResponse{
				Success: false,
				Message: "Subscription " + tenantCtx.Status + ". Please contact support.",
				Error:   stringPtr("subscription_" + tenantCtx.Status),
			})
			c.Abort()
			return
		}

		// Set PostgreSQL session variable for Row-Level Security
		_, err = db.Exec("SET LOCAL app.tenant_id = $1", tenantID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to set tenant context",
				Error:   stringPtr("tenant_context_error"),
			})
			c.Abort()
			return
		}

		// Optionally get location_id from claims
		if locationID, ok := claims["location_id"].(string); ok {
			tenantCtx.LocationID = locationID
		}

		// Store in Gin context for handlers to use
		c.Set(TenantContextKey, tenantCtx)

		c.Next()
	}
}

// SubdomainTenantResolver resolves tenant from subdomain (for public/onboarding routes)
func SubdomainTenantResolver(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract subdomain from Host header
		host := c.Request.Host
		subdomain := extractSubdomain(host)

		if subdomain == "" || subdomain == "www" || subdomain == "api" {
			// Skip for main domain or API domain
			c.Next()
			return
		}

		// Look up tenant by subdomain
		var tenantID, businessName, plan, status string
		var isActive bool

		err := db.QueryRow(`
			SELECT id, business_name, plan, subscription_status, is_active
			FROM tenants
			WHERE subdomain = $1 AND deleted_at IS NULL
		`, subdomain).Scan(&tenantID, &businessName, &plan, &status, &isActive)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, models.APIResponse{
				Success: false,
				Message: "Restaurant not found",
				Error:   stringPtr("tenant_not_found"),
			})
			c.Abort()
			return
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to resolve tenant",
				Error:   stringPtr("database_error"),
			})
			c.Abort()
			return
		}

		if !isActive {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Restaurant account is inactive",
				Error:   stringPtr("tenant_inactive"),
			})
			c.Abort()
			return
		}

		// Store tenant context
		tenantCtx := TenantContext{
			TenantID:     tenantID,
			BusinessName: businessName,
			Plan:         plan,
			Status:       status,
		}

		// Set PostgreSQL session variable
		_, _ = db.Exec("SET LOCAL app.tenant_id = $1", tenantID)

		c.Set(TenantContextKey, tenantCtx)
		c.Next()
	}
}

// extractSubdomain extracts subdomain from host
// Examples:
//   pizza-palace.yourpos.com -> pizza-palace
//   localhost:8080 -> ""
//   yourpos.com -> ""
func extractSubdomain(host string) string {
	// Remove port
	if colonIndex := strings.Index(host, ":"); colonIndex != -1 {
		host = host[:colonIndex]
	}

	// Skip localhost
	if strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") {
		return ""
	}

	// Split by dots
	parts := strings.Split(host, ".")

	// Need at least 3 parts for subdomain (subdomain.domain.tld)
	if len(parts) < 3 {
		return ""
	}

	// Return first part as subdomain
	return parts[0]
}

// GetTenantContext retrieves tenant context from Gin context
func GetTenantContext(c *gin.Context) (*TenantContext, bool) {
	value, exists := c.Get(TenantContextKey)
	if !exists {
		return nil, false
	}

	tenantCtx, ok := value.(TenantContext)
	return &tenantCtx, ok
}

// RequireTenant ensures tenant context exists (use after TenantMiddleware)
func RequireTenant() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, exists := GetTenantContext(c)
		if !exists {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Tenant context required",
				Error:   stringPtr("missing_tenant_context"),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// CheckTenantLimit checks if tenant has reached plan limits
func CheckTenantLimit(db *sql.DB, limitType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantCtx, exists := GetTenantContext(c)
		if !exists {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Tenant context required",
				Error:   stringPtr("missing_tenant_context"),
			})
			c.Abort()
			return
		}

		// Check limit using database function
		var withinLimit bool
		err := db.QueryRow(
			"SELECT check_tenant_limits($1, $2)",
			tenantCtx.TenantID,
			limitType,
		).Scan(&withinLimit)

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to check tenant limits",
				Error:   stringPtr("database_error"),
			})
			c.Abort()
			return
		}

		if !withinLimit {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Plan limit reached for " + limitType + ". Please upgrade your plan.",
				Error:   stringPtr("limit_exceeded"),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// stringPtr is already defined in auth.go
