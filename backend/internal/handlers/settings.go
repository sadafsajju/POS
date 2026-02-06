package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SettingsHandler struct {
	db *sql.DB
}

func NewSettingsHandler(db *sql.DB) *SettingsHandler {
	return &SettingsHandler{db: db}
}

// Setting represents a single setting key-value pair
type Setting struct {
	Key         string  `json:"key"`
	Value       string  `json:"value"`
	Description *string `json:"description,omitempty"`
}

// SettingsResponse represents all settings as a map
type SettingsResponse struct {
	RestaurantName    string `json:"restaurant_name"`
	Currency          string `json:"currency"`
	CurrencySymbol    string `json:"currency_symbol"`
	TaxRate           string `json:"tax_rate"`
	ServiceCharge     string `json:"service_charge"`
	ReceiptHeader     string `json:"receipt_header"`
	ReceiptFooter     string `json:"receipt_footer"`
	NotificationEmail string `json:"notification_email"`
	BackupFrequency   string `json:"backup_frequency"`
	Theme             string `json:"theme"`
	Language          string `json:"language"`
}

// GetSettings retrieves all system settings
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	query := `SELECT key, value FROM settings`

	rows, err := h.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch settings",
			"error":   err.Error(),
		})
		return
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to scan settings",
				"error":   err.Error(),
			})
			return
		}
		settings[key] = value
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Settings retrieved successfully",
		"data":    settings,
	})
}

// UpdateSettings updates one or more settings
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
			"error":   err.Error(),
		})
		return
	}

	// Validate currency and set symbol
	if currency, ok := req["currency"]; ok {
		symbol := getCurrencySymbol(currency)
		req["currency_symbol"] = symbol
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to start transaction",
			"error":   err.Error(),
		})
		return
	}
	defer tx.Rollback()

	// Update each setting
	for key, value := range req {
		_, err := tx.Exec(`
			INSERT INTO settings (key, value)
			VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
		`, key, value)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to update setting: " + key,
				"error":   err.Error(),
			})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to commit transaction",
			"error":   err.Error(),
		})
		return
	}

	// Fetch and return updated settings
	h.GetSettings(c)
}

// GetSetting retrieves a single setting by key
func (h *SettingsHandler) GetSetting(c *gin.Context) {
	key := c.Param("key")

	var value string
	var description sql.NullString
	err := h.db.QueryRow(`SELECT value, description FROM settings WHERE key = $1`, key).Scan(&value, &description)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Setting not found",
			"error":   "setting_not_found",
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch setting",
			"error":   err.Error(),
		})
		return
	}

	setting := Setting{
		Key:   key,
		Value: value,
	}
	if description.Valid {
		setting.Description = &description.String
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Setting retrieved successfully",
		"data":    setting,
	})
}

// =============================================
// Platform Config CRUD (Aggregator Integration)
// =============================================

