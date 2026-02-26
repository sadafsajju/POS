package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrderHandler struct {
	db *sql.DB
}

func NewOrderHandler(db *sql.DB) *OrderHandler {
	return &OrderHandler{db: db}
}

// GetOrders retrieves all orders with pagination and filtering
func (h *OrderHandler) GetOrders(c *gin.Context) {
	// Parse query parameters
	page := 1
	perPage := 20
	status := c.Query("status")
	orderType := c.Query("order_type")
	dateFilter := c.Query("date") // "today" or YYYY-MM-DD

	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if perPageStr := c.Query("per_page"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= 100 {
			perPage = pp
		}
	}

	offset := (page - 1) * perPage

	// Build query with filters
	queryBuilder := `
		SELECT DISTINCT o.id, o.order_number, o.table_id, o.user_id, o.customer_name,
		       o.order_type, o.status, o.subtotal, o.tax_amount, o.discount_amount,
		       o.total_amount, o.notes, o.created_at, o.updated_at, o.served_at, o.completed_at,
		       o.confirmed_at, o.preparing_at, o.ready_at, o.paid_at, o.cleared_at,
		       o.is_kot, o.parent_order_id, o.token_number,
		       t.table_number, t.location,
		       u.username, u.first_name, u.last_name
		FROM orders o
		LEFT JOIN dining_tables t ON o.table_id = t.id
		LEFT JOIN users u ON o.user_id = u.id
		WHERE 1=1
	`

	var args []interface{}
	argIndex := 0

	// Scope to org/location
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}
	argIndex++
	queryBuilder += fmt.Sprintf(" AND o.org_id = $%d", argIndex)
	args = append(args, orgID)
	argIndex++
	queryBuilder += fmt.Sprintf(" AND o.location_id = $%d", argIndex)
	args = append(args, locationID)

	if status != "" {
		argIndex++
		queryBuilder += fmt.Sprintf(" AND o.status = $%d", argIndex)
		args = append(args, status)
	}

	if orderType != "" {
		argIndex++
		queryBuilder += fmt.Sprintf(" AND o.order_type = $%d", argIndex)
		args = append(args, orderType)
	}

	if dateFilter != "" {
		if dateFilter == "today" {
			queryBuilder += " AND o.created_at >= CURRENT_DATE"
		} else {
			// Expect YYYY-MM-DD
			argIndex++
			queryBuilder += fmt.Sprintf(" AND o.created_at >= $%d::date AND o.created_at < ($%d::date + interval '1 day')", argIndex, argIndex)
			args = append(args, dateFilter)
		}
	}

	// Count total records
	countQuery := "SELECT COUNT(*) FROM (" + queryBuilder + ") as count_query"
	var total int
	if err := h.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to count orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Add ordering and pagination
	argIndex++
	queryBuilder += fmt.Sprintf(" ORDER BY o.created_at DESC LIMIT $%d", argIndex)
	args = append(args, perPage)
	
	argIndex++
	queryBuilder += fmt.Sprintf(" OFFSET $%d", argIndex)
	args = append(args, offset)

	rows, err := h.db.Query(queryBuilder, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var order models.Order
		var tableNumber, tableLocation sql.NullString
		var username, firstName, lastName sql.NullString
		var scanTokenNumber sql.NullInt64

		err := rows.Scan(
			&order.ID, &order.OrderNumber, &order.TableID, &order.UserID, &order.CustomerName,
			&order.OrderType, &order.Status, &order.Subtotal, &order.TaxAmount, &order.DiscountAmount,
			&order.TotalAmount, &order.Notes, &order.CreatedAt, &order.UpdatedAt, &order.ServedAt, &order.CompletedAt,
			&order.ConfirmedAt, &order.PreparingAt, &order.ReadyAt, &order.PaidAt, &order.ClearedAt,
			&order.IsKOT, &order.ParentOrderID, &scanTokenNumber,
			&tableNumber, &tableLocation,
			&username, &firstName, &lastName,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan order",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		if scanTokenNumber.Valid {
			tn := int(scanTokenNumber.Int64)
			order.TokenNumber = &tn
		}

		// Add table info if available
		if tableNumber.Valid {
			order.Table = &models.DiningTable{
				TableNumber: tableNumber.String,
				Location:    &tableLocation.String,
			}
		}

		// Add user info if available
		if username.Valid {
			order.User = &models.User{
				Username:  username.String,
				FirstName: firstName.String,
				LastName:  lastName.String,
			}
		}

		// Load order items
		if err := h.loadOrderItems(&order); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to load order items",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		orders = append(orders, order)
	}

	totalPages := (total + perPage - 1) / perPage

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Success: true,
		Message: "Orders retrieved successfully",
		Data:    orders,
		Meta: models.MetaData{
			CurrentPage: page,
			PerPage:     perPage,
			Total:       total,
			TotalPages:  totalPages,
		},
	})
}

// GetOrder retrieves a specific order by ID
func (h *OrderHandler) GetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Verify order belongs to org/location
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3)", orderID, orgID, locationID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order not found",
			Error:   stringPtr("order_not_found"),
		})
		return
	}

	order, err := h.getOrderByID(orderID)
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

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Order retrieved successfully",
		Data:    order,
	})
}

// GetOrdersByCustomer retrieves all orders for a specific customer
func (h *OrderHandler) GetOrdersByCustomer(c *gin.Context) {
	customerID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid customer ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	page := 1
	perPage := 20

	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if perPageStr := c.Query("per_page"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 && pp <= 100 {
			perPage = pp
		}
	}

	offset := (page - 1) * perPage

	// Scope to org/location
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Count total orders for this customer
	var total int
	err = h.db.QueryRow("SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND org_id = $2 AND location_id = $3", customerID, orgID, locationID).Scan(&total)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to count orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch orders
	query := `
		SELECT o.id, o.order_number, o.table_id, o.user_id, o.customer_name,
		       o.order_type, o.status, o.subtotal, o.tax_amount, o.discount_amount,
		       o.total_amount, o.notes, o.created_at, o.updated_at, o.served_at, o.completed_at,
		       o.confirmed_at, o.preparing_at, o.ready_at, o.paid_at, o.cleared_at,
		       t.table_number, t.location,
		       u.username, u.first_name, u.last_name
		FROM orders o
		LEFT JOIN dining_tables t ON o.table_id = t.id
		LEFT JOIN users u ON o.user_id = u.id
		WHERE o.customer_id = $1 AND o.org_id = $2 AND o.location_id = $3
		ORDER BY o.created_at DESC
		LIMIT $4 OFFSET $5
	`

	rows, err := h.db.Query(query, customerID, orgID, locationID, perPage, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var order models.Order
		var tableNumber, tableLocation sql.NullString
		var username, firstName, lastName sql.NullString
		var servedAt, completedAt, confirmedAt, preparingAt, readyAt, paidAt, clearedAt sql.NullTime

		err := rows.Scan(
			&order.ID, &order.OrderNumber, &order.TableID, &order.UserID, &order.CustomerName,
			&order.OrderType, &order.Status, &order.Subtotal, &order.TaxAmount, &order.DiscountAmount,
			&order.TotalAmount, &order.Notes, &order.CreatedAt, &order.UpdatedAt, &servedAt, &completedAt,
			&confirmedAt, &preparingAt, &readyAt, &paidAt, &clearedAt,
			&tableNumber, &tableLocation,
			&username, &firstName, &lastName,
		)
		if err != nil {
			continue
		}

		if servedAt.Valid {
			order.ServedAt = &servedAt.Time
		}
		if completedAt.Valid {
			order.CompletedAt = &completedAt.Time
		}
		if confirmedAt.Valid {
			order.ConfirmedAt = &confirmedAt.Time
		}
		if preparingAt.Valid {
			order.PreparingAt = &preparingAt.Time
		}
		if readyAt.Valid {
			order.ReadyAt = &readyAt.Time
		}
		if paidAt.Valid {
			order.PaidAt = &paidAt.Time
		}
		if clearedAt.Valid {
			order.ClearedAt = &clearedAt.Time
		}

		if tableNumber.Valid {
			var loc *string
			if tableLocation.Valid {
				loc = &tableLocation.String
			}
			order.Table = &models.DiningTable{
				TableNumber: tableNumber.String,
				Location:    loc,
			}
		}

		if username.Valid {
			order.User = &models.User{
				Username:  username.String,
				FirstName: firstName.String,
				LastName:  lastName.String,
			}
		}

		// Load order items
		h.loadOrderItems(&order)

		orders = append(orders, order)
	}

	totalPages := (total + perPage - 1) / perPage

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Success: true,
		Message: "Customer orders retrieved successfully",
		Data:    orders,
		Meta: models.MetaData{
			CurrentPage: page,
			PerPage:     perPage,
			Total:       total,
			TotalPages:  totalPages,
		},
	})
}

