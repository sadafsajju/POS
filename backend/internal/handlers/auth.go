package handlers

import (
	"database/sql"
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

	// Fetch location if user has one
	var loc *models.Location
	if user.LocationID != nil {
		var l models.Location
		err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, *user.LocationID).Scan(
			&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
		)
		if err == nil {
			loc = &l
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

			// Fetch location if user has one
			var loc *models.Location
			if user.LocationID != nil {
				var l models.Location
				err := h.db.QueryRow(`SELECT id, org_id, name, code, address, phone, is_active, created_at, updated_at FROM locations WHERE id = $1`, *user.LocationID).Scan(
					&l.ID, &l.OrgID, &l.Name, &l.Code, &l.Address, &l.Phone, &l.IsActive, &l.CreatedAt, &l.UpdatedAt,
				)
				if err == nil {
					loc = &l
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
		c.JSON(http.StatusUnauthorized, models.APIResponse{
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

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
