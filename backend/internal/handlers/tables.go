package handlers

import (
	"database/sql"
	"net/http"

	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TableHandler struct {
	db *sql.DB
}

func NewTableHandler(db *sql.DB) *TableHandler {
	return &TableHandler{db: db}
}

// GetTables retrieves all dining tables
func (h *TableHandler) GetTables(c *gin.Context) {
	location := c.Query("location")
	occupiedOnly := c.Query("occupied_only") == "true"
	availableOnly := c.Query("available_only") == "true"

	// Query tables with optional LEFT JOIN to get the parent bill (not KOTs)
	// Using DISTINCT ON to ensure one row per table, prioritizing tables with active orders
	queryBuilder := `
		SELECT DISTINCT ON (t.id)
		       t.id, t.table_number, t.seating_capacity, t.location, t.floor, t.is_occupied,
		       t.created_at, t.updated_at,
		       o.id as order_id, o.order_number, o.customer_name, o.status as order_status,
		       o.created_at as order_created_at, o.total_amount
		FROM dining_tables t
		LEFT JOIN orders o ON t.id = o.table_id
		    AND o.status NOT IN ('completed', 'cancelled')
		    AND (o.is_kot = false OR o.is_kot IS NULL)
		WHERE 1=1
	`

	var args []interface{}
	argIndex := 0

	if location != "" {
		argIndex++
		queryBuilder += ` AND t.location ILIKE $` + string(rune(argIndex+'0'))
		args = append(args, "%"+location+"%")
	}

	if occupiedOnly {
		queryBuilder += ` AND t.is_occupied = true`
	} else if availableOnly {
		queryBuilder += ` AND t.is_occupied = false`
	}

	// Order by table_number for the final result, with DISTINCT ON ordering by t.id first
	queryBuilder += ` ORDER BY t.id, o.created_at DESC NULLS LAST`

	rows, err := h.db.Query(queryBuilder, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch tables",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var tables []models.DiningTable
	for rows.Next() {
		var table models.DiningTable
		var orderID, orderNumber, customerName, orderStatus sql.NullString
		var orderCreatedAt sql.NullTime
		var totalAmount sql.NullFloat64

		err := rows.Scan(
			&table.ID, &table.TableNumber, &table.SeatingCapacity, &table.Location, &table.Floor, &table.IsOccupied,
			&table.CreatedAt, &table.UpdatedAt,
			&orderID, &orderNumber, &customerName, &orderStatus, &orderCreatedAt, &totalAmount,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan table",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Add current order info to table struct if available
		if orderID.Valid {
			table.CurrentOrder = &models.Order{
				ID:           uuid.MustParse(orderID.String),
				OrderNumber:  orderNumber.String,
				CustomerName: &customerName.String,
				Status:       orderStatus.String,
				CreatedAt:    orderCreatedAt.Time,
				TotalAmount:  totalAmount.Float64,
			}
		}

		tables = append(tables, table)
	}

	// Sort by table number for consistent display
	// (DISTINCT ON requires ordering by t.id first, so we re-sort here)
	sortTablesByNumber(tables)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Tables retrieved successfully",
		Data:    tables,
	})
}

// sortTablesByNumber sorts tables by their table_number field
func sortTablesByNumber(tables []models.DiningTable) {
	for i := 0; i < len(tables)-1; i++ {
		for j := i + 1; j < len(tables); j++ {
			if tables[i].TableNumber > tables[j].TableNumber {
				tables[i], tables[j] = tables[j], tables[i]
			}
		}
	}
}

// GetTable retrieves a specific table by ID
func (h *TableHandler) GetTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid table ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var table models.DiningTable

	query := `
		SELECT id, table_number, seating_capacity, location, floor, is_occupied, created_at, updated_at
		FROM dining_tables
		WHERE id = $1
	`

	err = h.db.QueryRow(query, tableID).Scan(
		&table.ID, &table.TableNumber, &table.SeatingCapacity, &table.Location, &table.Floor,
		&table.IsOccupied, &table.CreatedAt, &table.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Table not found",
			Error:   stringPtr("table_not_found"),
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch table",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Get current active order for this table
	var currentOrder *models.Order
	orderQuery := `
		SELECT o.id, o.order_number, o.customer_name, o.order_type, o.status, 
		       o.subtotal, o.tax_amount, o.total_amount, o.created_at, o.updated_at
		FROM orders o
		WHERE o.table_id = $1 AND o.status NOT IN ('completed', 'cancelled')
		ORDER BY o.created_at DESC
		LIMIT 1
	`

	var order models.Order
	err = h.db.QueryRow(orderQuery, tableID).Scan(
		&order.ID, &order.OrderNumber, &order.CustomerName, &order.OrderType, &order.Status,
		&order.Subtotal, &order.TaxAmount, &order.TotalAmount, &order.CreatedAt, &order.UpdatedAt,
	)

	if err == nil {
		currentOrder = &order
	} else if err != sql.ErrNoRows {
		// Log error but don't fail the request
		// fmt.Printf("Warning: Failed to fetch current order for table: %v\n", err)
	}

	// Create response with current order info
	response := map[string]interface{}{
		"id":               table.ID,
		"table_number":     table.TableNumber,
		"seating_capacity": table.SeatingCapacity,
		"location":         table.Location,
		"floor":            table.Floor,
		"is_occupied":      table.IsOccupied,
		"created_at":       table.CreatedAt,
		"updated_at":       table.UpdatedAt,
		"current_order":    currentOrder,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Table retrieved successfully",
		Data:    response,
	})
}