// CreateOrder creates a new order
// For dine-in orders with CreateAsKOT=true, it creates a parent bill + KOT structure
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}

	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate request
	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Order must contain at least one item",
			Error:   stringPtr("empty_order"),
		})
		return
	}

	// Default order_source to 'pos' if not provided
	if req.OrderSource == "" {
		req.OrderSource = "pos"
	}
	validSources := map[string]bool{"pos": true, "kiosk": true, "swiggy": true, "zomato": true}
	if !validSources[req.OrderSource] {
		req.OrderSource = "pos"
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
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

	// Calculate totals for items (including option price adjustments)
	var subtotal float64
	for _, item := range req.Items {
		var price float64
		err := tx.QueryRow("SELECT price FROM products WHERE id = $1 AND is_available = true", item.ProductID).Scan(&price)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "Product not found or not available",
				Error:   stringPtr("product_not_found"),
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch product price",
				Error:   stringPtr(err.Error()),
			})
			return
		}
		// Include option price adjustments
		var optionAdjustment float64
		for _, opt := range item.SelectedOptions {
			optionAdjustment += opt.PriceAdjustment
		}
		// Include combo choice price adjustments
		for _, choice := range item.ComboChoices {
			optionAdjustment += choice.PriceAdjustment
		}
		subtotal += (price + optionAdjustment) * float64(item.Quantity)
	}

	taxRate := 0.10
	taxAmount := subtotal * taxRate
	totalAmount := subtotal + taxAmount

	// Determine if this should be KOT mode (dine-in with CreateAsKOT flag)
	isKOTMode := req.OrderType == "dine_in" && req.CreateAsKOT

	var orderID uuid.UUID
	var parentOrderID *uuid.UUID

	if isKOTMode {
		// KOT MODE: Create bill + KOT structure
		if req.ParentOrderID != nil {
			// Adding to existing bill
			parentOrderID = req.ParentOrderID

			// Verify parent bill exists and is active
			var parentStatus string
			var parentIsKOT bool
			err := tx.QueryRow("SELECT status, is_kot FROM orders WHERE id = $1", *parentOrderID).Scan(&parentStatus, &parentIsKOT)
			if err == sql.ErrNoRows {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: "Parent bill not found",
					Error:   stringPtr("parent_not_found"),
				})
				return
			}
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to verify parent bill",
					Error:   stringPtr(err.Error()),
				})
				return
			}
			if parentIsKOT {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: "Cannot add KOT to another KOT. Use the parent bill ID.",
					Error:   stringPtr("invalid_parent"),
				})
				return
			}
			if parentStatus == "completed" || parentStatus == "cancelled" {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: "Cannot add KOT to a closed bill",
					Error:   stringPtr("bill_closed"),
				})
				return
			}
		} else {
			// First KOT - create parent bill first
			billID := uuid.New()
			billNumber := h.generateBillNumber()

			// Generate daily token number for customer display
			billTokenNumber, tokenErr := h.generateTokenNumber(tx, orgID, locationID)
			if tokenErr != nil {
				billTokenNumber = 1
			}

			billQuery := `
				INSERT INTO orders (id, order_number, table_id, user_id, customer_id, customer_name, order_type, status,
				                   subtotal, tax_amount, discount_amount, total_amount, notes, is_kot, parent_order_id,
				                   org_id, location_id, token_number)
				VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 0, 0, 0, $8, false, NULL, $9, $10, $11)
			`
			_, err = tx.Exec(billQuery, billID, billNumber, req.TableID, userID, req.CustomerID, req.CustomerName,
				req.OrderType, req.Notes, orgID, locationID, billTokenNumber)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to create bill",
					Error:   stringPtr(err.Error()),
				})
				return
			}
			parentOrderID = &billID
		}

		// Generate KOT number
		kotNumber, err := h.generateKOTNumber(tx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to generate KOT number",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Create KOT order
		orderID = uuid.New()

		// Generate daily token number for KOT
		kotTokenNumber, tokenErr := h.generateTokenNumber(tx, orgID, locationID)
		if tokenErr != nil {
			kotTokenNumber = 1
		}

		kotQuery := `
			INSERT INTO orders (id, order_number, table_id, user_id, customer_id, customer_name, order_type, status,
			                   subtotal, tax_amount, discount_amount, total_amount, notes, is_kot, parent_order_id, kot_number,
			                   org_id, location_id, token_number, order_source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8, $9, 0, $10, $11, true, $12, $13, $14, $15, $16, $17)
		`
		_, err = tx.Exec(kotQuery, orderID, kotNumber, req.TableID, userID, req.CustomerID, req.CustomerName,
			req.OrderType, subtotal, taxAmount, totalAmount, req.Notes, parentOrderID, kotNumber, orgID, locationID, kotTokenNumber, req.OrderSource)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create KOT",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Update parent bill totals (aggregate all KOTs) and reset status if it was paid
		updateBillQuery := `
			UPDATE orders
			SET subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM orders WHERE parent_order_id = $1),
			    tax_amount = (SELECT COALESCE(SUM(tax_amount), 0) FROM orders WHERE parent_order_id = $1),
			    total_amount = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE parent_order_id = $1),
			    status = CASE WHEN status = 'paid' THEN 'confirmed' ELSE status END,
			    updated_at = NOW()
			WHERE id = $1
		`
		_, err = tx.Exec(updateBillQuery, parentOrderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to update bill totals",
				Error:   stringPtr(err.Error()),
			})
			return
		}
	} else {
		// LEGACY MODE: Single order (for takeout, delivery, or dine-in without KOT flag)
		orderID = uuid.New()
		orderNumber := h.generateOrderNumber()

		// Generate daily token number for customer display
		tokenNumber, tokenErr := h.generateTokenNumber(tx, orgID, locationID)
		if tokenErr != nil {
			tokenNumber = 1
		}

		// Determine initial status
		initialStatus := "confirmed"
		if req.Status != nil && *req.Status != "" {
			validStatuses := []string{"pending", "confirmed", "completed"}
			for _, s := range validStatuses {
				if *req.Status == s {
					initialStatus = s
					break
				}
			}
		}

		var completedAt interface{}
		if initialStatus == "completed" {
			completedAt = time.Now()
		}

		orderQuery := `
			INSERT INTO orders (id, order_number, table_id, user_id, customer_id, customer_name, order_type, status,
			                   subtotal, tax_amount, discount_amount, total_amount, notes, completed_at, is_kot, parent_order_id,
			                   org_id, location_id, token_number, order_source)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, false, NULL, $14, $15, $16, $17)
		`
		_, err = tx.Exec(orderQuery, orderID, orderNumber, req.TableID, userID, req.CustomerID, req.CustomerName,
			req.OrderType, initialStatus, subtotal, taxAmount, totalAmount, req.Notes, completedAt, orgID, locationID, tokenNumber, req.OrderSource)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create order",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Update customer stats if order is immediately completed (instant sale)
		if initialStatus == "completed" && req.CustomerID != nil {
			_, err = tx.Exec(`
				UPDATE customers
				SET total_orders = total_orders + 1,
				    total_spent = total_spent + $1,
				    last_order_at = NOW(),
				    updated_at = NOW()
				WHERE id = $2
			`, totalAmount, *req.CustomerID)
			if err != nil {
				fmt.Printf("Warning: Failed to update customer stats: %v\n", err)
			}
		}
	}

	// Create order items (same for both modes)
	for _, item := range req.Items {
		var price float64
		err := tx.QueryRow("SELECT price FROM products WHERE id = $1", item.ProductID).Scan(&price)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch product price",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Include option price adjustments in unit price
		var optionAdjustment float64
		for _, opt := range item.SelectedOptions {
			optionAdjustment += opt.PriceAdjustment
		}
		// Include combo choice price adjustments
		for _, choice := range item.ComboChoices {
			optionAdjustment += choice.PriceAdjustment
		}
		unitPrice := price + optionAdjustment
		totalPrice := unitPrice * float64(item.Quantity)
		itemID := uuid.New()

		itemQuery := `
			INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price, special_instructions)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`
		_, err = tx.Exec(itemQuery, itemID, orderID, item.ProductID, item.Quantity, unitPrice, totalPrice, item.SpecialInstructions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create order item",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Insert order item options (denormalized snapshot)
		for _, opt := range item.SelectedOptions {
			_, err = tx.Exec(`
				INSERT INTO order_item_options (id, order_item_id, option_group_name, option_item_name, price_adjustment)
				VALUES ($1, $2, $3, $4, $5)
			`, uuid.New(), itemID, opt.OptionGroupName, opt.OptionItemName, opt.PriceAdjustment)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to save order item options",
					Error:   stringPtr(err.Error()),
				})
				return
			}
		}

		// Insert order item combo choices (denormalized snapshot)
		for _, choice := range item.ComboChoices {
			optionsJSON, _ := json.Marshal(choice.SelectedOptions)
			_, err = tx.Exec(`
				INSERT INTO order_item_combo_choices (id, order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, uuid.New(), itemID, choice.SlotName, choice.ProductID, choice.ProductName, choice.PriceAdjustment, string(optionsJSON))
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to save order item combo choices",
					Error:   stringPtr(err.Error()),
				})
				return
			}
		}
	}

	// Update table status if dine-in
	if req.OrderType == "dine_in" && req.TableID != nil {
		_, err = tx.Exec("UPDATE dining_tables SET is_occupied = true WHERE id = $1", *req.TableID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to update table status",
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

	// Fetch and return the created order (KOT or regular order)
	order, err := h.getOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Order created but failed to fetch details",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	message := "Order created successfully"
	if isKOTMode {
		message = "KOT created successfully"
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: message,
		Data:    order,
	})
}

// UpdateOrderStatus updates the status of an order
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
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

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	var req models.UpdateOrderStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate status
	validStatuses := []string{"pending", "confirmed", "preparing", "ready", "served", "completed", "cancelled"}
	isValidStatus := false
	for _, status := range validStatuses {
		if req.Status == status {
			isValidStatus = true
			break
		}
	}

	if !isValidStatus {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order status",
			Error:   stringPtr("invalid_status"),
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

	// Get current order status and type
	var currentStatus, orderType string
	err = tx.QueryRow("SELECT status, order_type FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3", orderID, orgID, locationID).Scan(&currentStatus, &orderType)
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
			Message: "Failed to fetch current order status",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Determine timestamp column for the new status
	var timestampCol string
	switch req.Status {
	case "confirmed":
		timestampCol = "confirmed_at"
	case "preparing":
		timestampCol = "preparing_at"
	case "ready":
		timestampCol = "ready_at"
	case "served":
		timestampCol = "served_at"
	case "completed":
		timestampCol = "completed_at"
	}

	// If order is already paid and being moved to served/ready/preparing,
	// only set the timestamp — don't change status away from 'paid'
	if currentStatus == "paid" && (req.Status == "served" || req.Status == "preparing" || req.Status == "ready") {
		if timestampCol != "" {
			_, err = tx.Exec(
				"UPDATE orders SET "+timestampCol+" = COALESCE("+timestampCol+", CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1",
				orderID,
			)
		}
	} else {
		// Normal status update
		updateQuery := "UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP"
		args := []interface{}{req.Status, orderID}
		if timestampCol != "" {
			updateQuery += ", " + timestampCol + " = COALESCE(" + timestampCol + ", CURRENT_TIMESTAMP)"
		}
		updateQuery += " WHERE id = $2"
		_, err = tx.Exec(updateQuery, args...)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update order status",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Log status change in history
	historyQuery := `
		INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by, notes)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err = tx.Exec(historyQuery, orderID, currentStatus, req.Status, userID, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to log status change",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// If cancelling a parent bill, also cancel all child KOTs
	if req.Status == "cancelled" {
		_, err = tx.Exec(`
			UPDATE orders
			SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
			WHERE parent_order_id = $1
			  AND is_kot = true
			  AND status NOT IN ('completed', 'cancelled')
		`, orderID)
		if err != nil {
			// Log but don't fail — child KOT cancellation is best-effort
			fmt.Printf("Warning: Failed to cancel child KOTs for order %s: %v\n", orderID, err)
		}
	}

	// NOTE: Table is never auto-freed by status changes.
	// Staff must explicitly "Clear Table" when the customer leaves.

	// Auto-complete takeout/delivery orders once served (no table to clear)
	if req.Status == "served" && (orderType == "takeout" || orderType == "delivery") {
		_, err = tx.Exec(
			"UPDATE orders SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1",
			orderID,
		)
		if err != nil {
			fmt.Printf("Warning: Failed to auto-complete %s order %s: %v\n", orderType, orderID, err)
		} else {
			// Log the auto-completion in history
			_, _ = tx.Exec(historyQuery, orderID, "served", "completed", userID, "Auto-completed: "+orderType+" order served")
		}
	}

	// If order is completed (explicitly or auto-completed), update customer stats
	isAutoCompleted := req.Status == "served" && (orderType == "takeout" || orderType == "delivery")
	if req.Status == "completed" || isAutoCompleted {
		var customerID *uuid.UUID
		var orderTotal float64
		err = tx.QueryRow("SELECT customer_id, total_amount FROM orders WHERE id = $1", orderID).Scan(&customerID, &orderTotal)
		if err == nil && customerID != nil {
			_, err = tx.Exec(`
				UPDATE customers
				SET total_orders = total_orders + 1,
				    total_spent = total_spent + $1,
				    last_order_at = NOW(),
				    updated_at = NOW()
				WHERE id = $2
			`, orderTotal, *customerID)
			if err != nil {
				fmt.Printf("Warning: Failed to update customer stats: %v\n", err)
			}
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

	// Fetch and return the updated order
	order, err := h.getOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Order updated but failed to fetch details",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Order status updated successfully",
		Data:    order,
	})
}

// Helper functions

func (h *OrderHandler) getOrderByID(orderID uuid.UUID) (*models.Order, error) {
	var order models.Order
	var tableNumber, tableLocation sql.NullString
	var username, firstName, lastName sql.NullString
	var customerPhone, customerName, customerEmail sql.NullString
	var customerTotalOrders sql.NullInt64
	var customerTotalSpent sql.NullFloat64
	var parentOrderID sql.NullString
	var kotNumber sql.NullString
	var orderSource sql.NullString
	var externalOrderID, externalData sql.NullString
	var deliveryPartnerName, deliveryPartnerPhone sql.NullString
	var aggregatorConfirmedAt sql.NullTime
	var acceptDeadline sql.NullTime
	var tokenNumber sql.NullInt64

	query := `
		SELECT o.id, o.order_number, o.table_id, o.user_id, o.customer_id, o.customer_name,
		       o.order_type, o.status, o.subtotal, o.tax_amount, o.discount_amount,
		       o.total_amount, o.notes, o.created_at, o.updated_at, o.served_at, o.completed_at,
		       o.confirmed_at, o.preparing_at, o.ready_at, o.paid_at, o.cleared_at,
		       o.parent_order_id, o.is_kot, o.kot_number,
		       o.order_source, o.external_order_id, o.external_data,
		       o.delivery_partner_name, o.delivery_partner_phone,
		       o.aggregator_confirmed_at, o.accept_deadline,
		       o.token_number,
		       t.table_number, t.location,
		       u.username, u.first_name, u.last_name,
		       c.phone, c.name, c.email, c.total_orders, c.total_spent
		FROM orders o
		LEFT JOIN dining_tables t ON o.table_id = t.id
		LEFT JOIN users u ON o.user_id = u.id
		LEFT JOIN customers c ON o.customer_id = c.id
		WHERE o.id = $1
	`

	err := h.db.QueryRow(query, orderID).Scan(
		&order.ID, &order.OrderNumber, &order.TableID, &order.UserID, &order.CustomerID, &order.CustomerName,
		&order.OrderType, &order.Status, &order.Subtotal, &order.TaxAmount, &order.DiscountAmount,
		&order.TotalAmount, &order.Notes, &order.CreatedAt, &order.UpdatedAt, &order.ServedAt, &order.CompletedAt,
		&order.ConfirmedAt, &order.PreparingAt, &order.ReadyAt, &order.PaidAt, &order.ClearedAt,
		&parentOrderID, &order.IsKOT, &kotNumber,
		&orderSource, &externalOrderID, &externalData,
		&deliveryPartnerName, &deliveryPartnerPhone,
		&aggregatorConfirmedAt, &acceptDeadline,
		&tokenNumber,
		&tableNumber, &tableLocation,
		&username, &firstName, &lastName,
		&customerPhone, &customerName, &customerEmail, &customerTotalOrders, &customerTotalSpent,
	)

	if err != nil {
		return nil, err
	}

	// Set KOT fields
	if parentOrderID.Valid {
		parentID, _ := uuid.Parse(parentOrderID.String)
		order.ParentOrderID = &parentID
	}
	if kotNumber.Valid {
		order.KOTNumber = &kotNumber.String
	}
	if tokenNumber.Valid {
		tn := int(tokenNumber.Int64)
		order.TokenNumber = &tn
	}

	// Set aggregator fields
	if orderSource.Valid {
		order.OrderSource = orderSource.String
	} else {
		order.OrderSource = "pos"
	}
	if externalOrderID.Valid {
		order.ExternalOrderID = &externalOrderID.String
	}
	if externalData.Valid {
		order.ExternalData = &externalData.String
	}
	if deliveryPartnerName.Valid {
		order.DeliveryPartnerName = &deliveryPartnerName.String
	}
	if deliveryPartnerPhone.Valid {
		order.DeliveryPartnerPhone = &deliveryPartnerPhone.String
	}
	if aggregatorConfirmedAt.Valid {
		order.AggregatorConfirmedAt = &aggregatorConfirmedAt.Time
	}
	if acceptDeadline.Valid {
		order.AcceptDeadline = &acceptDeadline.Time
	}

	// Add table info if available
	if tableNumber.Valid {
		order.Table = &models.DiningTable{
			TableNumber: tableNumber.String,
			Location:    &tableLocation.String,
		}
	}

	// Add user info if available
	if username.Valid {
		order.User = &models.User{
			Username:  username.String,
			FirstName: firstName.String,
			LastName:  lastName.String,
		}
	}

	// Add customer info if available
	if customerPhone.Valid && order.CustomerID != nil {
		order.Customer = &models.Customer{
			ID:          *order.CustomerID,
			Phone:       customerPhone.String,
			Name:        &customerName.String,
			Email:       &customerEmail.String,
			TotalOrders: int(customerTotalOrders.Int64),
			TotalSpent:  customerTotalSpent.Float64,
		}
	}

	// Load order items
	if err := h.loadOrderItems(&order); err != nil {
		return nil, err
	}

	// Load payments
	if err := h.loadOrderPayments(&order); err != nil {
		return nil, err
	}

	return &order, nil
}

func (h *OrderHandler) loadOrderItems(order *models.Order) error {
	query := `
		SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price, 
		       oi.special_instructions, oi.status, oi.created_at, oi.updated_at,
		       p.name, p.description, p.price, p.preparation_time
		FROM order_items oi
		JOIN products p ON oi.product_id = p.id
		WHERE oi.order_id = $1
		ORDER BY oi.created_at
	`

	rows, err := h.db.Query(query, order.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []models.OrderItem
	for rows.Next() {
		var item models.OrderItem
		var productName, productDescription string
		var productPrice float64
		var preparationTime int

		err := rows.Scan(
			&item.ID, &item.ProductID, &item.Quantity, &item.UnitPrice, &item.TotalPrice,
			&item.SpecialInstructions, &item.Status, &item.CreatedAt, &item.UpdatedAt,
			&productName, &productDescription, &productPrice, &preparationTime,
		)
		if err != nil {
			return err
		}

		item.OrderID = order.ID
		item.Product = &models.Product{
			ID:              item.ProductID,
			Name:            productName,
			Description:     &productDescription,
			Price:           productPrice,
			PreparationTime: preparationTime,
		}

		// Load options for this item
		options, err := h.loadOrderItemOptions(item.ID)
		if err != nil {
			return err
		}
		item.Options = options

		// Load combo choices for this item
		comboChoices, err := h.loadOrderItemComboChoices(item.ID)
		if err != nil {
			return err
		}
		item.ComboChoices = comboChoices

		items = append(items, item)
	}

	order.Items = items
	return nil
}

// loadOrderItemOptions loads the denormalized option snapshot for an order item
func (h *OrderHandler) loadOrderItemOptions(orderItemID uuid.UUID) ([]models.OrderItemOption, error) {
	query := `
		SELECT id, order_item_id, option_group_name, option_item_name, price_adjustment, created_at
		FROM order_item_options
		WHERE order_item_id = $1
		ORDER BY created_at
	`
	rows, err := h.db.Query(query, orderItemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var options []models.OrderItemOption
	for rows.Next() {
		var opt models.OrderItemOption
		err := rows.Scan(&opt.ID, &opt.OrderItemID, &opt.OptionGroupName, &opt.OptionItemName, &opt.PriceAdjustment, &opt.CreatedAt)
		if err != nil {
			return nil, err
		}
		options = append(options, opt)
	}
	return options, nil
}

// loadOrderItemComboChoices loads combo choices for an order item
func (h *OrderHandler) loadOrderItemComboChoices(orderItemID uuid.UUID) ([]models.OrderItemComboChoice, error) {
	query := `
		SELECT id, order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options, created_at
		FROM order_item_combo_choices
		WHERE order_item_id = $1
		ORDER BY created_at
	`
	rows, err := h.db.Query(query, orderItemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var choices []models.OrderItemComboChoice
	for rows.Next() {
		var choice models.OrderItemComboChoice
		err := rows.Scan(&choice.ID, &choice.OrderItemID, &choice.SlotName, &choice.ProductID,
			&choice.ProductName, &choice.PriceAdjustment, &choice.SelectedOptions, &choice.CreatedAt)
		if err != nil {
			return nil, err
		}
		choices = append(choices, choice)
	}
	return choices, nil
}

func (h *OrderHandler) loadOrderPayments(order *models.Order) error {
	query := `
		SELECT p.id, p.payment_method, p.amount, p.cash_received, p.change_amount,
		       p.reference_number, p.status,
		       p.processed_by, p.processed_at, p.created_at,
		       u.username, u.first_name, u.last_name
		FROM payments p
		LEFT JOIN users u ON p.processed_by = u.id
		WHERE p.order_id = $1
		ORDER BY p.created_at
	`

	rows, err := h.db.Query(query, order.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var payments []models.Payment
	for rows.Next() {
		var payment models.Payment
		var username, firstName, lastName sql.NullString

		err := rows.Scan(
			&payment.ID, &payment.PaymentMethod, &payment.Amount, &payment.CashReceived, &payment.ChangeAmount,
			&payment.ReferenceNumber, &payment.Status, &payment.ProcessedBy, &payment.ProcessedAt, &payment.CreatedAt,
			&username, &firstName, &lastName,
		)
		if err != nil {
			return err
		}

		payment.OrderID = order.ID

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

	order.Payments = payments
	return nil
}

func (h *OrderHandler) generateOrderNumber() string {
	timestamp := time.Now().Format("20060102")
	return fmt.Sprintf("ORD%s%04d", timestamp, time.Now().UnixNano()%10000)
}

// generateKOTNumber generates a sequential KOT number using the database sequence
func (h *OrderHandler) generateKOTNumber(tx *sql.Tx) (string, error) {
	var seqNum int
	err := tx.QueryRow("SELECT nextval('kot_number_seq')").Scan(&seqNum)
	if err != nil {
		// If sequence doesn't exist, create it
		_, createErr := tx.Exec("CREATE SEQUENCE IF NOT EXISTS kot_number_seq START 1")
		if createErr != nil {
			return "", fmt.Errorf("failed to create KOT sequence: %w", createErr)
		}
		// Retry getting the value
		err = tx.QueryRow("SELECT nextval('kot_number_seq')").Scan(&seqNum)
		if err != nil {
			return "", fmt.Errorf("failed to generate KOT number: %w", err)
		}
	}
	return fmt.Sprintf("KOT%03d", seqNum), nil
}

// AcceptAggregatorOrder accepts an incoming aggregator order and confirms it
func (h *OrderHandler) AcceptAggregatorOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Get the order and verify it's an aggregator order in pending status
	var orderSource, currentStatus string
	var acceptDeadline *time.Time
	err = h.db.QueryRow(
		"SELECT order_source, status, accept_deadline FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3",
		orderID, orgID, locationID,
	).Scan(&orderSource, &currentStatus, &acceptDeadline)
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

	if orderSource == "pos" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "This is not an aggregator order",
			Error:   stringPtr("not_aggregator_order"),
		})
		return
	}

	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Order is not in pending status",
			Error:   stringPtr("invalid_status"),
		})
		return
	}

	// Check if accept deadline has passed
	if acceptDeadline != nil && time.Now().After(*acceptDeadline) {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Accept deadline has passed",
			Error:   stringPtr("deadline_expired"),
		})
		return
	}

	// Accept the order - move to confirmed
	now := time.Now()
	_, err = h.db.Exec(`
		UPDATE orders
		SET status = 'confirmed',
		    confirmed_at = $1,
		    aggregator_confirmed_at = $1,
		    updated_at = $1
		WHERE id = $2
	`, now, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to accept order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch and return the updated order
	order, err := h.getOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "Order accepted but failed to fetch details",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Aggregator order accepted successfully",
		Data:    order,
	})
}

