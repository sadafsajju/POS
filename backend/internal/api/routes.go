package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"pos-backend/internal/handlers"
	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// SetupRoutes configures all API routes
func SetupRoutes(router *gin.RouterGroup, db *sql.DB, authMiddleware gin.HandlerFunc) {
	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db)
	orderHandler := handlers.NewOrderHandler(db)
	productHandler := handlers.NewProductHandler(db)
	paymentHandler := handlers.NewPaymentHandler(db)
	tableHandler := handlers.NewTableHandler(db)
	settingsHandler := handlers.NewSettingsHandler(db)
	customerHandler := handlers.NewCustomerHandler(db)
	optionHandler := handlers.NewOptionHandler(db)
	comboHandler := handlers.NewComboHandler(db)
	webhookHandler := handlers.NewWebhookHandler(db)

	// Public routes (no authentication required)
	public := router.Group("/")
	{
		// Authentication routes
		public.POST("/auth/login", authHandler.Login)
		public.POST("/auth/logout", authHandler.Logout)
		public.GET("/auth/staff", getStaffForPinLogin(db))

		// Setup routes (first-time installation)
		public.GET("/setup/check", checkSetupStatus(db))
		public.POST("/setup/admin", createInitialAdmin(db))
	}

	// Webhook routes (authenticated via HMAC signature, not JWT)
	webhooks := router.Group("/webhooks/:platform")
	webhooks.Use(middleware.WebhookAuthMiddleware(db))
	{
		webhooks.POST("/order", webhookHandler.ReceiveOrder)
		webhooks.POST("/status", webhookHandler.ReceiveStatusUpdate)
		webhooks.POST("/cancel", webhookHandler.ReceiveCancellation)
	}

	// Protected routes (authentication required)
	protected := router.Group("/")
	protected.Use(authMiddleware)
	{
		// Authentication routes
		protected.GET("/auth/me", authHandler.GetCurrentUser)
		protected.POST("/auth/verify-pin", authHandler.VerifyPin)
		protected.PUT("/auth/pin", authHandler.UpdatePin)

		// Settings - read-only for all authenticated users
		protected.GET("/settings", settingsHandler.GetSettings)

		// Product routes
		protected.GET("/products", productHandler.GetProducts)
		protected.GET("/products/:id", productHandler.GetProduct)
		protected.GET("/categories", productHandler.GetCategories)
		protected.GET("/categories/:id/products", productHandler.GetProductsByCategory)

		// Product option groups (read-only for all authenticated users)
		protected.GET("/products/:id/option-groups", optionHandler.GetOptionGroupsByProduct)
		protected.GET("/products/:id/combo-slots", comboHandler.GetComboSlotsByProduct)

		// Table routes
		protected.GET("/tables", tableHandler.GetTables)
		protected.GET("/tables/:id", tableHandler.GetTable)
		protected.GET("/tables/by-location", tableHandler.GetTablesByLocation)
		protected.GET("/tables/status", tableHandler.GetTableStatus)

		// Order routes (general view for all roles)
		protected.GET("/orders", orderHandler.GetOrders)
		protected.GET("/orders/:id", orderHandler.GetOrder)
		protected.DELETE("/orders/:id", deleteOrder(db)) // Cancel/delete orders
		protected.PATCH("/orders/:id/status", orderHandler.UpdateOrderStatus)

		// Bill routes (for KOT support)
		protected.GET("/orders/:id/bill-summary", orderHandler.GetBillSummary)
		protected.GET("/tables/:id/active-bill", orderHandler.GetActiveBillForTable)

		// Payment routes (counter/admin only)
		protected.GET("/orders/:id/payments", paymentHandler.GetPayments)
		protected.GET("/orders/:id/payment-summary", paymentHandler.GetPaymentSummary)

		// Customer routes (all authenticated users)
		protected.GET("/customers", customerHandler.GetCustomers)
		protected.GET("/customers/search", customerHandler.SearchCustomers)
		protected.GET("/customers/:id", customerHandler.GetCustomerByID)
		protected.GET("/customers/:id/orders", orderHandler.GetOrdersByCustomer)
		protected.GET("/customers/phone/:phone", customerHandler.GetCustomerByPhone)
		protected.POST("/customers", customerHandler.CreateCustomer)
		protected.PUT("/customers/:id", customerHandler.UpdateCustomer)
	}

	// Server routes (server role - dine-in orders only)
	server := router.Group("/server")
	server.Use(authMiddleware)
	server.Use(middleware.RequireRole("server"))
	{
		server.POST("/orders", createDineInOrder(db))                       // Only dine-in orders
		server.POST("/orders/:id/items", orderHandler.AddItemsToOrder)      // Add items to existing order
		server.PUT("/orders/:id/items/:item_id", orderHandler.UpdateOrderItem)    // Update item quantity
		server.DELETE("/orders/:id/items/:item_id", orderHandler.RemoveOrderItem) // Remove item from order
		server.DELETE("/orders/:id", deleteOrder(db))                             // Cancel/delete orders
	}

	// Counter routes (counter role - all order types and payments)
	counter := router.Group("/counter")
	counter.Use(authMiddleware)
	counter.Use(middleware.RequireRoles([]string{"admin", "manager", "counter"}))
	{
		counter.POST("/orders", orderHandler.CreateOrder)                        // All order types
		counter.POST("/orders/:id/items", orderHandler.AddItemsToOrder)          // Add items to existing order
		counter.PUT("/orders/:id/items/:item_id", orderHandler.UpdateOrderItem)  // Update item quantity
		counter.DELETE("/orders/:id/items/:item_id", orderHandler.RemoveOrderItem) // Remove item from order
		counter.POST("/orders/:id/payments", paymentHandler.ProcessPayment)      // Process payments
		counter.POST("/tables/:id/clear", tableHandler.ClearTable)               // Clear table (customer left)
		counter.DELETE("/orders/:id", deleteOrder(db))                           // Cancel/delete orders
		// Aggregator order management
		counter.GET("/aggregator-orders", orderHandler.GetAggregatorOrders)              // List aggregator orders
		counter.POST("/orders/:id/accept-aggregator", orderHandler.AcceptAggregatorOrder) // Accept aggregator order
		counter.POST("/orders/:id/reject-aggregator", orderHandler.RejectAggregatorOrder) // Reject aggregator order
	}

	// Admin routes (admin/manager only)
	admin := router.Group("/admin")
	admin.Use(authMiddleware)
	admin.Use(middleware.RequireRoles([]string{"admin", "manager"}))
	{
		// Dashboard and monitoring
		admin.GET("/dashboard/stats", getDashboardStats(db))
		admin.GET("/reports/sales", getSalesReport(db))
		admin.GET("/reports/orders", getOrdersReport(db))
		admin.GET("/reports/income", getIncomeReport(db))

		// Location management
		admin.GET("/locations", getLocations(db))
		admin.POST("/locations", createLocation(db))
		admin.PUT("/locations/:id", updateLocation(db))
		admin.DELETE("/locations/:id", deleteLocation(db))
		admin.GET("/locations/:id/products", getLocationProducts(db))
		admin.PUT("/locations/:id/products/:pid", setLocationProductOverride(db))
		admin.DELETE("/locations/:id/products/:pid", removeLocationProductOverride(db))
		admin.PUT("/users/:id/location", reassignUserLocation(db))

		// Settings management
		admin.GET("/settings", settingsHandler.GetSettings)
		admin.PUT("/settings", settingsHandler.UpdateSettings)
		admin.GET("/settings/:key", settingsHandler.GetSetting)

		// Menu management with pagination
		admin.GET("/products", productHandler.GetProducts) // Use existing paginated handler
		admin.GET("/categories", getAdminCategories(db))   // Add pagination
		admin.POST("/categories", createCategory(db))
		admin.PUT("/categories/:id", updateCategory(db))
		admin.DELETE("/categories/:id", deleteCategory(db))
		admin.POST("/products", createProduct(db))
		admin.PUT("/products/:id", updateProduct(db))
		admin.DELETE("/products/:id", deleteProduct(db))

		// Product option group management
		admin.POST("/products/:id/option-groups", optionHandler.CreateOptionGroup)
		admin.PUT("/products/:id/option-groups/:group_id", optionHandler.UpdateOptionGroup)
		admin.DELETE("/products/:id/option-groups/:group_id", optionHandler.DeleteOptionGroup)
		admin.POST("/option-groups/:group_id/items", optionHandler.CreateOptionItem)
		admin.PUT("/option-items/:item_id", optionHandler.UpdateOptionItem)
		admin.DELETE("/option-items/:item_id", optionHandler.DeleteOptionItem)

		// Combo slot management
		admin.POST("/products/:id/combo-slots", comboHandler.CreateComboSlot)
		admin.PUT("/products/:id/combo-slots/:slot_id", comboHandler.UpdateComboSlot)
		admin.DELETE("/products/:id/combo-slots/:slot_id", comboHandler.DeleteComboSlot)
		admin.POST("/combo-slots/:slot_id/choices", comboHandler.CreateComboSlotChoice)
		admin.DELETE("/combo-choices/:choice_id", comboHandler.DeleteComboSlotChoice)

		// Table management with pagination
		admin.GET("/tables", getAdminTables(db)) // Add pagination
		admin.POST("/tables", createTable(db))
		admin.PUT("/tables/:id", updateTable(db))
		admin.DELETE("/tables/:id", deleteTable(db))

		// User management with pagination
		admin.GET("/users", getAdminUsers(db)) // Update with pagination
		admin.POST("/users", createUser(db))
		admin.PUT("/users/:id", updateUser(db))
		admin.DELETE("/users/:id", deleteUser(db))

		// Advanced order management
		admin.POST("/orders", orderHandler.CreateOrder)                        // Admins can create any type of order
		admin.POST("/orders/:id/items", orderHandler.AddItemsToOrder)          // Add items to existing order
		admin.PUT("/orders/:id/items/:item_id", orderHandler.UpdateOrderItem)  // Update item quantity
		admin.DELETE("/orders/:id/items/:item_id", orderHandler.RemoveOrderItem) // Remove item from order
		admin.POST("/orders/:id/payments", paymentHandler.ProcessPayment)      // Admins can process payments
		admin.POST("/tables/:id/clear", tableHandler.ClearTable)               // Clear table (customer left)
		admin.DELETE("/orders/:id", deleteOrder(db))                           // Delete/void orders
		// Aggregator order management
		admin.GET("/aggregator-orders", orderHandler.GetAggregatorOrders)              // List aggregator orders
		admin.POST("/orders/:id/accept-aggregator", orderHandler.AcceptAggregatorOrder) // Accept aggregator order
		admin.POST("/orders/:id/reject-aggregator", orderHandler.RejectAggregatorOrder) // Reject aggregator order
		// Platform configuration (Swiggy/Zomato)
		admin.GET("/platform-configs", settingsHandler.GetPlatformConfigs)
		admin.GET("/platform-configs/:platform", settingsHandler.GetPlatformConfig)
		admin.PUT("/platform-configs", settingsHandler.UpsertPlatformConfig)
		admin.DELETE("/platform-configs/:platform", settingsHandler.DeletePlatformConfig)
	}

	// Kitchen routes (kitchen staff access)
	kitchen := router.Group("/kitchen")
	kitchen.Use(authMiddleware)
	kitchen.Use(middleware.RequireRoles([]string{"kitchen", "admin", "manager"}))
	{
		kitchen.GET("/orders", getKitchenOrders(db))
		kitchen.PATCH("/orders/:id/items/:item_id/status", updateOrderItemStatus(db))
	}
}

