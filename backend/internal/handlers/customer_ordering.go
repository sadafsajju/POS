package handlers

import (
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"pos-backend/internal/models"
	"github.com/google/uuid"
	"crypto/rand"
)

type CustomerOrderingHandler struct {
	db *sql.DB
}

func NewCustomerOrderingHandler(db *sql.DB) *CustomerOrderingHandler {
	return &CustomerOrderingHandler{db: db}
}

// generateSessionToken creates a secure random session token
func generateSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// InitSession creates a new customer session from QR code scan
// Public endpoint (no JWT required)
// POST /customer/session
func (h *CustomerOrderingHandler) InitSession(c *gin.Context) {
	var req struct {
		QRToken       string `json:"qr_token" binding:"required"`
		CustomerName  string `json:"customer_name"`
		CustomerPhone string `json:"customer_phone"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request",
			Error:   stringPtr("invalid_request"),
		})
		return
	}

	// Verify QR code is valid and active
	var qrCode struct {
		ID      string
		TableID string
	}
	err := h.db.QueryRow(`
		SELECT id, table_id
		FROM table_qr_codes
		WHERE qr_token = $1 AND is_active = true
	`, req.QRToken).Scan(&qrCode.ID, &qrCode.TableID)

	if err == sql.ErrNoRows {
		fmt.Printf("QR code not found or inactive: %s\n", req.QRToken)
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Invalid or expired QR code",
			Error:   stringPtr("invalid_qr_code"),
		})
		return
	}
	if err != nil {
		fmt.Printf("Database error looking up QR code: %v\n", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Database error",
			Error:   stringPtr("database_error"),
		})
		return
	}

	fmt.Printf("Found QR code: id=%s, table_id=%s\n", qrCode.ID, qrCode.TableID)

	// Update QR code scan stats
	_, _ = h.db.Exec(`
		UPDATE table_qr_codes
		SET last_scanned_at = CURRENT_TIMESTAMP,
		    scan_count = scan_count + 1
		WHERE id = $1
	`, qrCode.ID)

	// Check for existing active session for this table
	var existingSessionID string
	err = h.db.QueryRow(`
		SELECT id
		FROM customer_sessions
		WHERE table_id = $1
		  AND is_active = true
		  AND expires_at > CURRENT_TIMESTAMP
		ORDER BY created_at DESC
		LIMIT 1
	`, qrCode.TableID).Scan(&existingSessionID)

	if err == nil {
		// Return existing session
		session, table, err := h.getSessionData(existingSessionID)
		if err == nil {
			c.JSON(http.StatusOK, models.APIResponse{
				Success: true,
				Message: "Session resumed",
				Data: map[string]interface{}{
					"session": session,
					"table":   table,
					"restaurant_info": map[string]interface{}{
						"name": "Restaurant", // TODO: Get from settings
					},
				},
			})
			return
		}
	}

	// Create new session
	sessionToken, err := generateSessionToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to generate session token",
			Error:   stringPtr("token_generation_error"),
		})
		return
	}

	// Get session timeout from settings (default: 240 minutes)
	var timeoutMinutes int
	err = h.db.QueryRow(`
		SELECT COALESCE(value::int, 240)
		FROM settings
		WHERE key = 'customer_session_timeout_minutes'
	`).Scan(&timeoutMinutes)
	if err != nil {
		timeoutMinutes = 240 // Default 4 hours
	}

	sessionID := uuid.New().String()
	expiresAt := time.Now().Add(time.Duration(timeoutMinutes) * time.Minute)

	_, err = h.db.Exec(`
		INSERT INTO customer_sessions (
			id, table_id, session_token, expires_at,
			customer_name, customer_phone
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, sessionID, qrCode.TableID, sessionToken, expiresAt,
		nullString(req.CustomerName), nullString(req.CustomerPhone))

	if err != nil {
		fmt.Printf("Failed to create session: %v\n", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create session",
			Error:   stringPtr("session_creation_error"),
		})
		return
	}

	session, table, err := h.getSessionData(sessionID)
	if err != nil {
		fmt.Printf("Failed to fetch session data: %v\n", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch session data",
			Error:   stringPtr("data_fetch_error"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Session created",
		Data: map[string]interface{}{
			"session": session,
			"table":   table,
			"restaurant_info": map[string]interface{}{
				"name": "Restaurant", // TODO: Get from settings
			},
		},
	})
}

// GetMenu returns the menu for customer ordering
// Public endpoint (session token required)
// GET /customer/menu
func (h *CustomerOrderingHandler) GetMenu(c *gin.Context) {
	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Session token required",
			Error:   stringPtr("unauthorized"),
		})
		return
	}

	// Verify session and update last activity
	var sessionID string
	err := h.db.QueryRow(`
		UPDATE customer_sessions
		SET last_activity_at = CURRENT_TIMESTAMP
		WHERE session_token = $1
		  AND is_active = true
		  AND expires_at > CURRENT_TIMESTAMP
		RETURNING id
	`, sessionToken).Scan(&sessionID)

	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid or expired session",
			Error:   stringPtr("invalid_session"),
		})
		return
	}

	// Get all available products with categories
	rows, err := h.db.Query(`
		SELECT
			p.id, p.name, p.description, p.price, p.category_id,
			p.image_url, p.is_available, p.product_type,
			c.name as category_name
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		WHERE p.is_available = true
		ORDER BY c.sort_order, p.name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch menu",
			Error:   stringPtr("database_error"),
		})
		return
	}
	defer rows.Close()

	products := []map[string]interface{}{}
	for rows.Next() {
		var p struct {
			ID           string
			Name         string
			Description  sql.NullString
			Price        float64
			CategoryID   sql.NullString
			ImageURL     sql.NullString
			IsAvailable  bool
			ProductType  string
			CategoryName sql.NullString
		}

		err := rows.Scan(
			&p.ID, &p.Name, &p.Description, &p.Price, &p.CategoryID,
			&p.ImageURL, &p.IsAvailable, &p.ProductType, &p.CategoryName,
		)
		if err != nil {
			continue
		}

		product := map[string]interface{}{
			"id":           p.ID,
			"name":         p.Name,
			"price":        p.Price,
			"is_available": p.IsAvailable,
			"product_type": p.ProductType,
		}

		if p.Description.Valid {
			product["description"] = p.Description.String
		}
		if p.CategoryID.Valid {
			product["category_id"] = p.CategoryID.String
		}
		if p.CategoryName.Valid {
			product["category_name"] = p.CategoryName.String
		}
		if p.ImageURL.Valid {
			product["image_url"] = p.ImageURL.String
		}

		products = append(products, product)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Menu fetched successfully",
		Data:    products,
	})
}

// PlaceOrder creates an order from customer app
// Public endpoint (session token required)
// POST /customer/order
func (h *CustomerOrderingHandler) PlaceOrder(c *gin.Context) {
	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Session token required",
			Error:   stringPtr("unauthorized"),
		})
		return
	}

	var req struct {
		Items         []models.CreateOrderItem `json:"items" binding:"required"`
		Notes         string                   `json:"notes"`
		CustomerName  string                   `json:"customer_name"`
		CustomerPhone string                   `json:"customer_phone"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request",
			Error:   stringPtr("invalid_request"),
		})
		return
	}

	// Verify session and get table info
	var session struct {
		ID           string
		TableID      string
		CustomerName sql.NullString
		OrgID        string
		LocationID   string
	}

	// First update the session
	err := h.db.QueryRow(`
		UPDATE customer_sessions
		SET last_activity_at = CURRENT_TIMESTAMP
		WHERE session_token = $1
		  AND is_active = true
		  AND expires_at > CURRENT_TIMESTAMP
		RETURNING id, table_id, customer_name
	`, sessionToken).Scan(&session.ID, &session.TableID, &session.CustomerName)

	if err != nil {
		fmt.Printf("PlaceOrder - Session verification failed: %v\n", err)
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid or expired session",
			Error:   stringPtr("invalid_session"),
		})
		return
	}

	// Get org_id and location_id from the table
	err = h.db.QueryRow(`
		SELECT org_id, location_id FROM dining_tables WHERE id = $1
	`, session.TableID).Scan(&session.OrgID, &session.LocationID)

	if err != nil {
		fmt.Printf("PlaceOrder - Session verification failed: %v\n", err)
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid or expired session",
			Error:   stringPtr("invalid_session"),
		})
		return
	}
	fmt.Printf("PlaceOrder - Session verified: id=%s, table_id=%s\n", session.ID, session.TableID)

	// Update customer info if provided
	if req.CustomerName != "" || req.CustomerPhone != "" {
		_, _ = h.db.Exec(`
			UPDATE customer_sessions
			SET customer_name = COALESCE(NULLIF($1, ''), customer_name),
			    customer_phone = COALESCE(NULLIF($2, ''), customer_phone)
			WHERE id = $3
		`, req.CustomerName, req.CustomerPhone, session.ID)
	}

	// Begin transaction
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to start transaction",
			Error:   stringPtr("transaction_error"),
		})
		return
	}
	defer tx.Rollback()

	// Generate order number
	var orderNumber string
	err = tx.QueryRow(`
		SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
		FROM orders
		WHERE DATE(created_at) = CURRENT_DATE
	`).Scan(&orderNumber)
	if err != nil {
		orderNumber = "1"
	}
	orderNumber = fmt.Sprintf("ORD%s", orderNumber)

	// Calculate totals
	var subtotal float64
	for _, item := range req.Items {
		var price float64
		err = tx.QueryRow(`SELECT price FROM products WHERE id = $1`, item.ProductID).Scan(&price)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: fmt.Sprintf("Invalid product: %s", item.ProductID),
				Error:   stringPtr("invalid_product"),
			})
			return
		}
		subtotal += price * float64(item.Quantity)
	}

	taxAmount := 0.0 // TODO: Calculate from settings
	totalAmount := subtotal + taxAmount

	// Create order
	orderID := uuid.New().String()
	customerName := req.CustomerName
	if customerName == "" && session.CustomerName.Valid {
		customerName = session.CustomerName.String
	}

	_, err = tx.Exec(`
		INSERT INTO orders (
			id, order_number, table_id, order_type, status,
			subtotal, tax_amount, discount_amount, total_amount,
			notes, customer_name, order_source, session_id,
			org_id, location_id
		) VALUES ($1, $2, $3, 'dine_in', 'pending', $4, $5, 0, $6, $7, $8, 'kiosk', $9, $10, $11)
	`, orderID, orderNumber, session.TableID, subtotal, taxAmount, totalAmount,
		nullString(req.Notes), nullString(customerName), session.ID, session.OrgID, session.LocationID)

	if err != nil {
		fmt.Printf("PlaceOrder - Failed to create order: %v\n", err)
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create order",
			Error:   stringPtr("order_creation_error"),
		})
		return
	}
	fmt.Printf("PlaceOrder - Order created: id=%s, order_number=%s\n", orderID, orderNumber)

	// Add order items
	for _, item := range req.Items {
		var price float64
		err = tx.QueryRow(`SELECT price FROM products WHERE id = $1`, item.ProductID).Scan(&price)
		if err != nil {
			continue
		}

		itemTotal := price * float64(item.Quantity)
		itemID := uuid.New().String()

		var specialInstructions string
		if item.SpecialInstructions != nil {
			specialInstructions = *item.SpecialInstructions
		}

		_, err = tx.Exec(`
			INSERT INTO order_items (
				id, order_id, product_id, quantity, unit_price, total_price,
				special_instructions, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		`, itemID, orderID, item.ProductID, item.Quantity, price, itemTotal,
			nullString(specialInstructions))

		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to add order items",
				Error:   stringPtr("item_creation_error"),
			})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit order",
			Error:   stringPtr("commit_error"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Order placed successfully",
		Data: map[string]interface{}{
			"order_id":     orderID,
			"order_number": orderNumber,
			"total_amount": totalAmount,
		},
	})
}

