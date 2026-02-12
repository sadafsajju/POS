package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	db *sql.DB
}

func NewPaymentHandler(db *sql.DB) *PaymentHandler {
	return &PaymentHandler{db: db}
}

// ProcessPayment processes a payment for an order
func (h *PaymentHandler) ProcessPayment(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	var req models.ProcessPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate payment method
	validMethods := []string{"cash", "credit_card", "debit_card", "digital_wallet"}
	isValidMethod := false
	for _, method := range validMethods {
		if req.PaymentMethod == method {
			isValidMethod = true
			break
		}
	}

	if !isValidMethod {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid payment method",
			Error:   stringPtr("invalid_payment_method"),
		})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Payment amount must be greater than zero",
			Error:   stringPtr("invalid_amount"),
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

	// Check if order exists and get total amount
	var orderTotalAmount float64
	var orderStatus string
	err = tx.QueryRow("SELECT total_amount, status FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3", orderID, orgID, locationID).Scan(&orderTotalAmount, &orderStatus)
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
			Message: "Failed to fetch order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Check if order is in a valid state for payment
	if orderStatus == "cancelled" || orderStatus == "completed" || orderStatus == "paid" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Order cannot be paid - order is " + orderStatus,
			Error:   stringPtr("invalid_order_status"),
		})
		return
	}

	// Check if order is already fully paid
	var totalPaid float64
	err = tx.QueryRow(`
		SELECT COALESCE(SUM(amount), 0) 
		FROM payments 
		WHERE order_id = $1 AND status = 'completed'
	`, orderID).Scan(&totalPaid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to calculate total payments",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if totalPaid >= orderTotalAmount {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Order is already fully paid",
			Error:   stringPtr("order_fully_paid"),
		})
		return
	}

	// Check if payment amount doesn't exceed remaining balance
	remainingAmount := orderTotalAmount - totalPaid
	if req.Amount > remainingAmount {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Payment amount exceeds remaining balance",
			Error:   stringPtr("amount_exceeds_balance"),
		})
		return
	}

	// Create payment record
	paymentID := uuid.New()
	now := time.Now()

	paymentQuery := `
		INSERT INTO payments (id, order_id, payment_method, amount, reference_number, status, processed_by, processed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	// Simulate payment processing
	paymentStatus := "completed"
	if req.PaymentMethod != "cash" {
		// For non-cash payments, we simulate processing
		// In a real system, this would integrate with payment processors
		paymentStatus = "completed" // Simulating successful processing
	}

	_, err = tx.Exec(paymentQuery, paymentID, orderID, req.PaymentMethod, req.Amount,
		req.ReferenceNumber, paymentStatus, userID, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create payment record",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Link customer to order if provided
	if req.CustomerID != nil && *req.CustomerID != "" {
		_, err = tx.Exec(`
			UPDATE orders
			SET customer_id = $1, customer_name = COALESCE($2, customer_name), updated_at = CURRENT_TIMESTAMP
			WHERE id = $3
		`, *req.CustomerID, req.CustomerName, orderID)
		if err != nil {
			// Non-fatal: log but continue
		}
	} else if req.CustomerName != nil && *req.CustomerName != "" {
		_, err = tx.Exec(`
			UPDATE orders
			SET customer_name = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2
		`, *req.CustomerName, orderID)
		if err != nil {
			// Non-fatal: log but continue
		}
	}

	// Check if order is now fully paid
	newTotalPaid := totalPaid + req.Amount
	if newTotalPaid >= orderTotalAmount {
		// Determine the order type to decide post-payment status
		var orderTypeStr string
		err = tx.QueryRow("SELECT COALESCE(order_type, 'dine_in') FROM orders WHERE id = $1", orderID).Scan(&orderTypeStr)
		if err != nil {
			orderTypeStr = "dine_in"
		}

		// For takeout/delivery: set status to 'confirmed' so kitchen can still see and prepare the order
		// For dine-in: set status to 'paid' (KOTs have their own kitchen statuses)
		newStatus := "paid"
		statusNote := "Order marked as paid after payment"
		if orderTypeStr == "takeout" || orderTypeStr == "delivery" {
			newStatus = "confirmed"
			statusNote = "Payment received, order sent to kitchen for preparation"
		}

		_, err = tx.Exec(`
			UPDATE orders
			SET status = $2, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, orderID, newStatus)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to update order status",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Log status change
		_, err = tx.Exec(`
			INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, notes)
			VALUES ($1, $2, $3, $4, $5)
		`, orderID, orderStatus, newStatus, userID, statusNote)
		if err != nil {
			// Log error but don't fail the transaction
		}
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit payment",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch the created payment
	payment, err := h.getPaymentByID(paymentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Payment processed but failed to fetch details",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Payment processed successfully",
		Data:    payment,
	})
}