// Dashboard stats handler
func getDashboardStats(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Get basic stats for dashboard
		stats := make(map[string]interface{})

		// Today's orders
		var todayOrders int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM orders
			WHERE DATE(created_at) = CURRENT_DATE AND org_id = $1 AND location_id = $2
		`, orgID, locationID).Scan(&todayOrders)

		// Today's revenue
		var todayRevenue float64
		db.QueryRow(`
			SELECT COALESCE(SUM(total_amount), 0)
			FROM orders
			WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed' AND org_id = $1 AND location_id = $2
		`, orgID, locationID).Scan(&todayRevenue)

		// Active orders
		var activeOrders int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM orders
			WHERE status NOT IN ('completed', 'cancelled') AND org_id = $1 AND location_id = $2
		`, orgID, locationID).Scan(&activeOrders)

		// Occupied tables
		var occupiedTables int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM dining_tables
			WHERE is_occupied = true AND org_id = $1 AND location_id = $2
		`, orgID, locationID).Scan(&occupiedTables)

		stats["today_orders"] = todayOrders
		stats["today_revenue"] = todayRevenue
		stats["active_orders"] = activeOrders
		stats["occupied_tables"] = occupiedTables

		c.JSON(200, gin.H{
			"success": true,
			"message": "Dashboard stats retrieved successfully",
			"data":    stats,
		})
	}
}

// Sales report handler
func getSalesReport(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		period := c.DefaultQuery("period", "today") // today, week, month

		var query string
		switch period {
		case "week":
			query = `
				SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_amount) as revenue
				FROM orders
				WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'completed'
				  AND org_id = $1 AND location_id = $2
				GROUP BY DATE(created_at)
				ORDER BY date DESC
			`
		case "month":
			query = `
				SELECT DATE(created_at) as date, COUNT(*) as order_count, SUM(total_amount) as revenue
				FROM orders
				WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND status = 'completed'
				  AND org_id = $1 AND location_id = $2
				GROUP BY DATE(created_at)
				ORDER BY date DESC
			`
		default: // today
			query = `
				SELECT DATE_TRUNC('hour', created_at) as hour, COUNT(*) as order_count, SUM(total_amount) as revenue
				FROM orders
				WHERE DATE(created_at) = CURRENT_DATE AND status = 'completed'
				  AND org_id = $1 AND location_id = $2
				GROUP BY DATE_TRUNC('hour', created_at)
				ORDER BY hour DESC
			`
		}

		rows, err := db.Query(query, orgID, locationID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch sales report",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var report []map[string]interface{}
		for rows.Next() {
			var date interface{}
			var orderCount int
			var revenue float64

			err := rows.Scan(&date, &orderCount, &revenue)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan sales data",
					"error":   err.Error(),
				})
				return
			}

			report = append(report, map[string]interface{}{
				"date":        date,
				"order_count": orderCount,
				"revenue":     revenue,
			})
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Sales report retrieved successfully",
			"data":    report,
		})
	}
}

// Orders report handler
func getOrdersReport(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Get order statistics
		query := `
			SELECT
				status,
				COUNT(*) as count,
				AVG(total_amount) as avg_amount
			FROM orders
			WHERE DATE(created_at) = CURRENT_DATE
			  AND org_id = $1 AND location_id = $2
			GROUP BY status
		`

		rows, err := db.Query(query, orgID, locationID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch orders report",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var report []map[string]interface{}
		for rows.Next() {
			var status string
			var count int
			var avgAmount float64

			err := rows.Scan(&status, &count, &avgAmount)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan orders data",
					"error":   err.Error(),
				})
				return
			}

			report = append(report, map[string]interface{}{
				"status":     status,
				"count":      count,
				"avg_amount": avgAmount,
			})
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Orders report retrieved successfully",
			"data":    report,
		})
	}
}

// Kitchen orders handler
func getKitchenOrders(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		status := c.DefaultQuery("status", "all")

		query := `
			SELECT DISTINCT o.id, o.order_number, o.table_id, o.order_type, o.status,
			       o.created_at, o.customer_name, o.notes, o.updated_at,
			       o.is_kot, o.kot_number, o.parent_order_id,
			       t.table_number,
			       p.order_number as parent_order_number,
			       o.order_source, o.external_order_id,
			       o.delivery_partner_name, o.delivery_partner_phone,
			       o.accept_deadline
			FROM orders o
			LEFT JOIN dining_tables t ON o.table_id = t.id
			LEFT JOIN orders p ON o.parent_order_id = p.id
			WHERE o.status IN ('pending', 'confirmed', 'preparing', 'ready')
			  AND (o.is_kot = true OR o.parent_order_id IS NULL)
			  AND o.org_id = $1 AND o.location_id = $2
		`

		args := []interface{}{orgID, locationID}

		if status != "all" {
			query += ` AND o.status = $3`
			args = append(args, status)
		}

		query += ` ORDER BY o.created_at ASC`

		rows, err := db.Query(query, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch kitchen orders",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var orders []map[string]interface{}
		for rows.Next() {
			var orderID string
			var tableID, parentOrderID sql.NullString
			var orderNumber, orderType, orderStatus, customerName, tableNumber, notes sql.NullString
			var kotNumber, parentOrderNumber sql.NullString
			var isKOT bool
			var createdAt, updatedAt time.Time
			var orderSource sql.NullString
			var externalOrderID, deliveryPartnerName, deliveryPartnerPhone sql.NullString
			var acceptDeadline sql.NullTime

			err := rows.Scan(&orderID, &orderNumber, &tableID, &orderType, &orderStatus,
				&createdAt, &customerName, &notes, &updatedAt,
				&isKOT, &kotNumber, &parentOrderID,
				&tableNumber, &parentOrderNumber,
				&orderSource, &externalOrderID,
				&deliveryPartnerName, &deliveryPartnerPhone,
				&acceptDeadline)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan kitchen order",
					"error":   err.Error(),
				})
				return
			}

			var tableIDValue interface{}
			if tableID.Valid {
				tableIDValue = tableID.String
			}

			var parentOrderIDValue interface{}
			if parentOrderID.Valid {
				parentOrderIDValue = parentOrderID.String
			}

			order := map[string]interface{}{
				"id":                     orderID,
				"order_number":           orderNumber.String,
				"table_id":               tableIDValue,
				"order_type":             orderType.String,
				"status":                 orderStatus.String,
				"customer_name":          customerName.String,
				"notes":                  notes.String,
				"created_at":             createdAt,
				"updated_at":             updatedAt,
				"is_kot":                 isKOT,
				"kot_number":             kotNumber.String,
				"parent_order_id":        parentOrderIDValue,
				"parent_order_number":    parentOrderNumber.String,
				"order_source":           orderSource.String,
				"external_order_id":      externalOrderID.String,
				"delivery_partner_name":  deliveryPartnerName.String,
				"delivery_partner_phone": deliveryPartnerPhone.String,
				"table": map[string]interface{}{
					"table_number": tableNumber.String,
				},
			}

			if acceptDeadline.Valid {
				order["accept_deadline"] = acceptDeadline.Time
			}

			// Fetch order items with product info
			itemsQuery := `
				SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price,
				       oi.special_instructions, oi.status, oi.created_at, oi.updated_at,
				       p.name as product_name, p.description as product_description
				FROM order_items oi
				LEFT JOIN products p ON oi.product_id = p.id
				WHERE oi.order_id = $1
				ORDER BY oi.created_at ASC
			`

			itemRows, err := db.Query(itemsQuery, orderID)
			if err != nil {
				// Log error but continue - don't fail the whole request
				fmt.Printf("Failed to fetch items for order %v: %v\n", orderID, err)
				order["items"] = []map[string]interface{}{}
			} else {
				var items []map[string]interface{}
				for itemRows.Next() {
					var itemID, productID string
					var quantity int
					var unitPrice, totalPrice float64
					var specialInstructions, itemStatus, productName, productDescription sql.NullString
					var itemCreatedAt, itemUpdatedAt time.Time

					err := itemRows.Scan(&itemID, &productID, &quantity, &unitPrice, &totalPrice,
						&specialInstructions, &itemStatus, &itemCreatedAt, &itemUpdatedAt,
						&productName, &productDescription)
					if err != nil {
						fmt.Printf("Failed to scan order item: %v\n", err)
						continue
					}

					item := map[string]interface{}{
						"id":                   itemID,
						"order_id":             orderID,
						"product_id":           productID,
						"quantity":             quantity,
						"unit_price":           unitPrice,
						"total_price":          totalPrice,
						"special_instructions": specialInstructions.String,
						"status":               itemStatus.String,
						"created_at":           itemCreatedAt,
						"updated_at":           itemUpdatedAt,
						"product": map[string]interface{}{
							"id":          productID,
							"name":        productName.String,
							"description": productDescription.String,
						},
					}

					// Fetch options for this order item
					optRows, optErr := db.Query(`
						SELECT id, option_group_name, option_item_name, price_adjustment
						FROM order_item_options
						WHERE order_item_id = $1
						ORDER BY created_at
					`, itemID)
					if optErr == nil {
						var options []map[string]interface{}
						for optRows.Next() {
							var optID, groupName, itemName string
							var priceAdj float64
							if scanErr := optRows.Scan(&optID, &groupName, &itemName, &priceAdj); scanErr == nil {
								options = append(options, map[string]interface{}{
									"id":                optID,
									"option_group_name": groupName,
									"option_item_name":  itemName,
									"price_adjustment":  priceAdj,
								})
							}
						}
						optRows.Close()
						if options == nil {
							options = []map[string]interface{}{}
						}
						item["options"] = options
					} else {
						item["options"] = []map[string]interface{}{}
					}

					// Fetch combo choices for this order item
					comboRows, comboErr := db.Query(`
						SELECT id, slot_name, product_id, product_name, price_adjustment, selected_options
						FROM order_item_combo_choices
						WHERE order_item_id = $1
						ORDER BY created_at
					`, itemID)
					if comboErr == nil {
						var comboChoices []map[string]interface{}
						for comboRows.Next() {
							var cID, slotName, cProductID, cProductName, selectedOpts string
							var cPriceAdj float64
							if scanErr := comboRows.Scan(&cID, &slotName, &cProductID, &cProductName, &cPriceAdj, &selectedOpts); scanErr == nil {
								comboChoices = append(comboChoices, map[string]interface{}{
									"id":               cID,
									"slot_name":        slotName,
									"product_id":       cProductID,
									"product_name":     cProductName,
									"price_adjustment": cPriceAdj,
									"selected_options": selectedOpts,
								})
							}
						}
						comboRows.Close()
						if comboChoices == nil {
							comboChoices = []map[string]interface{}{}
						}
						item["combo_choices"] = comboChoices
					} else {
						item["combo_choices"] = []map[string]interface{}{}
					}

					items = append(items, item)
				}
				itemRows.Close()

				if items == nil {
					items = []map[string]interface{}{}
				}
				order["items"] = items
			}

			orders = append(orders, order)
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Kitchen orders retrieved successfully",
			"data":    orders,
		})
	}
}

// Update order item status handler
func updateOrderItemStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderID := c.Param("id")
		itemID := c.Param("item_id")

		var req struct {
			Status string `json:"status"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Update order item status
		_, err := db.Exec(`
			UPDATE order_items
			SET status = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND order_id = $3
		`, req.Status, itemID, orderID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to update order item status",
				"error":   err.Error(),
			})
			return
		}

		// Auto-derive order status from item statuses
		// Rule: order status = the lowest item status across all items
		//   all served → order=served, all ready → order=ready,
		//   any preparing → order=preparing, else pending
		syncOrderStatusFromItems(db, orderID)

		c.JSON(200, gin.H{
			"success": true,
			"message": "Order item status updated successfully",
		})
	}
}

