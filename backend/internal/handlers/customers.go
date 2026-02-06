package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CustomerHandler struct {
	db *sql.DB
}

func NewCustomerHandler(db *sql.DB) *CustomerHandler {
	return &CustomerHandler{db: db}
}

// GetCustomers retrieves all customers with pagination
func (h *CustomerHandler) GetCustomers(c *gin.Context) {
	page := 1
	perPage := 20
	search := c.Query("search")

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

	// Build query
	queryBuilder := `SELECT id, phone, name, email, address, notes, total_orders, total_spent, last_order_at, created_at, updated_at FROM customers WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM customers WHERE 1=1`

	var args []interface{}
	argIndex := 0

	if search != "" {
		argIndex++
		searchCondition := fmt.Sprintf(" AND (phone ILIKE $%d OR name ILIKE $%d)", argIndex, argIndex)
		queryBuilder += searchCondition
		countQuery += searchCondition
		args = append(args, "%"+search+"%")
	}

	// Count total
	var total int
	if err := h.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to count customers",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Add pagination
	argIndex++
	queryBuilder += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIndex)
	args = append(args, perPage)

	argIndex++
	queryBuilder += fmt.Sprintf(" OFFSET $%d", argIndex)
	args = append(args, offset)

	rows, err := h.db.Query(queryBuilder, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch customers",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var customer models.Customer
		err := rows.Scan(
			&customer.ID, &customer.Phone, &customer.Name, &customer.Email,
			&customer.Address, &customer.Notes, &customer.TotalOrders,
			&customer.TotalSpent, &customer.LastOrderAt, &customer.CreatedAt, &customer.UpdatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan customer",
				Error:   stringPtr(err.Error()),
			})
			return
		}
		customers = append(customers, customer)
	}

	totalPages := (total + perPage - 1) / perPage

	c.JSON(http.StatusOK, models.PaginatedResponse{
		Success: true,
		Message: "Customers retrieved successfully",
		Data:    customers,
		Meta: models.MetaData{
			CurrentPage: page,
			PerPage:     perPage,
			Total:       total,
			TotalPages:  totalPages,
		},
	})
}

// GetCustomerByID retrieves a customer by ID
func (h *CustomerHandler) GetCustomerByID(c *gin.Context) {
	customerID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid customer ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	customer, err := h.getCustomerByID(customerID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Customer not found",
			Error:   stringPtr("customer_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch customer",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Customer retrieved successfully",
		Data:    customer,
	})
}

// GetCustomerByPhone retrieves a customer by phone number
func (h *CustomerHandler) GetCustomerByPhone(c *gin.Context) {
	phone := c.Param("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Phone number is required",
			Error:   stringPtr("phone_required"),
		})
		return
	}

	// Normalize phone number (remove spaces, dashes)
	phone = normalizePhone(phone)

	var customer models.Customer
	query := `
		SELECT id, phone, name, email, address, notes, total_orders, total_spent, last_order_at, created_at, updated_at
		FROM customers WHERE phone = $1
	`

	err := h.db.QueryRow(query, phone).Scan(
		&customer.ID, &customer.Phone, &customer.Name, &customer.Email,
		&customer.Address, &customer.Notes, &customer.TotalOrders,
		&customer.TotalSpent, &customer.LastOrderAt, &customer.CreatedAt, &customer.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Customer not found",
			Error:   stringPtr("customer_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch customer",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Customer retrieved successfully",
		Data:    customer,
	})
}

// CreateCustomer creates a new customer
func (h *CustomerHandler) CreateCustomer(c *gin.Context) {
	var req models.CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Normalize phone number
	phone := normalizePhone(req.Phone)
	if phone == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Phone number is required",
			Error:   stringPtr("phone_required"),
		})
		return
	}

	// Check if customer with this phone already exists
	var existingID uuid.UUID
	err := h.db.QueryRow("SELECT id FROM customers WHERE phone = $1", phone).Scan(&existingID)
	if err == nil {
		// Customer exists, return existing customer
		customer, _ := h.getCustomerByID(existingID)
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "Customer already exists",
			Data:    customer,
		})
		return
	}
	if err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to check existing customer",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Create new customer
	customerID := uuid.New()
	query := `
		INSERT INTO customers (id, phone, name, email, address, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
	`

	_, err = h.db.Exec(query, customerID, phone, req.Name, req.Email, req.Address, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create customer",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	customer, _ := h.getCustomerByID(customerID)

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Customer created successfully",
		Data:    customer,
	})
}

