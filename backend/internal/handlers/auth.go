package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

// Login handles user authentication (password or PIN)
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Determine login mode: PIN or password
	if req.Pin != "" {
		h.loginWithPin(c, req.Pin)
		return
	}

	// Password login
	if req.Username == "" || req.Password == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Username and password are required",
			Error:   stringPtr("missing_credentials"),
		})
		return
	}

	var user models.User
	query := `
		SELECT id, username, email, password_hash, pin_hash, first_name, last_name, role, is_active, org_id, location_id, created_at, updated_at
		FROM users
		WHERE username = $1 AND is_active = true
	`

	var pinHash sql.NullString
	var locationID *uuid.UUID
	var locIDNullable sql.NullString
	err := h.db.QueryRow(query, req.Username).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &pinHash,
		&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
		&user.OrgID, &locIDNullable,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if pinHash.Valid {
		user.PinHash = &pinHash.String
	}
	if locIDNullable.Valid {
		locUUID, _ := uuid.Parse(locIDNullable.String)
		locationID = &locUUID
		user.LocationID = locationID
	}

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid username or password",
			Error:   stringPtr("invalid_credentials"),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid username or password",
			Error:   stringPtr("invalid_credentials"),
		})
		return
	}

	token, err := middleware.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to generate token",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch organization
	var org models.Organization
	h.db.QueryRow(`SELECT id, name, slug, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = $1`, user.OrgID).Scan(
		&org.ID, &org.Name, &org.Slug, &org.LogoURL, &org.IsActive, &org.CreatedAt, &org.UpdatedAt,
	)

	// Fetch all assigned locations
	userLocations := h.getUserLocations(user.ID, user.LocationID)

	// Fetch active location details
	var loc *models.Location
	if user.LocationID != nil {
		for i := range userLocations {
			if userLocations[i].ID == *user.LocationID {
				loc = &userLocations[i]
				break
			}
		}
		// Fallback: query directly if not found in junction table
		if loc == nil {
			var l models.Location
			err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, *user.LocationID).Scan(
				&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
			)
			if err == nil {
				loc = &l
			}
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Login successful",
		Data: models.LoginResponse{
			Token:        token,
			User:         user,
			Organization: &org,
			Location:     loc,
			Locations:    userLocations,
		},
	})
}

// loginWithPin handles PIN-based authentication
func (h *AuthHandler) loginWithPin(c *gin.Context, pin string) {
	if len(pin) != 4 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "PIN must be exactly 4 digits",
			Error:   stringPtr("invalid_pin"),
		})
		return
	}

	// Query all active users with a PIN set
	rows, err := h.db.Query(`
		SELECT id, username, email, password_hash, pin_hash, first_name, last_name, role, is_active, org_id, location_id, created_at, updated_at
		FROM users
		WHERE is_active = true AND pin_hash IS NOT NULL
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	// Iterate and bcrypt compare each
	for rows.Next() {
		var user models.User
		var pinHash sql.NullString
		var locIDNullable sql.NullString
		if err := rows.Scan(
			&user.ID, &user.Username, &user.Email, &user.PasswordHash, &pinHash,
			&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
			&user.OrgID, &locIDNullable,
			&user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			continue
		}
		if locIDNullable.Valid {
			locUUID, _ := uuid.Parse(locIDNullable.String)
			user.LocationID = &locUUID
		}
		if !pinHash.Valid {
			continue
		}

		if err := bcrypt.CompareHashAndPassword([]byte(pinHash.String), []byte(pin)); err == nil {
			// PIN matched — generate token
			user.PinHash = &pinHash.String
			token, err := middleware.GenerateToken(&user)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to generate token",
					Error:   stringPtr(err.Error()),
				})
				return
			}

			// Fetch organization
			var org models.Organization
			h.db.QueryRow(`SELECT id, name, slug, logo_url, is_active, created_at, updated_at FROM organizations WHERE id = $1`, user.OrgID).Scan(
				&org.ID, &org.Name, &org.Slug, &org.LogoURL, &org.IsActive, &org.CreatedAt, &org.UpdatedAt,
			)

			// Fetch all assigned locations
			userLocations := h.getUserLocations(user.ID, user.LocationID)

			// Fetch active location details
			var loc *models.Location
			if user.LocationID != nil {
				for i := range userLocations {
					if userLocations[i].ID == *user.LocationID {
						loc = &userLocations[i]
						break
					}
				}
				if loc == nil {
					var l models.Location
					err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, *user.LocationID).Scan(
						&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
					)
					if err == nil {
						loc = &l
					}
				}
			}

			c.JSON(http.StatusOK, models.APIResponse{
				Success: true,
				Message: "Login successful",
				Data: models.LoginResponse{
					Token:        token,
					User:         user,
					Organization: &org,
					Location:     loc,
					Locations:    userLocations,
				},
			})
			return
		}
	}

	c.JSON(http.StatusUnauthorized, models.APIResponse{
		Success: false,
		Message: "Invalid PIN",
		Error:   stringPtr("invalid_credentials"),
	})
}

// VerifyPin verifies the current user's PIN for action authorization
func (h *AuthHandler) VerifyPin(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var req struct {
		Pin string `json:"pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "PIN is required",
			Error:   stringPtr("missing_pin"),
		})
		return
	}

	var pinHash sql.NullString
	err := h.db.QueryRow("SELECT pin_hash FROM users WHERE id = $1", userID).Scan(&pinHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if !pinHash.Valid {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "PIN not set for this user",
			Error:   stringPtr("pin_not_set"),
		})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(pinHash.String), []byte(req.Pin)); err != nil {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Message: "Invalid PIN",
			Error:   stringPtr("invalid_pin"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "PIN verified",
	})
}