// syncOrderStatusFromItems derives the order status from its items' statuses
// and updates the order + its parent bill (for KOT orders).
func syncOrderStatusFromItems(db *sql.DB, orderID string) {
	var pending, preparing, ready, served int
	err := db.QueryRow(`
		SELECT
			COUNT(CASE WHEN status = 'pending' THEN 1 END),
			COUNT(CASE WHEN status = 'preparing' THEN 1 END),
			COUNT(CASE WHEN status = 'ready' THEN 1 END),
			COUNT(CASE WHEN status = 'served' THEN 1 END)
		FROM order_items WHERE order_id = $1
	`, orderID).Scan(&pending, &preparing, &ready, &served)
	if err != nil {
		return
	}

	total := pending + preparing + ready + served
	if total == 0 {
		return
	}

	var newStatus string
	var timestampCol string
	if served == total {
		newStatus = "served"
		timestampCol = "served_at"
	} else if ready+served == total {
		newStatus = "ready"
		timestampCol = "ready_at"
	} else if preparing > 0 || ready > 0 || served > 0 {
		newStatus = "preparing"
		timestampCol = "preparing_at"
	} else {
		newStatus = "pending"
	}

	// Update status for active orders (don't override paid/completed/cancelled)
	updateQuery := `
		UPDATE orders
		SET status = $1, updated_at = CURRENT_TIMESTAMP
	`
	if timestampCol != "" {
		updateQuery += ", " + timestampCol + " = COALESCE(" + timestampCol + ", CURRENT_TIMESTAMP)"
	}
	updateQuery += `
		WHERE id = $2
		  AND status IN ('pending', 'confirmed', 'preparing', 'ready', 'served')
	`
	db.Exec(updateQuery, newStatus, orderID)

	// For paid orders: still record timestamps (e.g. served_at after payment)
	// but don't change the status away from 'paid'
	if timestampCol != "" {
		db.Exec(`
			UPDATE orders
			SET `+timestampCol+` = COALESCE(`+timestampCol+`, CURRENT_TIMESTAMP),
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND status = 'paid'
		`, orderID)
	}

	// If this is a KOT, also sync the parent bill's status
	var parentOrderID *string
	var isKOT bool
	err = db.QueryRow("SELECT is_kot, parent_order_id FROM orders WHERE id = $1", orderID).Scan(&isKOT, &parentOrderID)
	if err != nil || !isKOT || parentOrderID == nil {
		return
	}

	// Derive parent status from all child KOTs' statuses
	var kotPending, kotPreparing, kotReady, kotServed int
	err = db.QueryRow(`
		SELECT
			COUNT(CASE WHEN status = 'pending' THEN 1 END),
			COUNT(CASE WHEN status = 'preparing' THEN 1 END),
			COUNT(CASE WHEN status = 'ready' THEN 1 END),
			COUNT(CASE WHEN status = 'served' THEN 1 END)
		FROM orders
		WHERE parent_order_id = $1 AND is_kot = true
		  AND status NOT IN ('completed', 'cancelled')
	`, *parentOrderID).Scan(&kotPending, &kotPreparing, &kotReady, &kotServed)
	if err != nil {
		return
	}

	kotTotal := kotPending + kotPreparing + kotReady + kotServed
	if kotTotal == 0 {
		return
	}

	var parentStatus string
	var parentTimestampCol string
	if kotServed == kotTotal {
		parentStatus = "served"
		parentTimestampCol = "served_at"
	} else if kotReady+kotServed == kotTotal {
		parentStatus = "ready"
		parentTimestampCol = "ready_at"
	} else if kotPreparing > 0 || kotReady > 0 || kotServed > 0 {
		parentStatus = "preparing"
		parentTimestampCol = "preparing_at"
	} else {
		parentStatus = "pending"
	}

	parentQuery := `
		UPDATE orders
		SET status = $1, updated_at = CURRENT_TIMESTAMP
	`
	if parentTimestampCol != "" {
		parentQuery += ", " + parentTimestampCol + " = COALESCE(" + parentTimestampCol + ", CURRENT_TIMESTAMP)"
	}
	parentQuery += `
		WHERE id = $2
		  AND status IN ('pending', 'confirmed', 'preparing', 'ready', 'served')
	`
	db.Exec(parentQuery, parentStatus, *parentOrderID)

	// For paid parent bills: still record timestamps but keep status as 'paid'
	if parentTimestampCol != "" {
		db.Exec(`
			UPDATE orders
			SET `+parentTimestampCol+` = COALESCE(`+parentTimestampCol+`, CURRENT_TIMESTAMP),
			    updated_at = CURRENT_TIMESTAMP
			WHERE id = $1 AND status = 'paid'
		`, *parentOrderID)
	}
}