// RejectAggregatorOrder rejects an incoming aggregator order with a reason
func (h *OrderHandler) RejectAggregatorOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	var req models.RejectAggregatorOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Get the order and verify it's an aggregator order
	var orderSource, currentStatus string
	err = h.db.QueryRow(
		"SELECT order_source, status FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3",
		orderID, orgID, locationID,
	).Scan(&orderSource, &currentStatus)
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

	if orderSource == "pos" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "This is not an aggregator order",
			Error:   stringPtr("not_aggregator_order"),
		})
		return
	}

	if currentStatus != "pending" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Order is not in pending status",
			Error:   stringPtr("invalid_status"),
		})
		return
	}

	// Reject the order
	rejectNote := fmt.Sprintf("Rejected: %s", req.Reason)
	_, err = h.db.Exec(`
		UPDATE orders
		SET status = 'cancelled',
		    notes = COALESCE(notes || ' | ', '') || $1,
		    updated_at = NOW()
		WHERE id = $2
	`, rejectNote, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to reject order",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Aggregator order rejected",
		Data: map[string]interface{}{
			"order_id": orderID.String(),
			"reason":   req.Reason,
		},
	})
}

// GetAggregatorOrders returns orders from aggregator platforms with optional filtering
func (h *OrderHandler) GetAggregatorOrders(c *gin.Context) {
	status := c.Query("status")
	platform := c.Query("platform")

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	query := `
		SELECT o.id, o.order_number, o.order_type, o.status, o.customer_name,
		       o.subtotal, o.tax_amount, o.discount_amount, o.total_amount,
		       o.notes, o.created_at, o.updated_at,
		       o.order_source, o.external_order_id,
		       o.delivery_partner_name, o.delivery_partner_phone,
		       o.accept_deadline, o.aggregator_confirmed_at
		FROM orders o
		WHERE o.order_source != 'pos'
		  AND o.org_id = $1 AND o.location_id = $2
	`
	var args []interface{}
	args = append(args, orgID, locationID)
	argIdx := 2

	if status != "" {
		argIdx++
		query += fmt.Sprintf(" AND o.status = $%d", argIdx)
		args = append(args, status)
	}
	if platform != "" {
		argIdx++
		query += fmt.Sprintf(" AND o.order_source = $%d", argIdx)
		args = append(args, platform)
	}

	query += " ORDER BY o.created_at DESC LIMIT 50"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch aggregator orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var orders []map[string]interface{}
	for rows.Next() {
		var id, orderNumber, orderType, orderStatus string
		var customerName, notes sql.NullString
		var subtotal, taxAmount, discountAmount, totalAmount float64
		var createdAt, updatedAt time.Time
		var orderSource string
		var externalOrderID sql.NullString
		var deliveryPartnerName, deliveryPartnerPhone sql.NullString
		var acceptDeadline, aggregatorConfirmedAt sql.NullTime

		err := rows.Scan(
			&id, &orderNumber, &orderType, &orderStatus, &customerName,
			&subtotal, &taxAmount, &discountAmount, &totalAmount,
			&notes, &createdAt, &updatedAt,
			&orderSource, &externalOrderID,
			&deliveryPartnerName, &deliveryPartnerPhone,
			&acceptDeadline, &aggregatorConfirmedAt,
		)
		if err != nil {
			continue
		}

		order := map[string]interface{}{
			"id":                     id,
			"order_number":           orderNumber,
			"order_type":             orderType,
			"status":                 orderStatus,
			"customer_name":          customerName.String,
			"subtotal":               subtotal,
			"tax_amount":             taxAmount,
			"discount_amount":        discountAmount,
			"total_amount":           totalAmount,
			"notes":                  notes.String,
			"created_at":             createdAt,
			"updated_at":             updatedAt,
			"order_source":           orderSource,
			"external_order_id":      externalOrderID.String,
			"delivery_partner_name":  deliveryPartnerName.String,
			"delivery_partner_phone": deliveryPartnerPhone.String,
		}

		if acceptDeadline.Valid {
			order["accept_deadline"] = acceptDeadline.Time
		}
		if aggregatorConfirmedAt.Valid {
			order["aggregator_confirmed_at"] = aggregatorConfirmedAt.Time
		}

		// Load items
		itemRows, err := h.db.Query(`
			SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
			       oi.special_instructions, oi.status,
			       p.name as product_name
			FROM order_items oi
			LEFT JOIN products p ON oi.product_id = p.id
			WHERE oi.order_id = $1
			ORDER BY oi.created_at
		`, id)
		if err == nil {
			var items []map[string]interface{}
			for itemRows.Next() {
				var itemID, productID, itemStatus string
				var qty int
				var unitPrice, totalPrice float64
				var specialInstr, productName sql.NullString

				if scanErr := itemRows.Scan(
					&itemID, &productID, &qty, &unitPrice, &totalPrice,
					&specialInstr, &itemStatus, &productName,
				); scanErr == nil {
					items = append(items, map[string]interface{}{
						"id":                   itemID,
						"product_id":           productID,
						"quantity":             qty,
						"unit_price":           unitPrice,
						"total_price":          totalPrice,
						"special_instructions": specialInstr.String,
						"status":               itemStatus,
						"product": map[string]interface{}{
							"id":   productID,
							"name": productName.String,
						},
					})
				}
			}
			itemRows.Close()
			if items == nil {
				items = []map[string]interface{}{}
			}
			order["items"] = items
		} else {
			order["items"] = []map[string]interface{}{}
		}

		orders = append(orders, order)
	}

	if orders == nil {
		orders = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Aggregator orders retrieved successfully",
		Data:    orders,
	})
}