// GetTablesByLocation retrieves tables grouped by location
func (h *TableHandler) GetTablesByLocation(c *gin.Context) {
	// Use DISTINCT ON to avoid duplicate tables when multiple orders exist
	query := `
		SELECT DISTINCT ON (t.id)
		       t.id, t.table_number, t.seating_capacity, t.location, t.floor, t.is_occupied,
		       t.created_at, t.updated_at,
		       o.id as order_id, o.order_number, o.customer_name, o.status as order_status
		FROM dining_tables t
		LEFT JOIN orders o ON t.id = o.table_id
		    AND o.status NOT IN ('completed', 'cancelled')
		    AND (o.is_kot = false OR o.is_kot IS NULL)
		ORDER BY t.id, o.created_at DESC NULLS LAST
	`

	rows, err := h.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch tables",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	// Group tables by location
	locationMap := make(map[string][]models.DiningTable)

	for rows.Next() {
		var table models.DiningTable
		var orderID, orderNumber, customerName, orderStatus sql.NullString
		var location sql.NullString

		err := rows.Scan(
			&table.ID, &table.TableNumber, &table.SeatingCapacity, &location, &table.Floor, &table.IsOccupied,
			&table.CreatedAt, &table.UpdatedAt,
			&orderID, &orderNumber, &customerName, &orderStatus,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan table",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Set location
		if location.Valid {
			table.Location = &location.String
		} else {
			defaultLocation := "General"
			table.Location = &defaultLocation
		}

		locationKey := *table.Location
		locationMap[locationKey] = append(locationMap[locationKey], table)
	}

	// Sort tables within each location by table number
	for loc := range locationMap {
		sortTablesByNumber(locationMap[loc])
	}

	// Convert map to structured response
	var locations []map[string]interface{}
	for locationName, tables := range locationMap {
		locations = append(locations, map[string]interface{}{
			"location": locationName,
			"tables":   tables,
		})
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Tables grouped by location retrieved successfully",
		Data:    locations,
	})
}

// GetTableStatus retrieves the status overview of all tables
func (h *TableHandler) GetTableStatus(c *gin.Context) {
	query := `
		SELECT 
		    COUNT(*) as total_tables,
		    COUNT(CASE WHEN is_occupied = true THEN 1 END) as occupied_tables,
		    COUNT(CASE WHEN is_occupied = false THEN 1 END) as available_tables,
		    COALESCE(location, 'General') as location
		FROM dining_tables
		GROUP BY COALESCE(location, 'General')
		ORDER BY location
	`

	rows, err := h.db.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch table status",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var locationStats []map[string]interface{}
	var totalTables, totalOccupied, totalAvailable int

	for rows.Next() {
		var total, occupied, available int
		var location string

		err := rows.Scan(&total, &occupied, &available, &location)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan table status",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		locationStats = append(locationStats, map[string]interface{}{
			"location":         location,
			"total_tables":     total,
			"occupied_tables":  occupied,
			"available_tables": available,
			"occupancy_rate":   float64(occupied) / float64(total) * 100,
		})

		totalTables += total
		totalOccupied += occupied
		totalAvailable += available
	}

	response := map[string]interface{}{
		"total_tables":     totalTables,
		"occupied_tables":  totalOccupied,
		"available_tables": totalAvailable,
		"occupancy_rate":   float64(totalOccupied) / float64(totalTables) * 100,
		"by_location":      locationStats,
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Table status retrieved successfully",
		Data:    response,
	})
}

// ClearTable marks a table as available and completes all associated orders
func (h *TableHandler) ClearTable(c *gin.Context) {
	tableID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid table ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

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

	// Mark all active orders (parent bills) for this table as completed + cleared
	_, err = tx.Exec(`
		UPDATE orders
		SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
		    cleared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE table_id = $1
		  AND is_kot = false
		  AND parent_order_id IS NULL
		  AND status NOT IN ('completed', 'cancelled')
	`, tableID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to complete orders",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Mark all child KOTs for this table as completed + cleared
	_, err = tx.Exec(`
		UPDATE orders
		SET status = 'completed', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
		    cleared_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		WHERE table_id = $1
		  AND is_kot = true
		  AND status NOT IN ('completed', 'cancelled')
	`, tableID)
	if err != nil {
		// Log but don't fail
	}

	// Mark table as available
	_, err = tx.Exec(`
		UPDATE dining_tables
		SET is_occupied = false, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, tableID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update table status",
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

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Table cleared successfully",
	})
}