// Server role handler - only allows dine-in orders
func createDineInOrder(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			TableID      *string `json:"table_id"`
			CustomerName *string `json:"customer_name"`
			Items        []struct {
				ProductID           string  `json:"product_id"`
				Quantity            int     `json:"quantity"`
				SpecialInstructions *string `json:"special_instructions"`
			} `json:"items"`
			Notes *string `json:"notes"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Force order type to dine_in for servers
		orderHandler := handlers.NewOrderHandler(db)

		// Create order request with forced dine_in type
		createOrderReq := map[string]interface{}{
			"table_id":      req.TableID,
			"customer_name": req.CustomerName,
			"order_type":    "dine_in", // Force dine-in for servers
			"items":         req.Items,
			"notes":         req.Notes,
		}

		// Convert to JSON and back to simulate the request
		reqBytes, _ := json.Marshal(createOrderReq)
		c.Request.Body = io.NopCloser(strings.NewReader(string(reqBytes)))

		orderHandler.CreateOrder(c)
	}
}

// Admin handler - Income report
func getIncomeReport(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		period := c.DefaultQuery("period", "today") // today, week, month, year

		var query string
		switch period {
		case "week":
			query = `
				SELECT
					DATE_TRUNC('day', created_at) as period,
					COUNT(*) as total_orders,
					SUM(total_amount) as gross_income,
					SUM(tax_amount) as tax_collected,
					SUM(total_amount - tax_amount) as net_income
				FROM orders
				WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
					AND status = 'completed' AND org_id = $1 AND location_id = $2
				GROUP BY DATE_TRUNC('day', created_at)
				ORDER BY period DESC
			`
		case "month":
			query = `
				SELECT
					DATE_TRUNC('day', created_at) as period,
					COUNT(*) as total_orders,
					SUM(total_amount) as gross_income,
					SUM(tax_amount) as tax_collected,
					SUM(total_amount - tax_amount) as net_income
				FROM orders
				WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
					AND status = 'completed' AND org_id = $1 AND location_id = $2
				GROUP BY DATE_TRUNC('day', created_at)
				ORDER BY period DESC
			`
		case "year":
			query = `
				SELECT
					DATE_TRUNC('month', created_at) as period,
					COUNT(*) as total_orders,
					SUM(total_amount) as gross_income,
					SUM(tax_amount) as tax_collected,
					SUM(total_amount - tax_amount) as net_income
				FROM orders
				WHERE created_at >= CURRENT_DATE - INTERVAL '1 year'
					AND status = 'completed' AND org_id = $1 AND location_id = $2
				GROUP BY DATE_TRUNC('month', created_at)
				ORDER BY period DESC
			`
		default: // today
			query = `
				SELECT
					DATE_TRUNC('hour', created_at) as period,
					COUNT(*) as total_orders,
					SUM(total_amount) as gross_income,
					SUM(tax_amount) as tax_collected,
					SUM(total_amount - tax_amount) as net_income
				FROM orders
				WHERE DATE(created_at) = CURRENT_DATE
					AND status = 'completed' AND org_id = $1 AND location_id = $2
				GROUP BY DATE_TRUNC('hour', created_at)
				ORDER BY period DESC
			`
		}

		rows, err := db.Query(query, orgID, locationID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch income report",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var report []map[string]interface{}
		var totalGross, totalTax, totalNet float64
		var totalOrders int

		for rows.Next() {
			var period interface{}
			var orders int
			var gross, tax, net float64

			err := rows.Scan(&period, &orders, &gross, &tax, &net)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan income data",
					"error":   err.Error(),
				})
				return
			}

			totalOrders += orders
			totalGross += gross
			totalTax += tax
			totalNet += net

			report = append(report, map[string]interface{}{
				"period": period,
				"orders": orders,
				"gross":  gross,
				"tax":    tax,
				"net":    net,
			})
		}

		result := map[string]interface{}{
			"summary": map[string]interface{}{
				"total_orders":  totalOrders,
				"gross_income":  totalGross,
				"tax_collected": totalTax,
				"net_income":    totalNet,
			},
			"breakdown": report,
			"period":    period,
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Income report retrieved successfully",
			"data":    result,
		})
	}
}

// Admin handler - Create category
func createCategory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			Name        string  `json:"name" binding:"required"`
			Description *string `json:"description"`
			Color       *string `json:"color"`
			SortOrder   int     `json:"sort_order"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		var categoryID string
		err := db.QueryRow(`
			INSERT INTO categories (name, description, color, sort_order, org_id)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, req.Name, req.Description, req.Color, req.SortOrder, orgID).Scan(&categoryID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to create category",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(201, gin.H{
			"success": true,
			"message": "Category created successfully",
			"data":    map[string]interface{}{"id": categoryID},
		})
	}
}

// Admin handler - Update category
func updateCategory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		_ = orgID // used in WHERE clause below
		categoryID := c.Param("id")

		var req struct {
			Name        *string `json:"name"`
			Description *string `json:"description"`
			Color       *string `json:"color"`
			SortOrder   *int    `json:"sort_order"`
			IsActive    *bool   `json:"is_active"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Build dynamic update query
		updates := []string{}
		args := []interface{}{}
		argCount := 1

		if req.Name != nil {
			updates = append(updates, fmt.Sprintf("name = $%d", argCount))
			args = append(args, *req.Name)
			argCount++
		}
		if req.Description != nil {
			updates = append(updates, fmt.Sprintf("description = $%d", argCount))
			args = append(args, req.Description)
			argCount++
		}
		if req.Color != nil {
			updates = append(updates, fmt.Sprintf("color = $%d", argCount))
			args = append(args, req.Color)
			argCount++
		}
		if req.SortOrder != nil {
			updates = append(updates, fmt.Sprintf("sort_order = $%d", argCount))
			args = append(args, *req.SortOrder)
			argCount++
		}
		if req.IsActive != nil {
			updates = append(updates, fmt.Sprintf("is_active = $%d", argCount))
			args = append(args, *req.IsActive)
			argCount++
		}

		if len(updates) == 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "No fields to update",
			})
			return
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, categoryID)
		argCount++
		args = append(args, orgID)

		query := fmt.Sprintf(`
			UPDATE categories
			SET %s
			WHERE id = $%d AND org_id = $%d
		`, strings.Join(updates, ", "), argCount-1, argCount)

		result, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to update category",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Category not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Category updated successfully",
		})
	}
}

// Admin handler - Delete category
func deleteCategory(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		_ = orgID
		categoryID := c.Param("id")

		// Check if category has products
		var productCount int
		db.QueryRow("SELECT COUNT(*) FROM products WHERE category_id = $1 AND org_id = $2", categoryID, orgID).Scan(&productCount)

		if productCount > 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Cannot delete category with existing products",
				"error":   "category_has_products",
			})
			return
		}

		result, err := db.Exec("DELETE FROM categories WHERE id = $1 AND org_id = $2", categoryID, orgID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete category",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Category not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Category deleted successfully",
		})
	}
}

// Admin handler - Create product
func createProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			CategoryID      *string `json:"category_id"`
			Name            string  `json:"name" binding:"required"`
			Description     *string `json:"description"`
			Price           float64 `json:"price" binding:"required"`
			ImageURL        *string `json:"image_url"`
			Barcode         *string `json:"barcode"`
			SKU             *string `json:"sku"`
			PreparationTime int     `json:"preparation_time"`
			SortOrder       int     `json:"sort_order"`
			DietaryType     *string `json:"dietary_type"`  // veg, non-veg, egg, vegan
			ProductType     *string `json:"product_type"`  // simple, configurable, combo
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Default product_type to "simple"
		productType := "simple"
		if req.ProductType != nil && (*req.ProductType == "simple" || *req.ProductType == "configurable" || *req.ProductType == "combo") {
			productType = *req.ProductType
		}

		var productID string
		err := db.QueryRow(`
			INSERT INTO products (category_id, name, description, price, image_url, barcode, sku, preparation_time, sort_order, dietary_type, product_type, org_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			RETURNING id
		`, req.CategoryID, req.Name, req.Description, req.Price, req.ImageURL, req.Barcode, req.SKU, req.PreparationTime, req.SortOrder, req.DietaryType, productType, orgID).Scan(&productID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to create product",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(201, gin.H{
			"success": true,
			"message": "Product created successfully",
			"data":    map[string]interface{}{"id": productID},
		})
	}
}