// generateTokenNumber generates a daily sequential token number for customer display
func (h *OrderHandler) generateTokenNumber(tx *sql.Tx, orgID, locationID uuid.UUID) (int, error) {
	var nextToken int
	err := tx.QueryRow(`
		SELECT COALESCE(MAX(token_number), 0) + 1
		FROM orders
		WHERE DATE(created_at) = CURRENT_DATE
		  AND org_id = $1 AND location_id = $2
	`, orgID, locationID).Scan(&nextToken)
	if err != nil {
		return 1, err
	}
	return nextToken, nil
}

// generateBillNumber generates a bill number for parent orders
func (h *OrderHandler) generateBillNumber() string {
	timestamp := time.Now().Format("20060102")
	return fmt.Sprintf("BILL%s%04d", timestamp, time.Now().UnixNano()%10000)
}

// AddItemsToOrder adds items to an existing order
func (h *OrderHandler) AddItemsToOrder(c *gin.Context) {
	orderIDStr := c.Param("id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_order_id"),
		})
		return
	}

	// Get user from context
	userID, _, _, ok := middleware.GetUserFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Authentication required",
			Error:   stringPtr("auth_required"),
		})
		return
	}
	_ = userID // User is authenticated

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Parse request body
	var req struct {
		Items []models.CreateOrderItem `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "No items provided",
			Error:   stringPtr("empty_items"),
		})
		return
	}

	// Check if order exists and is not completed/cancelled (scoped to org/location)
	var orderStatus string
	err = h.db.QueryRow("SELECT status FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3", orderID, orgID, locationID).Scan(&orderStatus)
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

	// Don't allow adding items to completed or cancelled orders
	if orderStatus == "completed" || orderStatus == "cancelled" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Cannot add items to a completed or cancelled order",
			Error:   stringPtr("order_closed"),
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

	// Calculate new items subtotal (including option price adjustments)
	var newItemsSubtotal float64
	for _, item := range req.Items {
		// Get product price
		var price float64
		err := tx.QueryRow("SELECT price FROM products WHERE id = $1 AND is_available = true", item.ProductID).Scan(&price)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "Product not found or not available",
				Error:   stringPtr("product_not_found"),
			})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch product price",
				Error:   stringPtr(err.Error()),
			})
			return
		}
		// Include option price adjustments
		var optionAdjustment float64
		for _, opt := range item.SelectedOptions {
			optionAdjustment += opt.PriceAdjustment
		}
		// Include combo choice price adjustments
		for _, choice := range item.ComboChoices {
			optionAdjustment += choice.PriceAdjustment
		}
		newItemsSubtotal += (price + optionAdjustment) * float64(item.Quantity)
	}

	// Create new order items (always separate entries so kitchen can track each addition)
	for _, item := range req.Items {
		var price float64
		err := tx.QueryRow("SELECT price FROM products WHERE id = $1", item.ProductID).Scan(&price)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch product price",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Include option price adjustments in unit price
		var optionAdjustment float64
		for _, opt := range item.SelectedOptions {
			optionAdjustment += opt.PriceAdjustment
		}
		// Include combo choice price adjustments
		for _, choice := range item.ComboChoices {
			optionAdjustment += choice.PriceAdjustment
		}
		unitPrice := price + optionAdjustment
		totalPrice := unitPrice * float64(item.Quantity)
		itemID := uuid.New()

		// Always create new item entry - kitchen needs to see each addition separately
		itemQuery := `
			INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price, special_instructions, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
		`

		_, err = tx.Exec(itemQuery, itemID, orderID, item.ProductID, item.Quantity, unitPrice, totalPrice, item.SpecialInstructions)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create order item",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Insert order item options (denormalized snapshot)
		for _, opt := range item.SelectedOptions {
			_, err = tx.Exec(`
				INSERT INTO order_item_options (id, order_item_id, option_group_name, option_item_name, price_adjustment)
				VALUES ($1, $2, $3, $4, $5)
			`, uuid.New(), itemID, opt.OptionGroupName, opt.OptionItemName, opt.PriceAdjustment)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to save order item options",
					Error:   stringPtr(err.Error()),
				})
				return
			}
		}

		// Insert order item combo choices (denormalized snapshot)
		for _, choice := range item.ComboChoices {
			optionsJSON, _ := json.Marshal(choice.SelectedOptions)
			_, err = tx.Exec(`
				INSERT INTO order_item_combo_choices (id, order_item_id, slot_name, product_id, product_name, price_adjustment, selected_options)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
			`, uuid.New(), itemID, choice.SlotName, choice.ProductID, choice.ProductName, choice.PriceAdjustment, string(optionsJSON))
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to save order item combo choices",
					Error:   stringPtr(err.Error()),
				})
				return
			}
		}
	}

	// Update order totals
	taxRate := 0.10
	newTaxAmount := newItemsSubtotal * taxRate

	updateQuery := `
		UPDATE orders
		SET subtotal = subtotal + $1,
		    tax_amount = tax_amount + $2,
		    total_amount = total_amount + $1 + $2,
		    updated_at = NOW()
		WHERE id = $3
	`
	_, err = tx.Exec(updateQuery, newItemsSubtotal, newTaxAmount, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update order totals",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// If order was already past confirmed, set back to confirmed so kitchen sees new items
	if orderStatus == "preparing" || orderStatus == "ready" || orderStatus == "served" {
		_, err = tx.Exec("UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1", orderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to update order status",
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

	// Fetch updated order
	order, err := h.getOrderByID(orderID)
	if err != nil {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "Items added but failed to fetch updated order",
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Items added to order successfully",
		Data:    order,
	})
}

// UpdateOrderItem updates the quantity or special instructions of an order item
func (h *OrderHandler) UpdateOrderItem(c *gin.Context) {
	orderIDStr := c.Param("id")
	itemIDStr := c.Param("item_id")

	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_order_id"),
		})
		return
	}

	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid item ID",
			Error:   stringPtr("invalid_item_id"),
		})
		return
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Parse request body
	var req struct {
		Quantity            *int    `json:"quantity"`
		SpecialInstructions *string `json:"special_instructions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Check if order exists and is editable (scoped to org/location)
	var orderStatus string
	err = h.db.QueryRow("SELECT status FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3", orderID, orgID, locationID).Scan(&orderStatus)
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

	if orderStatus == "completed" || orderStatus == "cancelled" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Cannot edit a completed or cancelled order",
			Error:   stringPtr("order_closed"),
		})
		return
	}

	// Get current item details
	var currentQuantity int
	var unitPrice float64
	err = h.db.QueryRow("SELECT quantity, unit_price FROM order_items WHERE id = $1 AND order_id = $2", itemID, orderID).Scan(&currentQuantity, &unitPrice)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order item not found",
			Error:   stringPtr("item_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch order item",
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

	newQuantity := currentQuantity
	if req.Quantity != nil {
		if *req.Quantity < 1 {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "Quantity must be at least 1. Use delete to remove items.",
				Error:   stringPtr("invalid_quantity"),
			})
			return
		}
		newQuantity = *req.Quantity
	}

	// Update item
	newTotalPrice := unitPrice * float64(newQuantity)
	updateItemQuery := `
		UPDATE order_items
		SET quantity = $1, total_price = $2, special_instructions = COALESCE($3, special_instructions), updated_at = NOW()
		WHERE id = $4 AND order_id = $5
	`
	_, err = tx.Exec(updateItemQuery, newQuantity, newTotalPrice, req.SpecialInstructions, itemID, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update order item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Recalculate order totals
	var newSubtotal float64
	err = tx.QueryRow("SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE order_id = $1", orderID).Scan(&newSubtotal)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to calculate order subtotal",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	taxRate := 0.10
	newTaxAmount := newSubtotal * taxRate
	newTotal := newSubtotal + newTaxAmount

	_, err = tx.Exec(`
		UPDATE orders
		SET subtotal = $1, tax_amount = $2, total_amount = $3, updated_at = NOW()
		WHERE id = $4
	`, newSubtotal, newTaxAmount, newTotal, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update order totals",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch updated order
	order, _ := h.getOrderByID(orderID)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Order item updated successfully",
		Data:    order,
	})
}

