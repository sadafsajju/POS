package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"pos-backend/internal/models"
)

// generateQRToken creates a secure random token for QR codes
func generateQRToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

type QRCodeHandler struct {
	db *sql.DB
}

func NewQRCodeHandler(db *sql.DB) *QRCodeHandler {
	return &QRCodeHandler{db: db}
}

// GenerateQRCode creates a new QR code for a table
// POST /admin/qr-codes/generate
func (h *QRCodeHandler) GenerateQRCode(c *gin.Context) {
	var req struct {
		TableID      string `json:"table_id" binding:"required"`
		WifiSSID     string `json:"wifi_ssid"`
		WifiPassword string `json:"wifi_password"`
		POSHostname  string `json:"pos_hostname"`
		POSPort      string `json:"pos_port"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request",
			Error:   stringPtr("invalid_request"),
		})
		return
	}

	// Verify table exists
	var tableName string
	err := h.db.QueryRow(`SELECT table_number FROM dining_tables WHERE id = $1`, req.TableID).Scan(&tableName)
	if err == sql.ErrNoRows {
		log.Printf("Table not found: %s", req.TableID)
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Table not found",
			Error:   stringPtr("table_not_found"),
		})
		return
	}
	if err != nil {
		log.Printf("Database error checking table: %v", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr("database_error"),
		})
		return
	}

	// Get settings if not provided
	wifiSSID := req.WifiSSID
	wifiPassword := req.WifiPassword
	posHostname := req.POSHostname
	posPort := req.POSPort

	if wifiSSID == "" {
		h.db.QueryRow(`SELECT value FROM settings WHERE key = 'customer_wifi_ssid'`).Scan(&wifiSSID)
	}
	if wifiPassword == "" {
		h.db.QueryRow(`SELECT value FROM settings WHERE key = 'customer_wifi_password'`).Scan(&wifiPassword)
	}
	if posHostname == "" {
		h.db.QueryRow(`SELECT value FROM settings WHERE key = 'customer_pos_hostname'`).Scan(&posHostname)
		if posHostname == "" {
			posHostname = "pos.local"
		}
	}
	if posPort == "" {
		h.db.QueryRow(`SELECT value FROM settings WHERE key = 'customer_pos_port'`).Scan(&posPort)
		if posPort == "" {
			posPort = "3001" // Customer-web app port
		}
	}

	// Generate QR token
	qrToken, err := generateQRToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to generate token",
			Error:   stringPtr("token_generation_error"),
		})
		return
	}

	// Build URL
	var url string
	if posPort != "" && posPort != "80" && posPort != "443" {
		url = fmt.Sprintf("%s:%s/?qr=%s", posHostname, posPort, qrToken)
	} else {
		url = fmt.Sprintf("%s/?qr=%s", posHostname, qrToken)
	}

	// Ensure URL has protocol
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "https://" + url
	}

	// QR code contains just the URL (no WiFi)
	qrData := url

	// Get user ID from context
	userID, _ := c.Get("user_id")

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr("transaction_error"),
		})
		return
	}
	defer tx.Rollback()

	// Deactivate existing QR codes for this table
	_, err = tx.Exec(`
		UPDATE table_qr_codes
		SET is_active = false
		WHERE table_id = $1 AND is_active = true
	`, req.TableID)
	if err != nil {
		log.Printf("Failed to deactivate QR codes: %v", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to deactivate existing QR codes",
			Error:   stringPtr("update_error"),
		})
		return
	}

	// Create new QR code
	qrCodeID := uuid.New().String()
	log.Printf("Creating QR code: id=%s, table_id=%s, user_id=%v", qrCodeID, req.TableID, userID)
	_, err = tx.Exec(`
		INSERT INTO table_qr_codes (
			id, table_id, qr_token, qr_data, created_by
		) VALUES ($1, $2, $3, $4, $5)
	`, qrCodeID, req.TableID, qrToken, qrData, userID)

	if err != nil {
		log.Printf("Failed to create QR code: %v", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create QR code",
			Error:   stringPtr("creation_error"),
		})
		return
	}

	// Commit transaction
	if err = tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   stringPtr("commit_error"),
		})
		return
	}

	response := map[string]interface{}{
		"qr_code_id": qrCodeID,
		"qr_token":   qrToken,
		"table_id":   req.TableID,
		"table_name": tableName,
		"qr_data":    qrData,
		"url":        url,
	}

	if wifiSSID != "" {
		response["wifi_config"] = map[string]interface{}{
			"ssid":     wifiSSID,
			"password": wifiPassword,
			"security": "WPA",
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "QR code generated successfully",
		Data:    response,
	})
}

// GetQRCodes lists all QR codes
// GET /admin/qr-codes
func (h *QRCodeHandler) GetQRCodes(c *gin.Context) {
	tableID := c.Query("table_id")
	activeOnly := c.Query("active") == "true"

	query := `
		SELECT
			qr.id, qr.table_id, qr.qr_token, qr.qr_data,
			qr.is_active, qr.generated_at, qr.last_scanned_at,
			qr.scan_count, qr.created_at,
			t.table_number as table_name, t.table_number
		FROM table_qr_codes qr
		LEFT JOIN dining_tables t ON qr.table_id = t.id
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 1

	if tableID != "" {
		query += fmt.Sprintf(" AND qr.table_id = $%d", argCount)
		args = append(args, tableID)
		argCount++
	}

	if activeOnly {
		query += " AND qr.is_active = true"
	}

	query += " ORDER BY qr.generated_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch QR codes",
			Error:   stringPtr("database_error"),
		})
		return
	}
	defer rows.Close()

	qrCodes := []map[string]interface{}{}
	for rows.Next() {
		var qr struct {
			ID             string
			TableID        string
			QRToken        string
			QRData         string
			IsActive       bool
			GeneratedAt    sql.NullTime
			LastScannedAt  sql.NullTime
			ScanCount      int
			CreatedAt      sql.NullTime
			TableName      string
			TableNumber    int
		}

		err := rows.Scan(
			&qr.ID, &qr.TableID, &qr.QRToken, &qr.QRData,
			&qr.IsActive, &qr.GeneratedAt, &qr.LastScannedAt,
			&qr.ScanCount, &qr.CreatedAt,
			&qr.TableName, &qr.TableNumber,
		)
		if err != nil {
			continue
		}

		qrCode := map[string]interface{}{
			"id":           qr.ID,
			"table_id":     qr.TableID,
			"table_name":   qr.TableName,
			"table_number": qr.TableNumber,
			"qr_token":     qr.QRToken,
			"qr_data":      qr.QRData,
			"is_active":    qr.IsActive,
			"scan_count":   qr.ScanCount,
		}

		if qr.GeneratedAt.Valid {
			qrCode["generated_at"] = qr.GeneratedAt.Time
		}
		if qr.LastScannedAt.Valid {
			qrCode["last_scanned_at"] = qr.LastScannedAt.Time
		}
		if qr.CreatedAt.Valid {
			qrCode["created_at"] = qr.CreatedAt.Time
		}

		qrCodes = append(qrCodes, qrCode)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "QR codes fetched successfully",
		Data:    qrCodes,
	})
}