// GetMyOrders returns all orders for the current session
// GET /customer/orders
func (h *CustomerOrderingHandler) GetMyOrders(c *gin.Context) {
	sessionToken := c.GetHeader("X-Session-Token")
	if sessionToken == "" {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Session token required",
			Error:   stringPtr("unauthorized"),
		})
		return
	}

	// Verify session
	var sessionID string
	err := h.db.QueryRow(`
		UPDATE customer_sessions
		SET last_activity_at = CURRENT_TIMESTAMP
		WHERE session_token = $1
		  AND is_active = true
		  AND expires_at > CURRENT_TIMESTAMP
		RETURNING id
	`, sessionToken).Scan(&sessionID)

	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Invalid or expired session",
			Error:   stringPtr("invalid_session"),
		})
		return
	}

	// Get orders for this session
	rows, err := h.db.Query(`
		SELECT
			id, order_number, status, total_amount,
			created_at, updated_at, notes
		FROM orders
		WHERE session_id = $1
		ORDER BY created_at DESC
	`, sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch orders",
			Error:   stringPtr("database_error"),
		})
		return
	}
	defer rows.Close()

	orders := []map[string]interface{}{}
	for rows.Next() {
		var o struct {
			ID          string
			OrderNumber string
			Status      string
			TotalAmount float64
			CreatedAt   time.Time
			UpdatedAt   time.Time
			Notes       sql.NullString
		}

		err := rows.Scan(&o.ID, &o.OrderNumber, &o.Status, &o.TotalAmount,
			&o.CreatedAt, &o.UpdatedAt, &o.Notes)
		if err != nil {
			continue
		}

		order := map[string]interface{}{
			"id":           o.ID,
			"order_number": o.OrderNumber,
			"status":       o.Status,
			"total_amount": o.TotalAmount,
			"created_at":   o.CreatedAt,
			"updated_at":   o.UpdatedAt,
		}

		if o.Notes.Valid {
			order["notes"] = o.Notes.String
		}

		// Get order items
		itemRows, err := h.db.Query(`
			SELECT
				oi.id, oi.product_id, oi.quantity, oi.unit_price,
				oi.total_price, oi.special_instructions, oi.status,
				p.name as product_name
			FROM order_items oi
			LEFT JOIN products p ON oi.product_id = p.id
			WHERE oi.order_id = $1
		`, o.ID)
		if err == nil {
			items := []map[string]interface{}{}
			for itemRows.Next() {
				var item struct {
					ID                   string
					ProductID            string
					Quantity             int
					UnitPrice            float64
					TotalPrice           float64
					SpecialInstructions  sql.NullString
					Status               string
					ProductName          string
				}

				err := itemRows.Scan(&item.ID, &item.ProductID, &item.Quantity,
					&item.UnitPrice, &item.TotalPrice, &item.SpecialInstructions,
					&item.Status, &item.ProductName)
				if err == nil {
					itemData := map[string]interface{}{
						"id":           item.ID,
						"product_id":   item.ProductID,
						"product_name": item.ProductName,
						"quantity":     item.Quantity,
						"unit_price":   item.UnitPrice,
						"total_price":  item.TotalPrice,
						"status":       item.Status,
					}
					if item.SpecialInstructions.Valid {
						itemData["special_instructions"] = item.SpecialInstructions.String
					}
					items = append(items, itemData)
				}
			}
			itemRows.Close()
			order["items"] = items
		}

		orders = append(orders, order)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Orders fetched successfully",
		Data:    orders,
	})
}