// GetPayments retrieves payments for an order
func (h *PaymentHandler) GetPayments(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Check if order exists in this org/location
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3)", orderID, orgID, locationID).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check order existence",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order not found",
			Error:   stringPtr("order_not_found"),
		})
		return
	}

	// Fetch payments
	query := `
		SELECT p.id, p.payment_method, p.amount, p.reference_number, p.status, 
		       p.processed_by, p.processed_at, p.created_at,
		       u.username, u.first_name, u.last_name
		FROM payments p
		LEFT JOIN users u ON p.processed_by = u.id
		WHERE p.order_id = $1
		ORDER BY p.created_at DESC
	`

	rows, err := h.db.Query(query, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch payments",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		var username, firstName, lastName sql.NullString

		err := rows.Scan(
			&payment.ID, &payment.PaymentMethod, &payment.Amount, &payment.ReferenceNumber,
			&payment.Status, &payment.ProcessedBy, &payment.ProcessedAt, &payment.CreatedAt,
			&username, &firstName, &lastName,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan payment",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		payment.OrderID = orderID

		// Add processed by user info if available
		if username.Valid {
			payment.ProcessedByUser = &models.User{
				Username:  username.String,
				FirstName: firstName.String,
				LastName:  lastName.String,
			}
		}

		payments = append(payments, payment)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Payments retrieved successfully",
		Data:    payments,
	})
}

// GetPaymentSummary retrieves payment summary for an order
func (h *PaymentHandler) GetPaymentSummary(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Get order total and payment summary
	query := `
		SELECT
		    o.total_amount,
		    COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_paid,
		    COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as pending_amount,
		    COUNT(p.id) as payment_count
		FROM orders o
		LEFT JOIN payments p ON o.id = p.order_id
		WHERE o.id = $1 AND o.org_id = $2 AND o.location_id = $3
		GROUP BY o.id, o.total_amount
	`

	var totalAmount, totalPaid, pendingAmount float64
	var paymentCount int

	err = h.db.QueryRow(query, orderID, orgID, locationID).Scan(&totalAmount, &totalPaid, &pendingAmount, &paymentCount)
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
			Message: "Failed to fetch payment summary",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	remainingAmount := totalAmount - totalPaid
	isFullyPaid := remainingAmount <= 0

	summary := map[string]interface{}{
		"order_id":         orderID,
		"total_amount":     totalAmount,
		"total_paid":       totalPaid,
		"pending_amount":   pendingAmount,
		"remaining_amount": remainingAmount,
		"is_fully_paid":    isFullyPaid,
		"payment_count":    paymentCount,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Payment summary retrieved successfully",
		Data:    summary,
	})
}

// Helper functions

func (h *PaymentHandler) getPaymentByID(paymentID uuid.UUID) (*models.Payment, error) {
	var payment models.Payment
	var username, firstName, lastName sql.NullString

	query := `
		SELECT p.id, p.order_id, p.payment_method, p.amount, p.reference_number, p.status, 
		       p.processed_by, p.processed_at, p.created_at,
		       u.username, u.first_name, u.last_name
		FROM payments p
		LEFT JOIN users u ON p.processed_by = u.id
		WHERE p.id = $1
	`

	err := h.db.QueryRow(query, paymentID).Scan(
		&payment.ID, &payment.OrderID, &payment.PaymentMethod, &payment.Amount,
		&payment.ReferenceNumber, &payment.Status, &payment.ProcessedBy,
		&payment.ProcessedAt, &payment.CreatedAt,
		&username, &firstName, &lastName,
	)

	if err != nil {
		return nil, err
	}

	// Add processed by user info if available
	if username.Valid {
		payment.ProcessedByUser = &models.User{
			Username:  username.String,
			FirstName: firstName.String,
			LastName:  lastName.String,
		}
	}

	return &payment, nil
}