// UpdateCustomer updates a customer
func (h *CustomerHandler) UpdateCustomer(c *gin.Context) {
	customerID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid customer ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var req models.UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Check if customer exists
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM customers WHERE id = $1)", customerID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Customer not found",
			Error:   stringPtr("customer_not_found"),
		})
		return
	}

	// Build update query dynamically
	updates := []string{}
	args := []interface{}{}
	argIndex := 0

	if req.Phone != nil {
		argIndex++
		updates = append(updates, fmt.Sprintf("phone = $%d", argIndex))
		args = append(args, normalizePhone(*req.Phone))
	}
	if req.Name != nil {
		argIndex++
		updates = append(updates, fmt.Sprintf("name = $%d", argIndex))
		args = append(args, *req.Name)
	}
	if req.Email != nil {
		argIndex++
		updates = append(updates, fmt.Sprintf("email = $%d", argIndex))
		args = append(args, *req.Email)
	}
	if req.Address != nil {
		argIndex++
		updates = append(updates, fmt.Sprintf("address = $%d", argIndex))
		args = append(args, *req.Address)
	}
	if req.Notes != nil {
		argIndex++
		updates = append(updates, fmt.Sprintf("notes = $%d", argIndex))
		args = append(args, *req.Notes)
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "No fields to update",
			Error:   stringPtr("empty_update"),
		})
		return
	}

	argIndex++
	args = append(args, customerID)

	query := fmt.Sprintf("UPDATE customers SET %s, updated_at = NOW() WHERE id = $%d",
		strings.Join(updates, ", "), argIndex)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update customer",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	customer, _ := h.getCustomerByID(customerID)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Customer updated successfully",
		Data:    customer,
	})
}

// SearchCustomers searches customers by name or phone
func (h *CustomerHandler) SearchCustomers(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Search query is required",
			Error:   stringPtr("query_required"),
		})
		return
	}

	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
			limit = l
		}
	}

	searchQuery := `
		SELECT id, phone, name, email, address, notes, total_orders, total_spent, last_order_at, created_at, updated_at
		FROM customers
		WHERE phone ILIKE $1 OR name ILIKE $1
		ORDER BY total_orders DESC, name ASC
		LIMIT $2
	`

	rows, err := h.db.Query(searchQuery, "%"+query+"%", limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to search customers",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var customer models.Customer
		err := rows.Scan(
			&customer.ID, &customer.Phone, &customer.Name, &customer.Email,
			&customer.Address, &customer.Notes, &customer.TotalOrders,
			&customer.TotalSpent, &customer.LastOrderAt, &customer.CreatedAt, &customer.UpdatedAt,
		)
		if err != nil {
			continue
		}
		customers = append(customers, customer)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Search completed",
		Data:    customers,
	})
}

// Helper functions

func (h *CustomerHandler) getCustomerByID(customerID uuid.UUID) (*models.Customer, error) {
	var customer models.Customer
	query := `
		SELECT id, phone, name, email, address, notes, total_orders, total_spent, last_order_at, created_at, updated_at
		FROM customers WHERE id = $1
	`

	err := h.db.QueryRow(query, customerID).Scan(
		&customer.ID, &customer.Phone, &customer.Name, &customer.Email,
		&customer.Address, &customer.Notes, &customer.TotalOrders,
		&customer.TotalSpent, &customer.LastOrderAt, &customer.CreatedAt, &customer.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &customer, nil
}

// normalizePhone removes spaces, dashes, and other non-digit characters (except leading +)
func normalizePhone(phone string) string {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return ""
	}

	var result strings.Builder
	for i, r := range phone {
		if r >= '0' && r <= '9' {
			result.WriteRune(r)
		} else if i == 0 && r == '+' {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// UpdateCustomerStats updates customer statistics after order completion
func (h *CustomerHandler) UpdateCustomerStats(tx *sql.Tx, customerID uuid.UUID, orderTotal float64) error {
	query := `
		UPDATE customers
		SET total_orders = total_orders + 1,
		    total_spent = total_spent + $1,
		    last_order_at = NOW(),
		    updated_at = NOW()
		WHERE id = $2
	`
	_, err := tx.Exec(query, orderTotal, customerID)
	return err
}
