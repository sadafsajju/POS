package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WebhookHandler struct {
	db *sql.DB
}

func NewWebhookHandler(db *sql.DB) *WebhookHandler {
	return &WebhookHandler{db: db}
}

// ReceiveOrder handles incoming order webhooks from aggregator platforms (Swiggy/Zomato)
func (h *WebhookHandler) ReceiveOrder(c *gin.Context) {
	platform := c.Param("platform")

	var req models.AggregatorOrderWebhook
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid webhook payload",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate platform matches
	if req.Platform != platform {
		req.Platform = platform
	}

	// Check for duplicate external order ID
	var existingID string
	err := h.db.QueryRow(
		"SELECT id FROM orders WHERE external_order_id = $1 AND order_source = $2",
		req.ExternalOrderID, platform,
	).Scan(&existingID)
	if err == nil {
		// Order already exists
		c.JSON(http.StatusConflict, models.APIResponse{
			Success: false,
			Message: "Order already exists",
			Error:   stringPtr("duplicate_order"),
			Data:    map[string]string{"order_id": existingID},
		})
		return
	}
	if err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check for duplicate order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to start transaction",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer tx.Rollback()

	// Generate order number
	orderID := uuid.New()
	orderNumber := fmt.Sprintf("%s%s%04d",
		platformPrefix(platform),
		time.Now().Format("20060102"),
		time.Now().UnixNano()%10000,
	)

	// Serialize external data
	var externalDataJSON *string
	if req.ExternalData != nil {
		data, err := json.Marshal(req.ExternalData)
		if err == nil {
			s := string(data)
			externalDataJSON = &s
		}
	}

	// Calculate accept deadline
	var acceptDeadline *time.Time
	if req.AcceptDeadlineMinutes > 0 {
		deadline := time.Now().Add(time.Duration(req.AcceptDeadlineMinutes) * time.Minute)
		acceptDeadline = &deadline
	}

	// Create the order
	orderQuery := `
		INSERT INTO orders (
			id, order_number, order_type, status,
			customer_name, subtotal, tax_amount, discount_amount, total_amount,
			notes, is_kot, order_source, external_order_id, external_data,
			delivery_partner_name, delivery_partner_phone, accept_deadline
		) VALUES (
			$1, $2, 'delivery', 'pending',
			$3, $4, $5, $6, $7,
			$8, false, $9, $10, $11,
			$12, $13, $14
		)
	`
	_, err = tx.Exec(orderQuery,
		orderID, orderNumber,
		req.CustomerName, req.Subtotal, req.TaxAmount, req.DiscountAmount, req.TotalAmount,
		req.Notes, platform, req.ExternalOrderID, externalDataJSON,
		req.DeliveryPartnerName, req.DeliveryPartnerPhone, acceptDeadline,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create aggregator order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Create order items
	for _, item := range req.Items {
		itemID := uuid.New()

		// Try to find the matching POS product by ID or name
		var productID *uuid.UUID
		if item.ProductID != nil {
			productID = item.ProductID
		}

		// If no product ID provided, try to match by name
		if productID == nil {
			var foundID uuid.UUID
			err := tx.QueryRow(
				"SELECT id FROM products WHERE name ILIKE $1 AND is_available = true LIMIT 1",
				item.Name,
			).Scan(&foundID)
			if err == nil {
				productID = &foundID
			}
		}

		// Use a fallback product ID if none found (create a placeholder)
		if productID == nil {
			// Use a nil UUID - the item will show the external product name
			placeholderID := uuid.Nil
			productID = &placeholderID
		}

		itemQuery := `
			INSERT INTO order_items (
				id, order_id, product_id, quantity, unit_price, total_price,
				special_instructions, status
			) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		`
		_, err = tx.Exec(itemQuery,
			itemID, orderID, productID, item.Quantity,
			item.UnitPrice, item.TotalPrice, item.SpecialInstructions,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create order item",
				Error:   stringPtr(err.Error()),
			})
			return
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Aggregator order received successfully",
		Data: map[string]interface{}{
			"order_id":          orderID.String(),
			"order_number":      orderNumber,
			"external_order_id": req.ExternalOrderID,
			"status":            "pending",
		},
	})
}

// ReceiveStatusUpdate handles status update webhooks from aggregator platforms
func (h *WebhookHandler) ReceiveStatusUpdate(c *gin.Context) {
	platform := c.Param("platform")

	var req models.AggregatorStatusUpdate
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid status update payload",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Find the order by external ID
	var orderID uuid.UUID
	err := h.db.QueryRow(
		"SELECT id FROM orders WHERE external_order_id = $1 AND order_source = $2",
		req.ExternalOrderID, platform,
	).Scan(&orderID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order not found",
			Error:   stringPtr("order_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to find order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Update delivery partner info if provided
	if req.DeliveryPartnerName != nil || req.DeliveryPartnerPhone != nil {
		_, err = h.db.Exec(`
			UPDATE orders
			SET delivery_partner_name = COALESCE($1, delivery_partner_name),
			    delivery_partner_phone = COALESCE($2, delivery_partner_phone),
			    updated_at = NOW()
			WHERE id = $3
		`, req.DeliveryPartnerName, req.DeliveryPartnerPhone, orderID)
		if err != nil {
			fmt.Printf("Warning: Failed to update delivery partner info: %v\n", err)
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Status update received",
		Data: map[string]interface{}{
			"order_id":          orderID.String(),
			"external_order_id": req.ExternalOrderID,
		},
	})
}

// ReceiveCancellation handles cancellation webhooks from aggregator platforms
func (h *WebhookHandler) ReceiveCancellation(c *gin.Context) {
	platform := c.Param("platform")

	var req struct {
		ExternalOrderID string  `json:"external_order_id" binding:"required"`
		Reason          *string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid cancellation payload",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Find and cancel the order
	var orderID uuid.UUID
	var currentStatus string
	err := h.db.QueryRow(
		"SELECT id, status FROM orders WHERE external_order_id = $1 AND order_source = $2",
		req.ExternalOrderID, platform,
	).Scan(&orderID, &currentStatus)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order not found",
			Error:   stringPtr("order_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to find order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Don't cancel already completed orders
	if currentStatus == "completed" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Cannot cancel a completed order",
			Error:   stringPtr("order_completed"),
		})
		return
	}

	// Cancel the order
	cancelNote := "Cancelled by platform"
	if req.Reason != nil {
		cancelNote = fmt.Sprintf("Cancelled by %s: %s", platform, *req.Reason)
	}

	_, err = h.db.Exec(`
		UPDATE orders
		SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || $1, updated_at = NOW()
		WHERE id = $2
	`, cancelNote, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to cancel order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Order cancelled successfully",
		Data: map[string]interface{}{
			"order_id":          orderID.String(),
			"external_order_id": req.ExternalOrderID,
		},
	})
}

// platformPrefix returns the order number prefix for a platform
func platformPrefix(platform string) string {
	switch platform {
	case "swiggy":
		return "SWG"
	case "zomato":
		return "ZMT"
	default:
		return "AGG"
	}
}

// stringPtr returns a pointer to a string
func stringPtr(s string) *string {
	return &s
}