// Helper function to get session and table data
func (h *CustomerOrderingHandler) getSessionData(sessionID string) (map[string]interface{}, map[string]interface{}, error) {
	var s struct {
		ID              string
		TableID         string
		SessionToken    string
		StartedAt       time.Time
		ExpiresAt       time.Time
		LastActivityAt  time.Time
		IsActive        bool
		CustomerName    sql.NullString
		CustomerPhone   sql.NullString
		TableNumber     string
		TableCapacity   int
		TableStatus     string
	}

	err := h.db.QueryRow(`
		SELECT
			cs.id, cs.table_id, cs.session_token, cs.started_at,
			cs.expires_at, cs.last_activity_at, cs.is_active,
			cs.customer_name, cs.customer_phone,
			t.table_number, t.seating_capacity, t.status
		FROM customer_sessions cs
		LEFT JOIN dining_tables t ON cs.table_id = t.id
		WHERE cs.id = $1
	`, sessionID).Scan(
		&s.ID, &s.TableID, &s.SessionToken, &s.StartedAt,
		&s.ExpiresAt, &s.LastActivityAt, &s.IsActive,
		&s.CustomerName, &s.CustomerPhone,
		&s.TableNumber, &s.TableCapacity, &s.TableStatus,
	)

	if err != nil {
		return nil, nil, err
	}

	session := map[string]interface{}{
		"id":                s.ID,
		"table_id":          s.TableID,
		"session_token":     s.SessionToken,
		"started_at":        s.StartedAt,
		"expires_at":        s.ExpiresAt,
		"last_activity_at":  s.LastActivityAt,
		"is_active":         s.IsActive,
	}

	if s.CustomerName.Valid {
		session["customer_name"] = s.CustomerName.String
	}
	if s.CustomerPhone.Valid {
		session["customer_phone"] = s.CustomerPhone.String
	}

	table := map[string]interface{}{
		"id":           s.TableID,
		"table_number": s.TableNumber,
		"capacity":     s.TableCapacity,
		"status":       s.TableStatus,
	}

	return session, table, nil
}

// Helper function for nullable strings
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}