// PinStatus checks whether the current user has a PIN set
func (h *AuthHandler) PinStatus(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var pinHash sql.NullString
	err := h.db.QueryRow("SELECT pin_hash FROM users WHERE id = $1", userID).Scan(&pinHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "PIN status retrieved",
		Data:    map[string]bool{"has_pin": pinHash.Valid},
	})
}

// GetCurrentUser returns the current authenticated user
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var user models.User
	query := `
		SELECT id, username, email, first_name, last_name, role, is_active, org_id, location_id, created_at, updated_at
		FROM users
		WHERE id = $1
	`

	var locIDNullable sql.NullString
	err := h.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Username, &user.Email,
		&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
		&user.OrgID, &locIDNullable,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if locIDNullable.Valid {
		locUUID, _ := uuid.Parse(locIDNullable.String)
		user.LocationID = &locUUID
	}

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "User not found",
			Error:   stringPtr("user_not_found"),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "User retrieved successfully",
		Data:    user,
	})
}

// Logout handles user logout (in a stateless JWT system, this is mainly client-side)
func (h *AuthHandler) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Logout successful",
	})
}

// UpdatePin allows the current user to set or change their PIN
func (h *AuthHandler) UpdatePin(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var req struct {
		NewPin string `json:"new_pin" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "New PIN is required",
			Error:   stringPtr("missing_pin"),
		})
		return
	}

	if len(req.NewPin) != 4 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "PIN must be exactly 4 digits",
			Error:   stringPtr("invalid_pin"),
		})
		return
	}

	for _, ch := range req.NewPin {
		if ch < '0' || ch > '9' {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "PIN must contain only digits",
				Error:   stringPtr("invalid_pin"),
			})
			return
		}
	}

	hashedPin, err := bcrypt.GenerateFromPassword([]byte(req.NewPin), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to hash PIN",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	_, err = h.db.Exec("UPDATE users SET pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", string(hashedPin), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update PIN",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "PIN updated successfully",
	})
}

// getUserLocations fetches all active locations assigned to a user via the user_locations junction table.
// Falls back to the single users.location_id if no junction table entries exist.
func (h *AuthHandler) getUserLocations(userID uuid.UUID, singleLocationID *uuid.UUID) []models.Location {
	rows, err := h.db.Query(`
		SELECT l.id, l.org_id, l.name, l.code, l.address, l.phone, l.is_active, l.created_at, l.updated_at
		FROM locations l
		INNER JOIN user_locations ul ON ul.location_id = l.id
		WHERE ul.user_id = $1 AND l.is_active = true
		ORDER BY ul.is_primary DESC, l.name ASC
	`, userID)
	if err != nil {
		// If table doesn't exist yet, fall back silently
		if singleLocationID != nil {
			var l models.Location
			err2 := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1 AND is_active = true`, *singleLocationID).Scan(
				&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
			)
			if err2 == nil {
				return []models.Location{l}
			}
		}
		return []models.Location{}
	}
	defer rows.Close()

	var locations []models.Location
	for rows.Next() {
		var l models.Location
		if err := rows.Scan(&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt); err != nil {
			continue
		}
		locations = append(locations, l)
	}

	// Backward compat: if junction table is empty but user has location_id, return that
	if len(locations) == 0 && singleLocationID != nil {
		var l models.Location
		err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1 AND is_active = true`, *singleLocationID).Scan(
			&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
		)
		if err == nil {
			locations = []models.Location{l}
		}
	}

	return locations
}

// SwitchLocation allows a user to switch their active location
func (h *AuthHandler) SwitchLocation(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var req struct {
		LocationID string `json:"location_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "location_id is required",
			Error:   stringPtr("missing_location_id"),
		})
		return
	}

	locUUID, err := uuid.Parse(req.LocationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid location_id",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Verify user is assigned to this location
	var exists bool
	err = h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM user_locations WHERE user_id = $1 AND location_id = $2)`, userID, locUUID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusForbidden, models.APIResponse{
			Success: false,
			Message: "You are not assigned to this location",
			Error:   stringPtr("location_not_assigned"),
		})
		return
	}

	// Update user's active location
	_, err = h.db.Exec(`UPDATE users SET location_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, locUUID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to switch location",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch updated user to generate new token
	var user models.User
	var pinHash sql.NullString
	var locIDNullable sql.NullString
	err = h.db.QueryRow(`
		SELECT id, username, email, password_hash, pin_hash, first_name, last_name, role, is_active, org_id, location_id, created_at, updated_at
		FROM users WHERE id = $1
	`, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &pinHash,
		&user.FirstName, &user.LastName, &user.Role, &user.IsActive,
		&user.OrgID, &locIDNullable,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch user",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	if locIDNullable.Valid {
		parsed, _ := uuid.Parse(locIDNullable.String)
		user.LocationID = &parsed
	}

	// Generate new JWT with updated location
	token, err := middleware.GenerateToken(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to generate token",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch location details
	var loc models.Location
	h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, locUUID).Scan(
		&loc.ID, &loc.OrgID, &loc.Name, &loc.Code, &loc.Address, &loc.Phone, &loc.IsActive, &loc.CreatedAt, &loc.UpdatedAt,
	)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: fmt.Sprintf("Switched to %s", loc.Name),
		Data: map[string]interface{}{
			"token":    token,
			"location": loc,
		},
	})
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