// Admin handler - Update product
func updateProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		productID := c.Param("id")

		var req struct {
			CategoryID      *string  `json:"category_id"`
			Name            *string  `json:"name"`
			Description     *string  `json:"description"`
			Price           *float64 `json:"price"`
			ImageURL        *string  `json:"image_url"`
			Barcode         *string  `json:"barcode"`
			SKU             *string  `json:"sku"`
			IsAvailable     *bool    `json:"is_available"`
			PreparationTime *int     `json:"preparation_time"`
			SortOrder       *int     `json:"sort_order"`
			DietaryType     *string  `json:"dietary_type"`  // veg, non-veg, egg, vegan
			ProductType     *string  `json:"product_type"`  // simple, configurable, combo
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Build dynamic update query
		updates := []string{}
		args := []interface{}{}
		argCount := 1

		if req.CategoryID != nil {
			updates = append(updates, fmt.Sprintf("category_id = $%d", argCount))
			args = append(args, req.CategoryID)
			argCount++
		}
		if req.Name != nil {
			updates = append(updates, fmt.Sprintf("name = $%d", argCount))
			args = append(args, *req.Name)
			argCount++
		}
		if req.Description != nil {
			updates = append(updates, fmt.Sprintf("description = $%d", argCount))
			args = append(args, req.Description)
			argCount++
		}
		if req.Price != nil {
			updates = append(updates, fmt.Sprintf("price = $%d", argCount))
			args = append(args, *req.Price)
			argCount++
		}
		if req.ImageURL != nil {
			updates = append(updates, fmt.Sprintf("image_url = $%d", argCount))
			args = append(args, req.ImageURL)
			argCount++
		}
		if req.Barcode != nil {
			updates = append(updates, fmt.Sprintf("barcode = $%d", argCount))
			args = append(args, req.Barcode)
			argCount++
		}
		if req.SKU != nil {
			updates = append(updates, fmt.Sprintf("sku = $%d", argCount))
			args = append(args, req.SKU)
			argCount++
		}
		if req.IsAvailable != nil {
			updates = append(updates, fmt.Sprintf("is_available = $%d", argCount))
			args = append(args, *req.IsAvailable)
			argCount++
		}
		if req.PreparationTime != nil {
			updates = append(updates, fmt.Sprintf("preparation_time = $%d", argCount))
			args = append(args, *req.PreparationTime)
			argCount++
		}
		if req.SortOrder != nil {
			updates = append(updates, fmt.Sprintf("sort_order = $%d", argCount))
			args = append(args, *req.SortOrder)
			argCount++
		}
		if req.DietaryType != nil {
			updates = append(updates, fmt.Sprintf("dietary_type = $%d", argCount))
			args = append(args, req.DietaryType)
			argCount++
		}
		if req.ProductType != nil && (*req.ProductType == "simple" || *req.ProductType == "configurable" || *req.ProductType == "combo") {
			updates = append(updates, fmt.Sprintf("product_type = $%d", argCount))
			args = append(args, *req.ProductType)
			argCount++
		}

		if len(updates) == 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "No fields to update",
			})
			return
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, productID)
		argCount++
		args = append(args, orgID)

		query := fmt.Sprintf(`
			UPDATE products
			SET %s
			WHERE id = $%d AND org_id = $%d
		`, strings.Join(updates, ", "), argCount-1, argCount)

		result, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to update product",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Product not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Product updated successfully",
		})
	}
}

// Admin handler - Delete product
func deleteProduct(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		productID := c.Param("id")

		// Check if product is used in any active orders
		var orderCount int
		db.QueryRow(`
			SELECT COUNT(*) 
			FROM order_items oi 
			JOIN orders o ON oi.order_id = o.id 
			WHERE oi.product_id = $1 AND o.status NOT IN ('completed', 'cancelled')
		`, productID).Scan(&orderCount)

		if orderCount > 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Cannot delete product with active orders",
				"error":   "product_has_active_orders",
			})
			return
		}

		result, err := db.Exec("DELETE FROM products WHERE id = $1 AND org_id = $2", productID, orgID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete product",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Product not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Product deleted successfully",
		})
	}
}

// Admin handler - Create table
func createTable(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			TableNumber     string  `json:"table_number" binding:"required"`
			SeatingCapacity int     `json:"seating_capacity"`
			Location        *string `json:"location"`
			Floor           *string `json:"floor"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		var tableID string
		err := db.QueryRow(`
			INSERT INTO dining_tables (table_number, seating_capacity, location, floor, org_id, location_id)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`, req.TableNumber, req.SeatingCapacity, req.Location, req.Floor, orgID, locationID).Scan(&tableID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to create table",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(201, gin.H{
			"success": true,
			"message": "Table created successfully",
			"data":    map[string]interface{}{"id": tableID},
		})
	}
}

// Admin handler - Update table
func updateTable(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		tableID := c.Param("id")
		_, _ = orgID, locationID

		var req struct {
			TableNumber     *string `json:"table_number"`
			SeatingCapacity *int    `json:"seating_capacity"`
			Location        *string `json:"location"`
			Floor           *string `json:"floor"`
			IsOccupied      *bool   `json:"is_occupied"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Build dynamic update query
		updates := []string{}
		args := []interface{}{}
		argCount := 1

		if req.TableNumber != nil {
			updates = append(updates, fmt.Sprintf("table_number = $%d", argCount))
			args = append(args, *req.TableNumber)
			argCount++
		}
		if req.SeatingCapacity != nil {
			updates = append(updates, fmt.Sprintf("seating_capacity = $%d", argCount))
			args = append(args, *req.SeatingCapacity)
			argCount++
		}
		if req.Location != nil {
			updates = append(updates, fmt.Sprintf("location = $%d", argCount))
			args = append(args, req.Location)
			argCount++
		}
		if req.Floor != nil {
			updates = append(updates, fmt.Sprintf("floor = $%d", argCount))
			args = append(args, req.Floor)
			argCount++
		}
		if req.IsOccupied != nil {
			updates = append(updates, fmt.Sprintf("is_occupied = $%d", argCount))
			args = append(args, *req.IsOccupied)
			argCount++
		}

		if len(updates) == 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "No fields to update",
			})
			return
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, tableID)
		argCount++
		args = append(args, orgID)
		argCount++
		args = append(args, locationID)

		query := fmt.Sprintf(`
			UPDATE dining_tables
			SET %s
			WHERE id = $%d AND org_id = $%d AND location_id = $%d
		`, strings.Join(updates, ", "), argCount-2, argCount-1, argCount)

		result, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to update table",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Table not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Table updated successfully",
		})
	}
}

// Admin handler - Delete table
func deleteTable(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}
		tableID := c.Param("id")

		// Check if table has active orders
		var orderCount int
		db.QueryRow(`
			SELECT COUNT(*)
			FROM orders
			WHERE table_id = $1 AND status NOT IN ('completed', 'cancelled')
			  AND org_id = $2 AND location_id = $3
		`, tableID, orgID, locationID).Scan(&orderCount)

		if orderCount > 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Cannot delete table with active orders",
				"error":   "table_has_active_orders",
			})
			return
		}

		result, err := db.Exec("DELETE FROM dining_tables WHERE id = $1 AND org_id = $2 AND location_id = $3", tableID, orgID, locationID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete table",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Table not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Table deleted successfully",
		})
	}
}

// Admin handler - Create user
func createUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			Username   string  `json:"username" binding:"required"`
			Email      string  `json:"email" binding:"required"`
			Password   string  `json:"password" binding:"required"`
			FirstName  string  `json:"first_name" binding:"required"`
			LastName   string  `json:"last_name" binding:"required"`
			Role       string  `json:"role" binding:"required"`
			Pin        string  `json:"pin"`
			LocationID *string `json:"location_id"` // optional: assign to specific location
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to hash password",
				"error":   err.Error(),
			})
			return
		}

		// Hash PIN if provided
		var pinHash *string
		if req.Pin != "" {
			if len(req.Pin) != 4 {
				c.JSON(400, gin.H{
					"success": false,
					"message": "PIN must be exactly 4 digits",
					"error":   "invalid_pin",
				})
				return
			}
			hashedPin, err := bcrypt.GenerateFromPassword([]byte(req.Pin), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to hash PIN",
					"error":   err.Error(),
				})
				return
			}
			pinHashStr := string(hashedPin)
			pinHash = &pinHashStr
		}

		// Determine target location: use request value, or fall back to caller's location
		targetLocationID := locationID
		if req.LocationID != nil && *req.LocationID != "" {
			targetLocationID, _ = uuid.Parse(*req.LocationID)
		}

		var userID string
		err = db.QueryRow(`
			INSERT INTO users (username, email, password_hash, pin_hash, first_name, last_name, role, org_id, location_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id
		`, req.Username, req.Email, string(hashedPassword), pinHash, req.FirstName, req.LastName, req.Role, orgID, targetLocationID).Scan(&userID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to create user",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(201, gin.H{
			"success": true,
			"message": "User created successfully",
			"data":    map[string]interface{}{"id": userID},
		})
	}
}