// RemoveOrderItem removes an item from an order
func (h *OrderHandler) RemoveOrderItem(c *gin.Context) {
	orderIDStr := c.Param("id")
	itemIDStr := c.Param("item_id")

	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid order ID",
			Error:   stringPtr("invalid_order_id"),
		})
		return
	}

	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid item ID",
			Error:   stringPtr("invalid_item_id"),
		})
		return
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Check if order exists and is editable, also get KOT info for cleanup (scoped to org/location)
	var orderStatus string
	var isKOT bool
	var parentOrderID sql.NullString
	var tableID sql.NullString
	err = h.db.QueryRow(`
		SELECT status, is_kot, parent_order_id, table_id
		FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3
	`, orderID, orgID, locationID).Scan(&orderStatus, &isKOT, &parentOrderID, &tableID)
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

	if orderStatus == "completed" || orderStatus == "cancelled" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Cannot edit a completed or cancelled order",
			Error:   stringPtr("order_closed"),
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

	// Delete the item
	result, err := tx.Exec("DELETE FROM order_items WHERE id = $1 AND order_id = $2", itemID, orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to remove order item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Order item not found",
			Error:   stringPtr("item_not_found"),
		})
		return
	}

	// Check if order has any remaining items
	var itemCount int
	err = tx.QueryRow("SELECT COUNT(*) FROM order_items WHERE order_id = $1", orderID).Scan(&itemCount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to count remaining items",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	var orderDeleted bool
	var parentBillDeleted bool
	if itemCount == 0 {
		// No items left - if it's a KOT, delete it completely; otherwise cancel it
		if isKOT {
			// Delete any payments associated with this KOT
			_, err = tx.Exec("DELETE FROM payments WHERE order_id = $1", orderID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to delete KOT payments",
					Error:   stringPtr(err.Error()),
				})
				return
			}

			// Delete the KOT order
			_, err = tx.Exec("DELETE FROM orders WHERE id = $1", orderID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to delete empty KOT",
					Error:   stringPtr(err.Error()),
				})
				return
			}
			orderDeleted = true

			// Check if parent bill has any remaining KOTs
			if parentOrderID.Valid {
				var remainingKOTs int
				err = tx.QueryRow(`
					SELECT COUNT(*) FROM orders
					WHERE parent_order_id = $1 AND is_kot = true
				`, parentOrderID.String).Scan(&remainingKOTs)
				if err != nil {
					c.JSON(http.StatusInternalServerError, models.APIResponse{
						Success: false,
						Message: "Failed to count remaining KOTs",
						Error:   stringPtr(err.Error()),
					})
					return
				}

				// If no remaining KOTs, delete the parent bill too
				if remainingKOTs == 0 {
					// Delete payments for parent bill
					_, err = tx.Exec("DELETE FROM payments WHERE order_id = $1", parentOrderID.String)
					if err != nil {
						c.JSON(http.StatusInternalServerError, models.APIResponse{
							Success: false,
							Message: "Failed to delete parent bill payments",
							Error:   stringPtr(err.Error()),
						})
						return
					}

					// Delete order items from parent bill (if any)
					_, err = tx.Exec("DELETE FROM order_items WHERE order_id = $1", parentOrderID.String)
					if err != nil {
						c.JSON(http.StatusInternalServerError, models.APIResponse{
							Success: false,
							Message: "Failed to delete parent bill items",
							Error:   stringPtr(err.Error()),
						})
						return
					}

					// Delete the parent bill
					_, err = tx.Exec("DELETE FROM orders WHERE id = $1", parentOrderID.String)
					if err != nil {
						c.JSON(http.StatusInternalServerError, models.APIResponse{
							Success: false,
							Message: "Failed to delete empty parent bill",
							Error:   stringPtr(err.Error()),
						})
						return
					}
					parentBillDeleted = true
				}
			}

			// Update table status if no other active orders exist
			if tableID.Valid {
				var otherOrderCount int
				err = tx.QueryRow(`
					SELECT COUNT(*) FROM orders
					WHERE table_id = $1 AND status NOT IN ('completed', 'cancelled')
				`, tableID.String).Scan(&otherOrderCount)
				if err == nil && otherOrderCount == 0 {
					_, _ = tx.Exec(`
						UPDATE dining_tables SET is_occupied = false, updated_at = CURRENT_TIMESTAMP
						WHERE id = $1
					`, tableID.String)
				}
			}
		} else {
			// Not a KOT, just cancel the order
			_, err = tx.Exec("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", orderID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to cancel empty order",
					Error:   stringPtr(err.Error()),
				})
				return
			}
		}
	} else {
		// Recalculate order totals
		var newSubtotal float64
		err = tx.QueryRow("SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE order_id = $1", orderID).Scan(&newSubtotal)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to calculate order subtotal",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		taxRate := 0.10
		newTaxAmount := newSubtotal * taxRate
		newTotal := newSubtotal + newTaxAmount

		_, err = tx.Exec(`
			UPDATE orders
			SET subtotal = $1, tax_amount = $2, total_amount = $3, updated_at = NOW()
			WHERE id = $4
		`, newSubtotal, newTaxAmount, newTotal, orderID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to update order totals",
				Error:   stringPtr(err.Error()),
			})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Build response based on what happened
	var message string
	var responseData interface{}

	if orderDeleted {
		// KOT was deleted - return a minimal object with cancelled status for frontend compatibility
		message = "KOT removed (no items remaining)"
		if parentBillDeleted {
			message = "KOT and bill removed (no items remaining)"
		}
		// Return a minimal order-like object so frontend knows to close the dialog
		responseData = map[string]interface{}{
			"id":     orderID.String(),
			"status": "cancelled",
		}
	} else if itemCount == 0 {
		// Order was cancelled (not deleted)
		message = "Order item removed and order cancelled (no items remaining)"
		order, _ := h.getOrderByID(orderID)
		responseData = order
	} else {
		// Normal case - order still has items
		message = "Order item removed successfully"
		order, _ := h.getOrderByID(orderID)
		responseData = order
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: message,
		Data:    responseData,
	})
}

