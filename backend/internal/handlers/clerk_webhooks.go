package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ClerkWebhookHandler handles webhooks from Clerk
type ClerkWebhookHandler struct {
	db *sql.DB
}

// NewClerkWebhookHandler creates a new ClerkWebhookHandler
func NewClerkWebhookHandler(db *sql.DB) *ClerkWebhookHandler {
	return &ClerkWebhookHandler{db: db}
}

// ClerkWebhookEvent represents a Clerk webhook event
type ClerkWebhookEvent struct {
	Data   json.RawMessage `json:"data"`
	Object string          `json:"object"`
	Type   string          `json:"type"`
}

// ClerkUserData represents user data from Clerk webhook
type ClerkUserData struct {
	ID             string              `json:"id"`
	FirstName      *string             `json:"first_name"`
	LastName       *string             `json:"last_name"`
	EmailAddresses []ClerkEmailAddress `json:"email_addresses"`
	UnsafeMetadata map[string]interface{} `json:"unsafe_metadata"`
	CreatedAt      int64               `json:"created_at"`
	UpdatedAt      int64               `json:"updated_at"`
}

// ClerkEmailAddress represents an email address from Clerk
type ClerkEmailAddress struct {
	ID           string `json:"id"`
	EmailAddress string `json:"email_address"`
}

// HandleWebhook processes incoming Clerk webhooks
func (h *ClerkWebhookHandler) HandleWebhook(c *gin.Context) {
	// Read the body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Failed to read request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Verify webhook signature using Svix headers
	webhookSecret := os.Getenv("CLERK_WEBHOOK_SECRET")
	if webhookSecret == "" {
		log.Println("Warning: CLERK_WEBHOOK_SECRET not set, skipping signature verification")
	} else {
		svixID := c.GetHeader("svix-id")
		svixTimestamp := c.GetHeader("svix-timestamp")
		svixSignature := c.GetHeader("svix-signature")

		if svixID == "" || svixTimestamp == "" || svixSignature == "" {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Message: "Missing Svix signature headers",
				Error:   stringPtr("missing_signature"),
			})
			return
		}

		if !verifySvixSignature(webhookSecret, svixID, svixTimestamp, string(body), svixSignature) {
			c.JSON(http.StatusUnauthorized, models.APIResponse{
				Success: false,
				Message: "Invalid webhook signature",
				Error:   stringPtr("invalid_signature"),
			})
			return
		}
	}

	// Parse the event
	var event ClerkWebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Failed to parse webhook event",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	log.Printf("Clerk webhook received: type=%s", event.Type)

	switch event.Type {
	case "user.created":
		h.handleUserCreated(c, event.Data)
	case "user.updated":
		h.handleUserUpdated(c, event.Data)
	case "user.deleted":
		h.handleUserDeleted(c, event.Data)
	default:
		// Acknowledge unknown events
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: fmt.Sprintf("Event type %s acknowledged (not handled)", event.Type),
		})
	}
}