// Admin handler - Update user
func updateUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			Username   *string `json:"username"`
			Email      *string `json:"email"`
			Password   *string `json:"password"`
			FirstName  *string `json:"first_name"`
			LastName   *string `json:"last_name"`
			Role       *string `json:"role"`
			IsActive   *bool   `json:"is_active"`
			Pin        *string `json:"pin"`
			LocationID *string `json:"location_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Build dynamic update query
		updates := []string{}
		args := []interface{}{}
		argCount := 1

		if req.Username != nil {
			updates = append(updates, fmt.Sprintf("username = $%d", argCount))
			args = append(args, *req.Username)
			argCount++
		}
		if req.Email != nil {
			updates = append(updates, fmt.Sprintf("email = $%d", argCount))
			args = append(args, *req.Email)
			argCount++
		}
		if req.Password != nil {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to hash password",
					"error":   err.Error(),
				})
				return
			}
			updates = append(updates, fmt.Sprintf("password_hash = $%d", argCount))
			args = append(args, string(hashedPassword))
			argCount++
		}
		if req.Pin != nil {
			if *req.Pin == "" {
				// Empty string = clear PIN
				updates = append(updates, fmt.Sprintf("pin_hash = $%d", argCount))
				args = append(args, nil)
				argCount++
			} else {
				if len(*req.Pin) != 4 {
					c.JSON(400, gin.H{
						"success": false,
						"message": "PIN must be exactly 4 digits",
						"error":   "invalid_pin",
					})
					return
				}
				hashedPin, err := bcrypt.GenerateFromPassword([]byte(*req.Pin), bcrypt.DefaultCost)
				if err != nil {
					c.JSON(500, gin.H{
						"success": false,
						"message": "Failed to hash PIN",
						"error":   err.Error(),
					})
					return
				}
				updates = append(updates, fmt.Sprintf("pin_hash = $%d", argCount))
				args = append(args, string(hashedPin))
				argCount++
			}
		}
		if req.FirstName != nil {
			updates = append(updates, fmt.Sprintf("first_name = $%d", argCount))
			args = append(args, *req.FirstName)
			argCount++
		}
		if req.LastName != nil {
			updates = append(updates, fmt.Sprintf("last_name = $%d", argCount))
			args = append(args, *req.LastName)
			argCount++
		}
		if req.Role != nil {
			updates = append(updates, fmt.Sprintf("role = $%d", argCount))
			args = append(args, *req.Role)
			argCount++
		}
		if req.IsActive != nil {
			updates = append(updates, fmt.Sprintf("is_active = $%d", argCount))
			args = append(args, *req.IsActive)
			argCount++
		}
		if req.LocationID != nil {
			if *req.LocationID == "" {
				updates = append(updates, fmt.Sprintf("location_id = $%d", argCount))
				args = append(args, nil)
				argCount++
			} else {
				locUUID, parseErr := uuid.Parse(*req.LocationID)
				if parseErr != nil {
					c.JSON(400, gin.H{"success": false, "message": "Invalid location_id", "error": "invalid_uuid"})
					return
				}
				updates = append(updates, fmt.Sprintf("location_id = $%d", argCount))
				args = append(args, locUUID)
				argCount++
			}
		}

		if len(updates) == 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "No fields to update",
			})
			return
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, userID)
		idIdx := argCount
		argCount++
		args = append(args, orgID)

		query := fmt.Sprintf(`
			UPDATE users
			SET %s
			WHERE id = $%d AND org_id = $%d
		`, strings.Join(updates, ", "), idIdx, argCount)

		result, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to update user",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "User not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "User updated successfully",
		})
	}
}

// Admin handler - Delete user
func deleteUser(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.Param("id")

		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Prevent deletion if user has associated orders
		var orderCount int
		db.QueryRow("SELECT COUNT(*) FROM orders WHERE user_id = $1 AND org_id = $2", userID, orgID).Scan(&orderCount)

		if orderCount > 0 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Cannot delete user with existing orders",
				"error":   "user_has_orders",
			})
			return
		}

		result, err := db.Exec("DELETE FROM users WHERE id = $1 AND org_id = $2", userID, orgID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete user",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "User not found",
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "User deleted successfully",
		})
	}
}

// Admin handler - Get users with pagination
func getAdminUsers(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Parse pagination parameters
		page := 1
		perPage := 20
		role := c.Query("role")
		isActive := c.Query("active")
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

		// Build query with filters (scoped to org)
		queryBuilder := "SELECT id, username, email, first_name, last_name, role, is_active, location_id, created_at FROM users WHERE org_id = $1"
		args := []interface{}{orgID}
		argCount := 1

		if role != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND role = $%d", argCount)
			args = append(args, role)
		}

		if isActive != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND is_active = $%d", argCount)
			args = append(args, isActive == "true")
		}

		if search != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND (first_name ILIKE $%d OR last_name ILIKE $%d OR username ILIKE $%d OR email ILIKE $%d)", argCount, argCount, argCount, argCount)
			args = append(args, "%"+search+"%")
		}

		// Count total records
		countQuery := "SELECT COUNT(*) FROM (" + queryBuilder + ") as count_query"
		var total int
		if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to count users",
				"error":   err.Error(),
			})
			return
		}

		// Add ordering and pagination
		queryBuilder += " ORDER BY created_at DESC"
		argCount++
		queryBuilder += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, perPage)

		argCount++
		queryBuilder += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, offset)

		rows, err := db.Query(queryBuilder, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch users",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var users []map[string]interface{}
		for rows.Next() {
			var user map[string]interface{} = make(map[string]interface{})
			var id, username, email, firstName, lastName, userRole string
			var isActive bool
			var locID sql.NullString
			var createdAt time.Time

			err := rows.Scan(&id, &username, &email, &firstName, &lastName, &userRole, &isActive, &locID, &createdAt)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan user data",
					"error":   err.Error(),
				})
				return
			}

			user["id"] = id
			user["username"] = username
			user["email"] = email
			user["first_name"] = firstName
			user["last_name"] = lastName
			user["role"] = userRole
			user["is_active"] = isActive
			if locID.Valid {
				user["location_id"] = locID.String
			} else {
				user["location_id"] = nil
			}
			user["created_at"] = createdAt

			users = append(users, user)
		}

		totalPages := (total + perPage - 1) / perPage

		c.JSON(200, gin.H{
			"success": true,
			"message": "Users retrieved successfully",
			"data":    users,
			"meta": gin.H{
				"current_page": page,
				"per_page":     perPage,
				"total":        total,
				"total_pages":  totalPages,
			},
		})
	}
}

// Admin handler - Get categories with pagination
func getAdminCategories(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Parse pagination parameters
		page := 1
		perPage := 20
		activeOnly := c.Query("active_only") == "true"
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

		// Build query with filters (scoped to org)
		queryBuilder := "SELECT id, name, description, color, sort_order, is_active, created_at, updated_at FROM categories WHERE org_id = $1"
		args := []interface{}{orgID}
		argCount := 1

		if activeOnly {
			queryBuilder += " AND is_active = true"
		}

		if search != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argCount, argCount)
			args = append(args, "%"+search+"%")
		}

		// Count total records
		countQuery := "SELECT COUNT(*) FROM (" + queryBuilder + ") as count_query"
		var total int
		if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to count categories",
				"error":   err.Error(),
			})
			return
		}

		// Add ordering and pagination
		queryBuilder += " ORDER BY sort_order ASC, name ASC"
		argCount++
		queryBuilder += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, perPage)

		argCount++
		queryBuilder += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, offset)

		rows, err := db.Query(queryBuilder, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch categories",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var categories []models.Category
		for rows.Next() {
			var category models.Category

			err := rows.Scan(
				&category.ID, &category.Name, &category.Description, &category.Color,
				&category.SortOrder, &category.IsActive, &category.CreatedAt, &category.UpdatedAt,
			)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan category",
					"error":   err.Error(),
				})
				return
			}

			categories = append(categories, category)
		}

		totalPages := (total + perPage - 1) / perPage

		c.JSON(200, gin.H{
			"success": true,
			"message": "Categories retrieved successfully",
			"data":    categories,
			"meta": gin.H{
				"current_page": page,
				"per_page":     perPage,
				"total":        total,
				"total_pages":  totalPages,
			},
		})
	}
}

// Admin handler - Get tables with pagination
func getAdminTables(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Parse pagination parameters
		page := 1
		perPage := 20
		location := c.Query("location")
		status := c.Query("status") // "occupied", "available", or empty for all
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

		// Build query with filters (scoped to org/location)
		queryBuilder := `
			SELECT t.id, t.table_number, t.seating_capacity, t.location, t.floor, t.is_occupied,
			       t.created_at, t.updated_at,
			       o.id as order_id, o.order_number, o.customer_name, o.status as order_status,
			       o.created_at as order_created_at, o.total_amount
			FROM dining_tables t
			LEFT JOIN orders o ON t.id = o.table_id AND o.status NOT IN ('completed', 'cancelled')
			WHERE t.org_id = $1 AND t.location_id = $2
		`

		args := []interface{}{orgID, locationID}
		argCount := 2

		if location != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND t.location ILIKE $%d", argCount)
			args = append(args, "%"+location+"%")
		}

		if status == "occupied" {
			queryBuilder += " AND t.is_occupied = true"
		} else if status == "available" {
			queryBuilder += " AND t.is_occupied = false"
		}

		if search != "" {
			argCount++
			queryBuilder += fmt.Sprintf(" AND (t.table_number ILIKE $%d OR t.location ILIKE $%d)", argCount, argCount)
			args = append(args, "%"+search+"%")
		}

		// Count total records
		countQuery := "SELECT COUNT(*) FROM (" + queryBuilder + ") as count_query"
		var total int
		if err := db.QueryRow(countQuery, args...).Scan(&total); err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to count tables",
				"error":   err.Error(),
			})
			return
		}

		// Add ordering and pagination
		queryBuilder += " ORDER BY t.table_number ASC"
		argCount++
		queryBuilder += fmt.Sprintf(" LIMIT $%d", argCount)
		args = append(args, perPage)

		argCount++
		queryBuilder += fmt.Sprintf(" OFFSET $%d", argCount)
		args = append(args, offset)

		rows, err := db.Query(queryBuilder, args...)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch tables",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var tables []map[string]interface{}
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
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to scan table",
					"error":   err.Error(),
				})
				return
			}

			// Create table data with current order info
			tableData := map[string]interface{}{
				"id":               table.ID,
				"table_number":     table.TableNumber,
				"seating_capacity": table.SeatingCapacity,
				"location":         table.Location,
				"floor":            table.Floor,
				"is_occupied":      table.IsOccupied,
				"created_at":       table.CreatedAt,
				"updated_at":       table.UpdatedAt,
				"current_order":    nil,
			}

			// Add current order info if available
			if orderID.Valid {
				tableData["current_order"] = map[string]interface{}{
					"id":            orderID.String,
					"order_number":  orderNumber.String,
					"customer_name": customerName.String,
					"status":        orderStatus.String,
					"created_at":    orderCreatedAt.Time,
					"total_amount":  totalAmount.Float64,
				}
			}

			tables = append(tables, tableData)
		}

		totalPages := (total + perPage - 1) / perPage

		c.JSON(200, gin.H{
			"success": true,
			"message": "Tables retrieved successfully",
			"data":    tables,
			"meta": gin.H{
				"current_page": page,
				"per_page":     perPage,
				"total":        total,
				"total_pages":  totalPages,
			},
		})
	}
}

// Admin handler - Delete order
func deleteOrder(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orderID := c.Param("id")

		orgID, locationID, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(401, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Start a transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to start transaction",
				"error":   err.Error(),
			})
			return
		}
		defer tx.Rollback()

		// Get order details first to update table status if needed (scoped to org/location)
		var tableID sql.NullString
		var orderStatus string
		err = tx.QueryRow(`
			SELECT table_id, status FROM orders WHERE id = $1 AND org_id = $2 AND location_id = $3
		`, orderID, orgID, locationID).Scan(&tableID, &orderStatus)

		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Order not found",
			})
			return
		} else if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch order",
				"error":   err.Error(),
			})
			return
		}

		// Delete order items first (due to foreign key constraint)
		_, err = tx.Exec("DELETE FROM order_items WHERE order_id = $1", orderID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete order items",
				"error":   err.Error(),
			})
			return
		}

		// Delete payments associated with the order
		_, err = tx.Exec("DELETE FROM payments WHERE order_id = $1", orderID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete payments",
				"error":   err.Error(),
			})
			return
		}

		// Delete the order
		result, err := tx.Exec("DELETE FROM orders WHERE id = $1", orderID)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to delete order",
				"error":   err.Error(),
			})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(404, gin.H{
				"success": false,
				"message": "Order not found",
			})
			return
		}

		// If order had a table, check if we need to update table status
		if tableID.Valid {
			// Check if there are any other active orders for this table
			var otherOrderCount int
			err = tx.QueryRow(`
				SELECT COUNT(*) FROM orders
				WHERE table_id = $1 AND status NOT IN ('completed', 'cancelled')
			`, tableID.String).Scan(&otherOrderCount)

			if err == nil && otherOrderCount == 0 {
				// No other active orders, set table as available
				_, err = tx.Exec(`
					UPDATE dining_tables SET is_occupied = false, updated_at = CURRENT_TIMESTAMP
					WHERE id = $1
				`, tableID.String)
				if err != nil {
					// Log but don't fail the delete
					fmt.Printf("Failed to update table status: %v\n", err)
				}
			}
		}

		// Commit transaction
		if err = tx.Commit(); err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to commit transaction",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Order deleted successfully",
		})
	}
}

// Helper function to convert string to pointer
func stringPtr(s string) *string {
	return &s
}

// getStaffForPinLogin returns minimal user info for the PIN login user-picker.
// Only active users with a PIN set are returned. No sensitive data is exposed.
func getStaffForPinLogin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		rows, err := db.Query(`
			SELECT id, first_name, last_name, role
			FROM users
			WHERE is_active = true AND pin_hash IS NOT NULL
			ORDER BY first_name ASC, last_name ASC
		`)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to fetch staff",
				"error":   err.Error(),
			})
			return
		}
		defer rows.Close()

		var staff []map[string]interface{}
		for rows.Next() {
			var id, firstName, lastName, role string
			if err := rows.Scan(&id, &firstName, &lastName, &role); err != nil {
				continue
			}
			staff = append(staff, map[string]interface{}{
				"id":         id,
				"first_name": firstName,
				"last_name":  lastName,
				"role":       role,
			})
		}

		if staff == nil {
			staff = []map[string]interface{}{}
		}

		c.JSON(200, gin.H{
			"success": true,
			"message": "Staff retrieved successfully",
			"data":    staff,
		})
	}
}

// Setup handler - Check if initial setup is required
func checkSetupStatus(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check if any admin users exist
		var adminCount int
		err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to check setup status",
				"error":   err.Error(),
			})
			return
		}

		// Check if any users exist at all
		var totalUsers int
		db.QueryRow("SELECT COUNT(*) FROM users").Scan(&totalUsers)

		c.JSON(200, gin.H{
			"success": true,
			"message": "Setup status retrieved",
			"data": gin.H{
				"needs_setup":  adminCount == 0,
				"has_admin":    adminCount > 0,
				"total_users":  totalUsers,
				"admin_count":  adminCount,
			},
		})
	}
}

// Setup handler - Create initial admin user (only works if no admin exists)
func createInitialAdmin(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// First check if any admin already exists
		var adminCount int
		err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminCount)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to check admin status",
				"error":   err.Error(),
			})
			return
		}

		if adminCount > 0 {
			c.JSON(403, gin.H{
				"success": false,
				"message": "Admin user already exists. Use the admin panel to manage users.",
				"error":   "admin_exists",
			})
			return
		}

		// Parse request
		var req struct {
			Username  string `json:"username" binding:"required"`
			Email     string `json:"email" binding:"required"`
			Password  string `json:"password" binding:"required"`
			FirstName string `json:"first_name" binding:"required"`
			LastName  string `json:"last_name" binding:"required"`
			Pin       string `json:"pin"`
			// Optional store settings
			StoreName      string `json:"store_name"`
			LocationName   string `json:"location_name"`
			LocationCode   string `json:"location_code"`
			Currency       string `json:"currency"`
			CurrencySymbol string `json:"currency_symbol"`
			TaxRate        string `json:"tax_rate"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Invalid request body",
				"error":   err.Error(),
			})
			return
		}

		// Validate password length
		if len(req.Password) < 6 {
			c.JSON(400, gin.H{
				"success": false,
				"message": "Password must be at least 6 characters",
				"error":   "password_too_short",
			})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to hash password",
				"error":   err.Error(),
			})
			return
		}

		// Hash PIN if provided
		var pinHash *string
		if req.Pin != "" {
			if len(req.Pin) != 4 {
				c.JSON(400, gin.H{
					"success": false,
					"message": "PIN must be exactly 4 digits",
					"error":   "invalid_pin",
				})
				return
			}
			for _, ch := range req.Pin {
				if ch < '0' || ch > '9' {
					c.JSON(400, gin.H{
						"success": false,
						"message": "PIN must contain only digits",
						"error":   "invalid_pin",
					})
					return
				}
			}
			hashedPin, err := bcrypt.GenerateFromPassword([]byte(req.Pin), bcrypt.DefaultCost)
			if err != nil {
				c.JSON(500, gin.H{
					"success": false,
					"message": "Failed to hash PIN",
					"error":   err.Error(),
				})
				return
			}
			pinHashStr := string(hashedPin)
			pinHash = &pinHashStr
		}

		// Start transaction
		tx, err := db.Begin()
		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to start transaction",
				"error":   err.Error(),
			})
			return
		}
		defer tx.Rollback()

		// Use the default org and location for initial setup
		defaultOrgID := "00000000-0000-0000-0000-000000000001"
		defaultLocationID := "00000000-0000-0000-0000-000000000002"

		// Create admin user with default org/location
		var userID string
		err = tx.QueryRow(`
			INSERT INTO users (username, email, password_hash, pin_hash, first_name, last_name, role, org_id, location_id)
			VALUES ($1, $2, $3, $4, $5, $6, 'admin', $7, $8)
			RETURNING id
		`, req.Username, req.Email, string(hashedPassword), pinHash, req.FirstName, req.LastName, defaultOrgID, defaultLocationID).Scan(&userID)

		if err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to create admin user",
				"error":   err.Error(),
			})
			return
		}

		// Update default organization name from store name
		if req.StoreName != "" {
			slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(req.StoreName), " ", "-"))
			tx.Exec(`UPDATE organizations SET name = $1, slug = $2 WHERE id = $3`, req.StoreName, slug, defaultOrgID)
		}

		// Update default location with provided name and code
		if req.LocationName != "" || req.LocationCode != "" {
			if req.LocationName != "" && req.LocationCode != "" {
				tx.Exec(`UPDATE locations SET name = $1, code = $2 WHERE id = $3`, req.LocationName, req.LocationCode, defaultLocationID)
			} else if req.LocationName != "" {
				tx.Exec(`UPDATE locations SET name = $1 WHERE id = $2`, req.LocationName, defaultLocationID)
			} else {
				tx.Exec(`UPDATE locations SET code = $1 WHERE id = $2`, req.LocationCode, defaultLocationID)
			}
		}

		// Save store settings if provided (scoped to default org/location)
		if req.StoreName != "" {
			tx.Exec(`
				INSERT INTO settings (org_id, location_id, key, value) VALUES ($1, $2, 'restaurant_name', $3)
				ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = EXCLUDED.value
			`, defaultOrgID, defaultLocationID, req.StoreName)
		}
		if req.Currency != "" {
			tx.Exec(`
				INSERT INTO settings (org_id, location_id, key, value) VALUES ($1, $2, 'currency', $3)
				ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = EXCLUDED.value
			`, defaultOrgID, defaultLocationID, req.Currency)
		}
		if req.CurrencySymbol != "" {
			tx.Exec(`
				INSERT INTO settings (org_id, location_id, key, value) VALUES ($1, $2, 'currency_symbol', $3)
				ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = EXCLUDED.value
			`, defaultOrgID, defaultLocationID, req.CurrencySymbol)
		}
		if req.TaxRate != "" {
			tx.Exec(`
				INSERT INTO settings (org_id, location_id, key, value) VALUES ($1, $2, 'tax_rate', $3)
				ON CONFLICT (org_id, location_id, key) DO UPDATE SET value = EXCLUDED.value
			`, defaultOrgID, defaultLocationID, req.TaxRate)
		}

		// Commit transaction
		if err = tx.Commit(); err != nil {
			c.JSON(500, gin.H{
				"success": false,
				"message": "Failed to commit transaction",
				"error":   err.Error(),
			})
			return
		}

		c.JSON(201, gin.H{
			"success": true,
			"message": "Initial setup completed successfully",
			"data": gin.H{
				"user_id":  userID,
				"username": req.Username,
				"role":     "admin",
			},
		})
	}
}