// GetPlatformConfigs retrieves all platform configurations
func (h *SettingsHandler) GetPlatformConfigs(c *gin.Context) {
	rows, err := h.db.Query(`
		SELECT id, platform, is_enabled, api_key, api_secret, webhook_secret,
		       restaurant_id, config_data, created_at, updated_at
		FROM platform_configs
		ORDER BY platform
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch platform configs",
			Error:   strPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var configs []models.PlatformConfig
	for rows.Next() {
		var config models.PlatformConfig
		err := rows.Scan(
			&config.ID, &config.Platform, &config.IsEnabled,
			&config.APIKey, &config.APISecret, &config.WebhookSecret,
			&config.RestaurantID, &config.ConfigData,
			&config.CreatedAt, &config.UpdatedAt,
		)
		if err != nil {
			continue
		}
		// Mask sensitive fields
		if config.APIKey != nil {
			masked := maskString(*config.APIKey)
			config.APIKey = &masked
		}
		if config.APISecret != nil {
			masked := maskString(*config.APISecret)
			config.APISecret = &masked
		}
		if config.WebhookSecret != nil {
			masked := maskString(*config.WebhookSecret)
			config.WebhookSecret = &masked
		}
		configs = append(configs, config)
	}

	if configs == nil {
		configs = []models.PlatformConfig{}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Platform configs retrieved successfully",
		Data:    configs,
	})
}

// GetPlatformConfig retrieves a single platform configuration
func (h *SettingsHandler) GetPlatformConfig(c *gin.Context) {
	platform := c.Param("platform")

	var config models.PlatformConfig
	err := h.db.QueryRow(`
		SELECT id, platform, is_enabled, api_key, api_secret, webhook_secret,
		       restaurant_id, config_data, created_at, updated_at
		FROM platform_configs
		WHERE platform = $1
	`, platform).Scan(
		&config.ID, &config.Platform, &config.IsEnabled,
		&config.APIKey, &config.APISecret, &config.WebhookSecret,
		&config.RestaurantID, &config.ConfigData,
		&config.CreatedAt, &config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Platform config not found",
			Error:   strPtr("not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch platform config",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Mask sensitive fields
	if config.APIKey != nil {
		masked := maskString(*config.APIKey)
		config.APIKey = &masked
	}
	if config.APISecret != nil {
		masked := maskString(*config.APISecret)
		config.APISecret = &masked
	}
	if config.WebhookSecret != nil {
		masked := maskString(*config.WebhookSecret)
		config.WebhookSecret = &masked
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Platform config retrieved successfully",
		Data:    config,
	})
}

// UpsertPlatformConfig creates or updates a platform configuration
func (h *SettingsHandler) UpsertPlatformConfig(c *gin.Context) {
	var req models.CreatePlatformConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Validate platform
	if req.Platform != "swiggy" && req.Platform != "zomato" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid platform. Must be 'swiggy' or 'zomato'",
			Error:   strPtr("invalid_platform"),
		})
		return
	}

	// Build upsert query dynamically to only update provided fields
	var configID uuid.UUID
	err := h.db.QueryRow("SELECT id FROM platform_configs WHERE platform = $1", req.Platform).Scan(&configID)

	if err == sql.ErrNoRows {
		// INSERT new config
		err = h.db.QueryRow(`
			INSERT INTO platform_configs (platform, is_enabled, api_key, api_secret, webhook_secret, restaurant_id, config_data)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id
		`, req.Platform, req.IsEnabled, req.APIKey, req.APISecret, req.WebhookSecret, req.RestaurantID, req.ConfigData).Scan(&configID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create platform config",
				Error:   strPtr(err.Error()),
			})
			return
		}

		c.JSON(http.StatusCreated, models.APIResponse{
			Success: true,
			Message: "Platform config created successfully",
			Data:    map[string]interface{}{"id": configID.String(), "platform": req.Platform},
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check existing config",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// UPDATE existing config
	updates := []string{"is_enabled = $1"}
	args := []interface{}{req.IsEnabled}
	argIdx := 1

	if req.APIKey != nil {
		argIdx++
		updates = append(updates, fmt.Sprintf("api_key = $%d", argIdx))
		args = append(args, *req.APIKey)
	}
	if req.APISecret != nil {
		argIdx++
		updates = append(updates, fmt.Sprintf("api_secret = $%d", argIdx))
		args = append(args, *req.APISecret)
	}
	if req.WebhookSecret != nil {
		argIdx++
		updates = append(updates, fmt.Sprintf("webhook_secret = $%d", argIdx))
		args = append(args, *req.WebhookSecret)
	}
	if req.RestaurantID != nil {
		argIdx++
		updates = append(updates, fmt.Sprintf("restaurant_id = $%d", argIdx))
		args = append(args, *req.RestaurantID)
	}
	if req.ConfigData != nil {
		argIdx++
		updates = append(updates, fmt.Sprintf("config_data = $%d", argIdx))
		args = append(args, *req.ConfigData)
	}

	argIdx++
	args = append(args, configID)

	query := fmt.Sprintf(`
		UPDATE platform_configs SET %s, updated_at = NOW()
		WHERE id = $%d
	`, strings.Join(updates, ", "), argIdx)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update platform config",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Platform config updated successfully",
		Data:    map[string]interface{}{"id": configID.String(), "platform": req.Platform},
	})
}

// DeletePlatformConfig deletes a platform configuration
func (h *SettingsHandler) DeletePlatformConfig(c *gin.Context) {
	platform := c.Param("platform")

	result, err := h.db.Exec("DELETE FROM platform_configs WHERE platform = $1", platform)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete platform config",
			Error:   strPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Platform config not found",
			Error:   strPtr("not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Platform config deleted successfully",
	})
}

// maskString masks a sensitive string, showing only first 4 and last 4 characters
func maskString(s string) string {
	if len(s) <= 8 {
		return "****"
	}
	return s[:4] + "****" + s[len(s)-4:]
}

// strPtr returns a pointer to a string
func strPtr(s string) *string {
	return &s
}

// getCurrencySymbol returns the symbol for a given currency code
func getCurrencySymbol(currency string) string {
	symbols := map[string]string{
		"USD": "$",
		"EUR": "€",
		"GBP": "£",
		"INR": "₹",
		"JPY": "¥",
		"CNY": "¥",
		"AUD": "A$",
		"CAD": "C$",
	}

	if symbol, ok := symbols[currency]; ok {
		return symbol
	}
	return currency // Fallback to currency code if symbol not found
}