// handleUserCreated processes a user.created webhook — creates org + location + admin user
func (h *ClerkWebhookHandler) handleUserCreated(c *gin.Context, data json.RawMessage) {
	var userData ClerkUserData
	if err := json.Unmarshal(data, &userData); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Failed to parse user data",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Extract primary email
	email := ""
	if len(userData.EmailAddresses) > 0 {
		email = userData.EmailAddresses[0].EmailAddress
	}

	firstName := ""
	if userData.FirstName != nil {
		firstName = *userData.FirstName
	}
	lastName := ""
	if userData.LastName != nil {
		lastName = *userData.LastName
	}

	// Extract business details from unsafeMetadata
	businessName := fmt.Sprintf("%s's Business", firstName)
	if name, ok := userData.UnsafeMetadata["business_name"].(string); ok && name != "" {
		businessName = name
	}

	// Generate slug from business name
	slug := generateSlug(businessName)

	// Check if user already exists (idempotency)
	var existingID string
	err := h.db.QueryRow("SELECT id FROM users WHERE clerk_id = $1", userData.ID).Scan(&existingID)
	if err == nil {
		// Already processed
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "User already exists",
			Data:    map[string]string{"user_id": existingID},
		})
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer tx.Rollback()

	// 1. Create organization
	orgID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, orgID, businessName, slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create organization",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// 2. Create default location
	locID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO locations (id, org_id, name, code, is_active, created_at, updated_at)
		VALUES ($1, $2, 'Main Location', 'MAIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, locID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create location",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// 3. Create admin user with clerk_id
	userID := uuid.New()
	username := generateUsername(email)

	// Generate a random password hash (user will authenticate via Clerk, not password)
	randomPass := uuid.New().String()
	passHash, _ := bcrypt.GenerateFromPassword([]byte(randomPass), bcrypt.DefaultCost)

	_, err = tx.Exec(`
		INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active, org_id, location_id, clerk_id, auth_provider, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, $7, $8, $9, 'clerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, username, email, string(passHash), firstName, lastName, orgID, locID, userData.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create user",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// 4. Add user-location assignment
	tx.Exec(`
		INSERT INTO user_locations (user_id, location_id, is_primary)
		VALUES ($1, $2, true)
	`, userID, locID)

	// 5. Create default settings for the org (setup_complete = false so user goes through wizard)
	tx.Exec(`
		INSERT INTO settings (org_id, location_id, key, value, created_at, updated_at)
		VALUES ($1, $2, 'setup_complete', 'false', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (org_id, location_id, key) DO NOTHING
	`, orgID, locID)

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	log.Printf("Clerk user.created: org=%s user=%s clerk_id=%s", orgID, userID, userData.ID)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User and organization created",
		Data: map[string]string{
			"user_id": userID.String(),
			"org_id":  orgID.String(),
		},
	})
}

// handleUserUpdated syncs email/name changes from Clerk
func (h *ClerkWebhookHandler) handleUserUpdated(c *gin.Context, data json.RawMessage) {
	var userData ClerkUserData
	if err := json.Unmarshal(data, &userData); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Failed to parse user data",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	email := ""
	if len(userData.EmailAddresses) > 0 {
		email = userData.EmailAddresses[0].EmailAddress
	}

	firstName := ""
	if userData.FirstName != nil {
		firstName = *userData.FirstName
	}
	lastName := ""
	if userData.LastName != nil {
		lastName = *userData.LastName
	}

	result, err := h.db.Exec(`
		UPDATE users SET email = $1, first_name = $2, last_name = $3, updated_at = CURRENT_TIMESTAMP
		WHERE clerk_id = $4
	`, email, firstName, lastName, userData.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update user",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "No matching user found (may not have signed up yet)",
		})
		return
	}

	log.Printf("Clerk user.updated: clerk_id=%s", userData.ID)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User updated",
	})
}

// handleUserDeleted deactivates the user
func (h *ClerkWebhookHandler) handleUserDeleted(c *gin.Context, data json.RawMessage) {
	var userData struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(data, &userData); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Failed to parse user data",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	_, err := h.db.Exec(`
		UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
		WHERE clerk_id = $1
	`, userData.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to deactivate user",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	log.Printf("Clerk user.deleted: clerk_id=%s deactivated", userData.ID)
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User deactivated",
	})
}

// GetClerkSession validates a Clerk JWT, looks up (or auto-provisions) the user,
// and returns user/org/location data. Called by the frontend after Clerk sign-in.
// This is a PUBLIC endpoint — it performs its own Clerk JWT validation.
func (h *ClerkWebhookHandler) GetClerkSession(c *gin.Context) {
	// 1. Extract Bearer token
	authHeader := c.GetHeader("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authorization header with Bearer token required",
			Error:   stringPtr("missing_auth"),
		})
		return
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	// 2. Validate Clerk JWT
	clerkClaims, err := middleware.ValidateClerkToken(tokenString)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid Clerk token",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	clerkUserID := clerkClaims.Subject
	if clerkUserID == "" {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid Clerk token: missing subject",
			Error:   stringPtr("missing_subject"),
		})
		return
	}

	// 3. Look up user by clerk_id
	var userID uuid.UUID
	var user models.User
	var locIDNullable sql.NullString
	var clerkID sql.NullString
	err = h.db.QueryRow(`
		SELECT id, username, email, first_name, last_name, role, is_active, org_id, location_id, clerk_id, COALESCE(auth_provider, 'internal'), created_at, updated_at
		FROM users WHERE clerk_id = $1 AND is_active = true
	`, clerkUserID).Scan(
		&user.ID, &user.Username, &user.Email,
		&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
		&user.OrgID, &locIDNullable, &clerkID, &user.AuthProvider,
		&user.CreatedAt, &user.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		// 4a. Try to find user by email (they may have been invited but haven't synced their clerk_id yet)
		log.Printf("Clerk session: no user found for clerk_id=%s, checking by email...", clerkUserID)

		// Fetch Clerk user email from API
		clerkSecretKey := os.Getenv("CLERK_SECRET_KEY")
		if clerkSecretKey != "" {
			clerkAPIURL := fmt.Sprintf("https://api.clerk.com/v1/users/%s", clerkUserID)
			req, _ := http.NewRequest("GET", clerkAPIURL, nil)
			req.Header.Set("Authorization", "Bearer "+clerkSecretKey)
			client := &http.Client{Timeout: 10 * time.Second}
			resp, err := client.Do(req)
			if err == nil && resp.StatusCode == http.StatusOK {
				defer resp.Body.Close()
				var clerkUser struct {
					EmailAddresses []struct {
						EmailAddress string `json:"email_address"`
					} `json:"email_addresses"`
				}
				json.NewDecoder(resp.Body).Decode(&clerkUser)

				if len(clerkUser.EmailAddresses) > 0 {
					email := clerkUser.EmailAddresses[0].EmailAddress
					log.Printf("Clerk user email: %s, attempting to sync existing user...", email)

					// Try to update existing user's clerk_id
					var existingUserID uuid.UUID
					err = h.db.QueryRow(`
						UPDATE users SET clerk_id = $1, auth_provider = 'clerk', updated_at = CURRENT_TIMESTAMP
						WHERE email = $2 AND clerk_id IS NULL AND is_active = true
						RETURNING id
					`, clerkUserID, email).Scan(&existingUserID)

					if err == nil {
						log.Printf("✅ Synced clerk_id for existing user: %s (email: %s)", existingUserID, email)
						// Re-fetch the updated user
						err = h.db.QueryRow(`
							SELECT id, username, email, first_name, last_name, role, is_active, org_id, location_id, clerk_id, COALESCE(auth_provider, 'internal'), created_at, updated_at
							FROM users WHERE id = $1
						`, existingUserID).Scan(
							&user.ID, &user.Username, &user.Email,
							&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
							&user.OrgID, &locIDNullable, &clerkID, &user.AuthProvider,
							&user.CreatedAt, &user.UpdatedAt,
						)
						if err == nil {
							goto userFound // Skip auto-provisioning
						}
					}
				}
			}
		}

		// 4b. If still not found, auto-provision new user (for brand new signups)
		log.Printf("Clerk session: no existing user found, auto-provisioning new account...")
		provisionedUserID, provisionErr := h.autoProvisionClerkUser(clerkUserID)
		if provisionErr != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to provision account: " + provisionErr.Error(),
				Error:   stringPtr("provision_failed"),
			})
			return
		}

		// Re-fetch the newly created user
		err = h.db.QueryRow(`
			SELECT id, username, email, first_name, last_name, role, is_active, org_id, location_id, clerk_id, COALESCE(auth_provider, 'internal'), created_at, updated_at
			FROM users WHERE id = $1
		`, provisionedUserID).Scan(
			&user.ID, &user.Username, &user.Email,
			&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
			&user.OrgID, &locIDNullable, &clerkID, &user.AuthProvider,
			&user.CreatedAt, &user.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch provisioned user",
				Error:   stringPtr(err.Error()),
			})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}

userFound:
	userID = user.ID
	if locIDNullable.Valid {
		locUUID, _ := uuid.Parse(locIDNullable.String)
		user.LocationID = &locUUID
	}
	if clerkID.Valid {
		user.ClerkID = &clerkID.String
	}

	// 5. Fetch organization
	var org models.Organization
	h.db.QueryRow(`SELECT id, name, slug, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = $1`, user.OrgID).Scan(
		&org.ID, &org.Name, &org.Slug, &org.LogoURL, &org.IsActive, &org.CreatedAt, &org.UpdatedAt,
	)

	// 6. Fetch locations
	var locations []models.Location
	rows, err := h.db.Query(`
		SELECT l.id, l.org_id, l.name, l.code, l.address, l.phone, l.is_active, l.created_at, l.updated_at
		FROM locations l
		LEFT JOIN user_locations ul ON ul.location_id = l.id AND ul.user_id = $1
		WHERE l.org_id = $2 AND l.is_active = true
		ORDER BY ul.is_primary DESC NULLS LAST, l.name ASC
	`, userID, user.OrgID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var l models.Location
			if err := rows.Scan(&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt); err == nil {
				locations = append(locations, l)
			}
		}
	}

	if len(locations) == 0 && user.LocationID != nil {
		var l models.Location
		err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, *user.LocationID).Scan(
			&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
		)
		if err == nil {
			locations = []models.Location{l}
		}
	}

	var loc *models.Location
	if user.LocationID != nil {
		for i := range locations {
			if locations[i].ID == *user.LocationID {
				loc = &locations[i]
				break
			}
		}
	} else if len(locations) > 0 {
		loc = &locations[0]
	}

	// 7. Check if setup is complete for this org/location
	// Only admins/managers need to complete setup, staff members skip it
	needsSetup := false
	if user.Role == "admin" || user.Role == "manager" {
		needsSetup = true // Default to needing setup for admins
		var setupValue string
		locIDForSetup := uuid.Nil
		if loc != nil {
			locIDForSetup = loc.ID
		}
		err = h.db.QueryRow(`
			SELECT value FROM settings
			WHERE org_id = $1 AND location_id = $2 AND key = 'setup_complete'
		`, user.OrgID, locIDForSetup).Scan(&setupValue)
		if err == nil && setupValue == "true" {
			needsSetup = false
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Clerk session retrieved",
		Data: models.ClerkSessionResponse{
			LoginResponse: models.LoginResponse{
				Token:        "", // Frontend uses Clerk token, not internal JWT
				User:         user,
				Organization: &org,
				Location:     loc,
				Locations:    locations,
			},
			NeedsSetup: needsSetup,
		},
	})
}

// autoProvisionClerkUser fetches user details from Clerk Backend API and creates
// org + location + user in the database. Returns the new user ID.
func (h *ClerkWebhookHandler) autoProvisionClerkUser(clerkUserID string) (uuid.UUID, error) {
	// Fetch user details from Clerk Backend API
	clerkSecretKey := os.Getenv("CLERK_SECRET_KEY")
	if clerkSecretKey == "" {
		return uuid.Nil, fmt.Errorf("CLERK_SECRET_KEY not configured")
	}

	clerkAPIURL := fmt.Sprintf("https://api.clerk.com/v1/users/%s", clerkUserID)
	req, err := http.NewRequest("GET", clerkAPIURL, nil)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create Clerk API request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+clerkSecretKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to call Clerk API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return uuid.Nil, fmt.Errorf("Clerk API returned status %d: %s", resp.StatusCode, string(body))
	}

	var userData ClerkUserData
	if err := json.NewDecoder(resp.Body).Decode(&userData); err != nil {
		return uuid.Nil, fmt.Errorf("failed to decode Clerk user: %w", err)
	}

	// Extract fields
	email := ""
	if len(userData.EmailAddresses) > 0 {
		email = userData.EmailAddresses[0].EmailAddress
	}
	firstName := ""
	if userData.FirstName != nil {
		firstName = *userData.FirstName
	}
	lastName := ""
	if userData.LastName != nil {
		lastName = *userData.LastName
	}
	businessName := fmt.Sprintf("%s's Business", firstName)
	if name, ok := userData.UnsafeMetadata["business_name"].(string); ok && name != "" {
		businessName = name
	}

	slug := generateSlug(businessName)

	// Create org + location + user in a transaction
	tx, err := h.db.Begin()
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	orgID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO organizations (id, name, slug, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, orgID, businessName, slug)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create organization: %w", err)
	}

	locID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO locations (id, org_id, name, code, is_active, created_at, updated_at)
		VALUES ($1, $2, 'Main Location', 'MAIN', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, locID, orgID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create location: %w", err)
	}

	userID := uuid.New()
	username := generateUsername(email)
	randomPass := uuid.New().String()
	passHash, _ := bcrypt.GenerateFromPassword([]byte(randomPass), bcrypt.DefaultCost)

	_, err = tx.Exec(`
		INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active, org_id, location_id, clerk_id, auth_provider, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'admin', true, $7, $8, $9, 'clerk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, userID, username, email, string(passHash), firstName, lastName, orgID, locID, clerkUserID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to create user: %w", err)
	}

	tx.Exec(`INSERT INTO user_locations (user_id, location_id, is_primary) VALUES ($1, $2, true)`, userID, locID)
	tx.Exec(`
		INSERT INTO settings (org_id, location_id, key, value, created_at, updated_at)
		VALUES ($1, $2, 'setup_complete', 'false', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (org_id, location_id, key) DO NOTHING
	`, orgID, locID)

	if err := tx.Commit(); err != nil {
		return uuid.Nil, fmt.Errorf("failed to commit: %w", err)
	}

	log.Printf("Auto-provisioned Clerk user: org=%s user=%s clerk_id=%s email=%s", orgID, userID, clerkUserID, email)
	return userID, nil
}

// CompleteClerkSetupRequest represents the request body for completing Clerk user setup
type CompleteClerkSetupRequest struct {
	StoreName      string `json:"store_name"`
	LocationName   string `json:"location_name"`
	LocationCode   string `json:"location_code"`
	Currency       string `json:"currency"`
	CurrencySymbol string `json:"currency_symbol"`
	TaxRate        string `json:"tax_rate"`
	Pin            string `json:"pin"`
}

// CompleteClerkSetup lets a Clerk-authenticated user configure their store after auto-provisioning.
// It updates org name, location, settings, optional PIN, and marks setup_complete = true.
func (h *ClerkWebhookHandler) CompleteClerkSetup(c *gin.Context) {
	orgID, locID, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Missing org/location context",
			Error:   stringPtr("missing_context"),
		})
		return
	}

	userIDVal, _ := c.Get("user_id")
	userID, _ := userIDVal.(uuid.UUID)

	var req CompleteClerkSetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer tx.Rollback()

	// Update organization name
	if req.StoreName != "" {
		slug := generateSlug(req.StoreName)
		tx.Exec(`UPDATE organizations SET name = $1, slug = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
			req.StoreName, slug, orgID)
	}

	// Update location name and code
	if req.LocationName != "" || req.LocationCode != "" {
		if req.LocationName != "" && req.LocationCode != "" {
			tx.Exec(`UPDATE locations SET name = $1, code = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
				req.LocationName, req.LocationCode, locID)
		} else if req.LocationName != "" {
			tx.Exec(`UPDATE locations SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
				req.LocationName, locID)
		} else {
			tx.Exec(`UPDATE locations SET code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
				req.LocationCode, locID)
		}
	}

	// Upsert settings
	upsertSetting := func(key, value string) {
		if value == "" {
			return
		}
		tx.Exec(`
			INSERT INTO settings (org_id, location_id, key, value, created_at, updated_at)
			VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
		`, orgID, locID, key, value)
	}

	upsertSetting("restaurant_name", req.StoreName)
	upsertSetting("currency", req.Currency)
	upsertSetting("currency_symbol", req.CurrencySymbol)
	upsertSetting("tax_rate", req.TaxRate)

	// Hash and save PIN if provided
	if req.Pin != "" {
		hashedPin, err := bcrypt.GenerateFromPassword([]byte(req.Pin), bcrypt.DefaultCost)
		if err == nil {
			tx.Exec(`UPDATE users SET pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
				string(hashedPin), userID)
		}
	}

	// Mark setup as complete
	tx.Exec(`
		INSERT INTO settings (org_id, location_id, key, value, created_at, updated_at)
		VALUES ($1, $2, 'setup_complete', 'true', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP
	`, orgID, locID)

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to save setup",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	log.Printf("Clerk setup completed: org=%s location=%s user=%s", orgID, locID, userID)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Setup completed successfully",
	})
}

// verifySvixSignature verifies the Svix webhook signature
func verifySvixSignature(secret, msgID, timestamp, body, signatureHeader string) bool {
	// Secret comes as whsec_<base64> — strip prefix
	secretBytes := []byte(secret)
	if strings.HasPrefix(secret, "whsec_") {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_"))
		if err != nil {
			log.Printf("Failed to decode webhook secret: %v", err)
			return false
		}
		secretBytes = decoded
	}

	// Signature content: "{msg_id}.{timestamp}.{body}"
	signContent := fmt.Sprintf("%s.%s.%s", msgID, timestamp, body)

	mac := hmac.New(sha256.New, secretBytes)
	mac.Write([]byte(signContent))
	expectedSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// Signature header contains comma-separated "v1,<base64>" entries
	signatures := strings.Split(signatureHeader, " ")
	for _, sig := range signatures {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) == 2 && parts[0] == "v1" {
			if hmac.Equal([]byte(parts[1]), []byte(expectedSig)) {
				return true
			}
		}
	}

	return false
}

// generateSlug creates a URL-safe slug from a business name
func generateSlug(name string) string {
	slug := strings.ToLower(name)
	slug = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		if r == ' ' || r == '-' {
			return '-'
		}
		return -1
	}, slug)
	// Remove double hyphens
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	slug = strings.Trim(slug, "-")

	// Add timestamp suffix for uniqueness
	suffix := fmt.Sprintf("-%d", time.Now().Unix()%100000)
	return slug + suffix
}

// generateUsername creates a username from an email
func generateUsername(email string) string {
	parts := strings.Split(email, "@")
	username := parts[0]
	// Clean up
	username = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '.' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r + 32 // lowercase
		}
		return -1
	}, username)
	if username == "" {
		username = "user"
	}
	return username
}