// ============================================================
// Location Management Handlers
// ============================================================

// getLocations returns all locations for the current org
func getLocations(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		rows, err := db.Query(`
			SELECT l.id, l.org_id, l.name, l.code, l.address, l.phone, l.is_active, l.created_at, l.updated_at,
			       (SELECT COUNT(*) FROM users u WHERE u.location_id = l.id) as staff_count,
			       (SELECT COUNT(*) FROM orders o WHERE o.location_id = l.id AND o.status NOT IN ('completed', 'cancelled')) as active_orders
			FROM locations l
			WHERE l.org_id = $1
			ORDER BY l.name ASC
		`, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch locations", "error": err.Error()})
			return
		}
		defer rows.Close()

		var locations []map[string]interface{}
		for rows.Next() {
			var id, orgIDStr, name, code string
			var address, phone sql.NullString
			var isActive bool
			var createdAt, updatedAt time.Time
			var staffCount, activeOrders int

			if err := rows.Scan(&id, &orgIDStr, &name, &code, &address, &phone, &isActive, &createdAt, &updatedAt, &staffCount, &activeOrders); err != nil {
				continue
			}

			loc := map[string]interface{}{
				"id":            id,
				"org_id":        orgIDStr,
				"name":          name,
				"code":          code,
				"address":       nil,
				"phone":         nil,
				"is_active":     isActive,
				"created_at":    createdAt,
				"updated_at":    updatedAt,
				"staff_count":   staffCount,
				"active_orders": activeOrders,
			}
			if address.Valid {
				loc["address"] = address.String
			}
			if phone.Valid {
				loc["phone"] = phone.String
			}
			locations = append(locations, loc)
		}

		if locations == nil {
			locations = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Locations retrieved successfully", "data": locations})
	}
}