// GetBillSummary returns a bill with all its KOTs aggregated
func (h *OrderHandler) GetBillSummary(c *gin.Context) {
	billID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid bill ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Verify bill belongs to org/location
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}
	var billExists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3)", billID, orgID, locationID).Scan(&billExists)
	if err != nil || !billExists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Bill not found",
			Error:   stringPtr("bill_not_found"),
		})
		return
	}

	// Get the bill
	bill, err := h.getOrderByID(billID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Bill not found",
			Error:   stringPtr("bill_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch bill",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Verify this is a bill (parent order), not a KOT
	if bill.IsKOT {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "This is a KOT, not a bill. Use the parent_order_id to get the bill summary.",
			Error:   stringPtr("not_a_bill"),
		})
		return
	}

	// Get all KOTs for this bill
	kots, err := h.getKOTsForBill(billID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch KOTs",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Calculate aggregated totals
	var totalItems int
	var aggregatedSubtotal, aggregatedTax, aggregatedDiscount, aggregatedTotal float64

	for _, kot := range kots {
		totalItems += len(kot.Items)
		aggregatedSubtotal += kot.Subtotal
		aggregatedTax += kot.TaxAmount
		aggregatedDiscount += kot.DiscountAmount
		aggregatedTotal += kot.TotalAmount
	}

	isBillClosed := bill.Status == "completed" || bill.Status == "cancelled"

	response := models.BillSummaryResponse{
		Bill:               *bill,
		KOTs:               kots,
		TotalItems:         totalItems,
		AggregatedSubtotal: aggregatedSubtotal,
		AggregatedTax:      aggregatedTax,
		AggregatedDiscount: aggregatedDiscount,
		AggregatedTotal:    aggregatedTotal,
		IsBillClosed:       isBillClosed,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Bill summary retrieved successfully",
		Data:    response,
	})
}

