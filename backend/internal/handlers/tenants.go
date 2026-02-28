package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"pos-backend/internal/models"
)

type TenantHandler struct {
	db *sql.DB
}

func NewTenantHandler(db *sql.DB) *TenantHandler {
	return &TenantHandler{db: db}
}

// RegisterTenant creates a new tenant (restaurant) with admin user
// Public endpoint - no authentication required
func (h *TenantHandler) RegisterTenant(c *gin.Context) {
	var req struct {
		BusinessName string `json:"business_name" binding:"required,min=3,max=100"`
		Subdomain    string `json:"subdomain" binding:"required,min=3,max=50"`
		AdminEmail   string `json:"admin_email" binding:"required,email"`
		AdminName    string `json:"admin_name" binding:"required,min=2,max=100"`
		Password     string `json:"password" binding:"required,min=8"`
		Phone        string `json:"phone"`
		City         string `json:"city" binding:"required"`
		State        string `json:"state"`
		Country      string `json:"country"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request. Please check all required fields.",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Sanitize and validate subdomain
	subdomain := strings.ToLower(strings.TrimSpace(req.Subdomain))
	subdomain = strings.ReplaceAll(subdomain, " ", "-")

	// Subdomain validation: alphanumeric + hyphens only, no consecutive hyphens
	matched, _ := regexp.MatchString(`^[a-z0-9]+(-[a-z0-9]+)*$`, subdomain)
	if !matched || len(subdomain) < 3 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Subdomain must be at least 3 characters and contain only lowercase letters, numbers, and hyphens",
			Error:   stringPtr("invalid_subdomain"),
		})
		return
	}

	// Check for reserved subdomains
	reserved := []string{"www", "api", "admin", "app", "mail", "ftp", "smtp", "test", "dev", "stage", "staging", "prod", "production"}
	for _, r := range reserved {
		if subdomain == r {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: fmt.Sprintf("Subdomain '%s' is reserved. Please choose another.", subdomain),
				Error:   stringPtr("subdomain_reserved"),
			})
			return
		}
	}

	// Check if subdomain is available
	var exists bool
	err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM tenants WHERE subdomain = $1 AND deleted_at IS NULL)", subdomain).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check subdomain availability",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if exists {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Message: fmt.Sprintf("Subdomain '%s' is already taken. Please choose another.", subdomain),
			Error:   stringPtr("subdomain_taken"),
		})
		return
	}

	// Check if email is already registered
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", req.AdminEmail).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check email availability",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if exists {
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Message: "This email is already registered. Please use a different email or login.",
			Error:   stringPtr("email_taken"),
		})
		return
	}

	// Password strength validation
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Password must be at least 8 characters long",
			Error:   stringPtr("weak_password"),
		})
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to start registration process",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer tx.Rollback()

	// Create tenant with 14-day trial
	tenantID := uuid.New()
	country := req.Country
	if country == "" {
		country = "India"
	}

	_, err = tx.Exec(`
		INSERT INTO tenants (
			id, business_name, subdomain, plan, subscription_status,
			trial_ends_at, billing_email, contact_name, contact_phone,
			city, state, country, timezone,
			max_locations, max_users, max_products,
			is_active, onboarding_completed
		) VALUES ($1, $2, $3, 'trial', 'active', $4, $5, $6, $7, $8, $9, $10, $11, 1, 5, 100, true, false)
	`,
		tenantID,
		req.BusinessName,
		subdomain,
		time.Now().Add(14*24*time.Hour), // 14-day trial
		req.AdminEmail,
		req.AdminName,
		req.Phone,
		req.City,
		req.State,
		country,
		"Asia/Kolkata", // Default timezone
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create restaurant account",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Create default location
	locationID := uuid.New()
	address := fmt.Sprintf("%s, %s", req.City, req.State)
	if req.State == "" {
		address = req.City
	}

	_, err = tx.Exec(`
		INSERT INTO locations (
			id, tenant_id, name, code, address, city, state, postal_code, phone, is_active
		) VALUES ($1, $2, 'Main Location', 'MAIN', $3, $4, $5, '', $6, true)
	`,
		locationID,
		tenantID,
		address,
		req.City,
		req.State,
		req.Phone,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create location",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Create admin user
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to secure password",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	adminID := uuid.New()
	username := subdomain + "_admin" // e.g., "pizza-palace_admin"

	_, err = tx.Exec(`
		INSERT INTO users (
			id, tenant_id, location_id, username, email, password_hash,
			first_name, last_name, role, is_active
		) VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'admin', true)
	`,
		adminID,
		tenantID,
		locationID,
		username,
		req.AdminEmail,
		string(hashedPassword),
		req.AdminName,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create admin user",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Create default settings
	settingsToCreate := []struct {
		key   string
		value string
	}{
		{"business_name", req.BusinessName},
		{"tax_rate", "5.0"},
		{"currency", "INR"},
		{"receipt_footer", "Thank you for your business!"},
		{"touch_mode", "false"},
	}

	for _, setting := range settingsToCreate {
		_, err = tx.Exec(`
			INSERT INTO settings (tenant_id, key, value)
			VALUES ($1, $2, $3)
		`, tenantID, setting.key, setting.value)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create default settings",
				Error:   stringPtr(err.Error()),
			})
			return
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to complete registration",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Determine login URL based on environment
	loginURL := fmt.Sprintf("https://%s.yourpos.com", subdomain)
	// In development, use localhost
	if c.Request.Host == "localhost:8080" || strings.HasPrefix(c.Request.Host, "127.0.0.1") {
		loginURL = fmt.Sprintf("http://localhost:3000?subdomain=%s", subdomain)
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("🎉 Welcome to POS! Your restaurant '%s' has been registered successfully. Your 14-day free trial starts now!", req.BusinessName),
		Data: map[string]interface{}{
			"tenant_id":   tenantID,
			"subdomain":   subdomain,
			"login_url":   loginURL,
			"username":    username,
			"trial_ends":  time.Now().Add(14 * 24 * time.Hour).Format("2006-01-02"),
			"trial_days":  14,
			"plan":        "trial",
			"max_users":   5,
			"max_products": 100,
		},
	})
}

// CheckSubdomainAvailability checks if a subdomain is available (public endpoint)
func (h *TenantHandler) CheckSubdomainAvailability(c *gin.Context) {
	subdomain := c.Query("subdomain")
	if subdomain == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Subdomain parameter is required",
			Error:   stringPtr("missing_subdomain"),
		})
		return
	}

	// Sanitize
	subdomain = strings.ToLower(strings.TrimSpace(subdomain))
	subdomain = strings.ReplaceAll(subdomain, " ", "-")

	// Validate format
	matched, _ := regexp.MatchString(`^[a-z0-9]+(-[a-z0-9]+)*$`, subdomain)
	if !matched || len(subdomain) < 3 {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "Invalid subdomain format",
			Data: map[string]interface{}{
				"available": false,
				"reason":    "Subdomain must be at least 3 characters and contain only lowercase letters, numbers, and hyphens",
			},
		})
		return
	}

	// Check reserved
	reserved := []string{"www", "api", "admin", "app", "mail", "ftp", "smtp", "test", "dev", "stage", "staging", "prod", "production"}
	for _, r := range reserved {
		if subdomain == r {
			c.JSON(http.StatusOK, models.APIResponse{
				Success: true,
				Message: "Subdomain is reserved",
				Data: map[string]interface{}{
					"available": false,
					"reason":    fmt.Sprintf("'%s' is a reserved subdomain", subdomain),
				},
			})
			return
		}
	}

	// Check if taken
	var exists bool
	err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM tenants WHERE subdomain = $1 AND deleted_at IS NULL)", subdomain).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check availability",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if exists {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "Subdomain is taken",
			Data: map[string]interface{}{
				"available": false,
				"reason":    fmt.Sprintf("'%s' is already taken", subdomain),
			},
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Subdomain is available",
		Data: map[string]interface{}{
			"available":   true,
			"subdomain":   subdomain,
			"preview_url": fmt.Sprintf("https://%s.yourpos.com", subdomain),
		},
	})
}

// GetTenantBySubdomain retrieves tenant info by subdomain (public endpoint)
// Used by frontend to display restaurant name before login
func (h *TenantHandler) GetTenantBySubdomain(c *gin.Context) {
	subdomain := c.Param("subdomain")
	if subdomain == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Subdomain parameter is required",
			Error:   stringPtr("missing_subdomain"),
		})
		return
	}

	var tenant struct {
		ID                   string    `json:"id"`
		BusinessName         string    `json:"business_name"`
		Subdomain            string    `json:"subdomain"`
		Plan                 string    `json:"plan"`
		SubscriptionStatus   string    `json:"subscription_status"`
		IsActive             bool      `json:"is_active"`
		OnboardingCompleted  bool      `json:"onboarding_completed"`
		TrialEndsAt          *time.Time `json:"trial_ends_at,omitempty"`
	}

	err := h.db.QueryRow(`
		SELECT id, business_name, subdomain, plan, subscription_status,
		       is_active, onboarding_completed, trial_ends_at
		FROM tenants
		WHERE subdomain = $1 AND deleted_at IS NULL
	`, subdomain).Scan(
		&tenant.ID,
		&tenant.BusinessName,
		&tenant.Subdomain,
		&tenant.Plan,
		&tenant.SubscriptionStatus,
		&tenant.IsActive,
		&tenant.OnboardingCompleted,
		&tenant.TrialEndsAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Restaurant not found",
			Error:   stringPtr("tenant_not_found"),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch restaurant info",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if !tenant.IsActive {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Message: "This restaurant account is inactive",
			Error:   stringPtr("tenant_inactive"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Restaurant found",
		Data:    tenant,
	})
}

// stringPtr is already defined in auth.go