// createLocation creates a new location for the current org
func createLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req models.CreateLocationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body", "error": err.Error()})
			return
		}

		var id string
		err := db.QueryRow(`
			INSERT INTO locations (org_id, name, code, address, phone)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, orgID, req.Name, req.Code, req.Address, req.Phone).Scan(&id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to create location", "error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"success": true, "message": "Location created successfully", "data": map[string]string{"id": id}})
	}
}

// updateLocation updates a location
func updateLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		locationIDParam := c.Param("id")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req models.UpdateLocationRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body", "error": err.Error()})
			return
		}

		// Build dynamic update
		updates := []string{}
		args := []interface{}{}
		argCount := 1

		if req.Name != nil {
			updates = append(updates, fmt.Sprintf("name = $%d", argCount))
			args = append(args, *req.Name)
			argCount++
		}
		if req.Code != nil {
			updates = append(updates, fmt.Sprintf("code = $%d", argCount))
			args = append(args, *req.Code)
			argCount++
		}
		if req.Address != nil {
			updates = append(updates, fmt.Sprintf("address = $%d", argCount))
			args = append(args, *req.Address)
			argCount++
		}
		if req.Phone != nil {
			updates = append(updates, fmt.Sprintf("phone = $%d", argCount))
			args = append(args, *req.Phone)
			argCount++
		}
		if req.IsActive != nil {
			updates = append(updates, fmt.Sprintf("is_active = $%d", argCount))
			args = append(args, *req.IsActive)
			argCount++
		}

		if len(updates) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "No fields to update"})
			return
		}

		updates = append(updates, "updated_at = CURRENT_TIMESTAMP")
		args = append(args, locationIDParam)
		idIdx := argCount
		argCount++
		args = append(args, orgID)

		query := fmt.Sprintf(`UPDATE locations SET %s WHERE id = $%d AND org_id = $%d`, strings.Join(updates, ", "), idIdx, argCount)

		result, err := db.Exec(query, args...)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to update location", "error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Location updated successfully"})
	}
}

// deleteLocation deletes a location (only if no active orders/staff)
func deleteLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		locationIDParam := c.Param("id")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Check for active orders
		var activeOrders int
		db.QueryRow("SELECT COUNT(*) FROM orders WHERE location_id = $1 AND org_id = $2 AND status NOT IN ('completed', 'cancelled')", locationIDParam, orgID).Scan(&activeOrders)
		if activeOrders > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Cannot delete location with active orders", "error": "has_active_orders"})
			return
		}

		result, err := db.Exec("DELETE FROM locations WHERE id = $1 AND org_id = $2", locationIDParam, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to delete location", "error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Location deleted successfully"})
	}
}

// getLocationProducts returns product overrides for a specific location
func getLocationProducts(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		locationIDParam := c.Param("id")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Verify location belongs to org
		var exists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1 AND org_id = $2)", locationIDParam, orgID).Scan(&exists)
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location not found"})
			return
		}

		rows, err := db.Query(`
			SELECT p.id, p.name, p.price as base_price, p.is_available as base_available,
			       lp.id as override_id, lp.price_override, lp.is_available as override_available
			FROM products p
			LEFT JOIN location_products lp ON p.id = lp.product_id AND lp.location_id = $1
			WHERE p.org_id = $2
			ORDER BY p.name ASC
		`, locationIDParam, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to fetch location products", "error": err.Error()})
			return
		}
		defer rows.Close()

		var products []map[string]interface{}
		for rows.Next() {
			var pID, pName string
			var basePrice float64
			var baseAvailable bool
			var overrideID sql.NullString
			var priceOverride sql.NullFloat64
			var overrideAvailable sql.NullBool

			if err := rows.Scan(&pID, &pName, &basePrice, &baseAvailable, &overrideID, &priceOverride, &overrideAvailable); err != nil {
				continue
			}

			product := map[string]interface{}{
				"product_id":     pID,
				"product_name":   pName,
				"base_price":     basePrice,
				"base_available": baseAvailable,
				"has_override":   overrideID.Valid,
			}
			if priceOverride.Valid {
				product["price_override"] = priceOverride.Float64
			}
			if overrideAvailable.Valid {
				product["is_available"] = overrideAvailable.Bool
			}
			products = append(products, product)
		}

		if products == nil {
			products = []map[string]interface{}{}
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Location products retrieved successfully", "data": products})
	}
}

// setLocationProductOverride creates or updates a product override for a location
func setLocationProductOverride(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		locationIDParam := c.Param("id")
		productIDParam := c.Param("pid")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Verify location and product belong to org
		var locExists, prodExists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1 AND org_id = $2)", locationIDParam, orgID).Scan(&locExists)
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND org_id = $2)", productIDParam, orgID).Scan(&prodExists)
		if !locExists || !prodExists {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location or product not found"})
			return
		}

		var req models.LocationProductOverrideRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body", "error": err.Error()})
			return
		}

		_, err := db.Exec(`
			INSERT INTO location_products (location_id, product_id, price_override, is_available)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (location_id, product_id) DO UPDATE SET
				price_override = EXCLUDED.price_override,
				is_available = EXCLUDED.is_available,
				updated_at = CURRENT_TIMESTAMP
		`, locationIDParam, productIDParam, req.PriceOverride, req.IsAvailable)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to set product override", "error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Product override set successfully"})
	}
}

// removeLocationProductOverride removes a product override for a location (reverts to base)
func removeLocationProductOverride(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		locationIDParam := c.Param("id")
		productIDParam := c.Param("pid")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		// Verify location belongs to org
		var locExists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1 AND org_id = $2)", locationIDParam, orgID).Scan(&locExists)
		if !locExists {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location not found"})
			return
		}

		result, err := db.Exec("DELETE FROM location_products WHERE location_id = $1 AND product_id = $2", locationIDParam, productIDParam)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to remove product override", "error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Product override not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Product override removed successfully"})
	}
}

// reassignUserLocation moves a user to a different location
func reassignUserLocation(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDParam := c.Param("id")
		orgID, _, ok := middleware.GetOrgLocationFromContext(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authentication required"})
			return
		}

		var req struct {
			LocationID string `json:"location_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "Invalid request body", "error": err.Error()})
			return
		}

		// Verify location belongs to org
		var locExists bool
		db.QueryRow("SELECT EXISTS(SELECT 1 FROM locations WHERE id = $1 AND org_id = $2)", req.LocationID, orgID).Scan(&locExists)
		if !locExists {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "Location not found"})
			return
		}

		result, err := db.Exec("UPDATE users SET location_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND org_id = $3", req.LocationID, userIDParam, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Failed to reassign user", "error": err.Error()})
			return
		}

		rowsAffected, _ := result.RowsAffected()
		if rowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "User not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "message": "User location updated successfully"})
	}
}