// DeactivateQRCode deactivates a QR code
// PUT /admin/qr-codes/:id/deactivate
func (h *QRCodeHandler) DeactivateQRCode(c *gin.Context) {
	qrCodeID := c.Param("id")

	result, err := h.db.Exec(`
		UPDATE table_qr_codes
		SET is_active = false
		WHERE id = $1
	`, qrCodeID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to deactivate QR code",
			Error:   stringPtr("update_error"),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "QR code not found",
			Error:   stringPtr("not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "QR code deactivated successfully",
	})
}

// GetCustomerSessions lists active customer sessions
// GET /admin/customer-sessions
func (h *QRCodeHandler) GetCustomerSessions(c *gin.Context) {
	activeOnly := c.Query("active") == "true"

	query := `
		SELECT
			cs.id, cs.table_id, cs.session_token, cs.started_at,
			cs.expires_at, cs.last_activity_at, cs.is_active,
			cs.customer_name, cs.customer_phone,
			t.table_number as table_name, t.table_number
		FROM customer_sessions cs
		LEFT JOIN dining_tables t ON cs.table_id = t.id
		WHERE 1=1
	`

	if activeOnly {
		query += " AND cs.is_active = true AND cs.expires_at > CURRENT_TIMESTAMP"
	}

	query += " ORDER BY cs.started_at DESC"

	rows, err := h.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch sessions",
			Error:   stringPtr("database_error"),
		})
		return
	}
	defer rows.Close()

	sessions := []map[string]interface{}{}
	for rows.Next() {
		var s struct {
			ID              string
			TableID         string
			SessionToken    string
			StartedAt       sql.NullTime
			ExpiresAt       sql.NullTime
			LastActivityAt  sql.NullTime
			IsActive        bool
			CustomerName    sql.NullString
			CustomerPhone   sql.NullString
			TableName       string
			TableNumber     int
		}

		err := rows.Scan(
			&s.ID, &s.TableID, &s.SessionToken, &s.StartedAt,
			&s.ExpiresAt, &s.LastActivityAt, &s.IsActive,
			&s.CustomerName, &s.CustomerPhone,
			&s.TableName, &s.TableNumber,
		)
		if err != nil {
			continue
		}

		session := map[string]interface{}{
			"id":           s.ID,
			"table_id":     s.TableID,
			"table_name":   s.TableName,
			"table_number": s.TableNumber,
			"is_active":    s.IsActive,
		}

		if s.StartedAt.Valid {
			session["started_at"] = s.StartedAt.Time
		}
		if s.ExpiresAt.Valid {
			session["expires_at"] = s.ExpiresAt.Time
		}
		if s.LastActivityAt.Valid {
			session["last_activity_at"] = s.LastActivityAt.Time
		}
		if s.CustomerName.Valid {
			session["customer_name"] = s.CustomerName.String
		}
		if s.CustomerPhone.Valid {
			session["customer_phone"] = s.CustomerPhone.String
		}

		sessions = append(sessions, session)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Sessions fetched successfully",
		Data:    sessions,
	})
}

// EndSession terminates a customer session
// PUT /admin/customer-sessions/:id/end
func (h *QRCodeHandler) EndSession(c *gin.Context) {
	sessionID := c.Param("id")

	result, err := h.db.Exec(`
		UPDATE customer_sessions
		SET is_active = false
		WHERE id = $1
	`, sessionID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to end session",
			Error:   stringPtr("update_error"),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Session not found",
			Error:   stringPtr("not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Session ended successfully",
	})
}