// GetActiveBillForTable returns the active bill for a specific table
func (h *OrderHandler) GetActiveBillForTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid table ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Get org/location context
	orgID, locationID, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Find active bill (parent order) for this table (scoped to org/location)
	var billID uuid.UUID
	query := `
		SELECT id FROM orders
		WHERE table_id = $1
		  AND is_kot = false
		  AND parent_order_id IS NULL
		  AND status NOT IN ('completed', 'cancelled')
		  AND org_id = $2 AND location_id = $3
		ORDER BY created_at DESC
		LIMIT 1
	`
	err = h.db.QueryRow(query, tableID, orgID, locationID).Scan(&billID)
	if err == sql.ErrNoRows {
		// No active bill found - return null (not an error)
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "No active bill for this table",
			Data:    nil,
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch active bill",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Get the bill with KOTs
	bill, err := h.getOrderByID(billID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch bill details",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	kots, err := h.getKOTsForBill(billID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch KOTs",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	var totalItems int
	var aggregatedSubtotal, aggregatedTax, aggregatedDiscount, aggregatedTotal float64

	for _, kot := range kots {
		totalItems += len(kot.Items)
		aggregatedSubtotal += kot.Subtotal
		aggregatedTax += kot.TaxAmount
		aggregatedDiscount += kot.DiscountAmount
		aggregatedTotal += kot.TotalAmount
	}

	// Query total paid amount for this bill
	var paidAmount float64
	err = h.db.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id = $1`, billID).Scan(&paidAmount)
	if err != nil {
		paidAmount = 0
	}

	response := models.BillSummaryResponse{
		Bill:               *bill,
		KOTs:               kots,
		TotalItems:         totalItems,
		AggregatedSubtotal: aggregatedSubtotal,
		AggregatedTax:      aggregatedTax,
		AggregatedDiscount: aggregatedDiscount,
		AggregatedTotal:    aggregatedTotal,
		PaidAmount:         paidAmount,
		IsBillClosed:       false,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Active bill retrieved successfully",
		Data:    response,
	})
}

// getKOTsForBill retrieves all KOTs for a given bill (parent order)
func (h *OrderHandler) getKOTsForBill(billID uuid.UUID) ([]models.Order, error) {
	query := `
		SELECT id FROM orders
		WHERE parent_order_id = $1
		  AND is_kot = true
		ORDER BY created_at ASC
	`
	rows, err := h.db.Query(query, billID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var kots []models.Order
	for rows.Next() {
		var kotID uuid.UUID
		if err := rows.Scan(&kotID); err != nil {
			return nil, err
		}

		kot, err := h.getOrderByID(kotID)
		if err != nil {
			return nil, err
		}
		kots = append(kots, *kot)
	}

	return kots, nil
}

