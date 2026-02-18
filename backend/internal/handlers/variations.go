package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// VariationHandler handles global variation group and item CRUD
type VariationHandler struct {
	db *sql.DB
}

// NewVariationHandler creates a new VariationHandler
func NewVariationHandler(db *sql.DB) *VariationHandler {
	return &VariationHandler{db: db}
}

// ListVariationGroups returns paginated variation groups for the org
func (h *VariationHandler) ListVariationGroups(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	search := c.Query("search")

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	offset := (page - 1) * perPage

	// Build WHERE clause
	where := "WHERE vg.org_id = $1"
	args := []interface{}{orgID}
	argIdx := 2

	if search != "" {
		where += fmt.Sprintf(" AND vg.name ILIKE $%d", argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM variation_groups vg %s", where)
	if err := h.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to count variation groups",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Fetch groups with product count
	query := fmt.Sprintf(`
		SELECT vg.id, vg.org_id, vg.name, vg.selection_type, vg.is_required,
		       vg.min_selections, vg.max_selections, vg.sort_order, vg.is_active,
		       vg.created_at, vg.updated_at,
		       COUNT(DISTINCT pv.product_id) as product_count
		FROM variation_groups vg
		LEFT JOIN product_variations pv ON pv.variation_group_id = vg.id
		%s
		GROUP BY vg.id
		ORDER BY vg.sort_order ASC, vg.name ASC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, perPage, offset)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch variation groups",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	var groups []models.VariationGroup
	for rows.Next() {
		var g models.VariationGroup
		if err := rows.Scan(
			&g.ID, &g.OrgID, &g.Name, &g.SelectionType, &g.IsRequired,
			&g.MinSelections, &g.MaxSelections, &g.SortOrder, &g.IsActive,
			&g.CreatedAt, &g.UpdatedAt, &g.ProductCount,
		); err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to scan variation group",
				Error:   stringPtr(err.Error()),
			})
			return
		}
		groups = append(groups, g)
	}

	// Load items for each group
	for i := range groups {
		items, err := h.loadVariationItems(groups[i].ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to load variation items",
				Error:   stringPtr(err.Error()),
			})
			return
		}
		groups[i].Items = items
	}

	if groups == nil {
		groups = []models.VariationGroup{}
	}

	totalPages := (total + perPage - 1) / perPage
	c.JSON(http.StatusOK, models.PaginatedResponse{
		Success: true,
		Message: "Variation groups retrieved successfully",
		Data:    groups,
		Meta: models.MetaData{
			CurrentPage: page,
			PerPage:     perPage,
			Total:       total,
			TotalPages:  totalPages,
		},
	})
}

// GetVariationGroup returns a single variation group with items
func (h *VariationHandler) GetVariationGroup(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid variation group ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var g models.VariationGroup
	err = h.db.QueryRow(`
		SELECT vg.id, vg.org_id, vg.name, vg.selection_type, vg.is_required,
		       vg.min_selections, vg.max_selections, vg.sort_order, vg.is_active,
		       vg.created_at, vg.updated_at,
		       COUNT(DISTINCT pv.product_id) as product_count
		FROM variation_groups vg
		LEFT JOIN product_variations pv ON pv.variation_group_id = vg.id
		WHERE vg.id = $1 AND vg.org_id = $2
		GROUP BY vg.id
	`, groupID, orgID).Scan(
		&g.ID, &g.OrgID, &g.Name, &g.SelectionType, &g.IsRequired,
		&g.MinSelections, &g.MaxSelections, &g.SortOrder, &g.IsActive,
		&g.CreatedAt, &g.UpdatedAt, &g.ProductCount,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Variation group not found",
			Error:   stringPtr("variation_group_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch variation group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	items, err := h.loadVariationItems(g.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to load variation items",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	g.Items = items

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Variation group retrieved successfully",
		Data:    g,
	})
}

// CreateVariationGroup creates a new global variation group with optional inline items
func (h *VariationHandler) CreateVariationGroup(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	var req models.CreateVariationGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if req.SelectionType != "single" && req.SelectionType != "multiple" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "selection_type must be 'single' or 'multiple'",
			Error:   stringPtr("invalid_selection_type"),
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

	groupID := uuid.New()
	var g models.VariationGroup
	err = tx.QueryRow(`
		INSERT INTO variation_groups (id, org_id, name, selection_type, is_required, min_selections, max_selections, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, org_id, name, selection_type, is_required, min_selections, max_selections, sort_order, is_active, created_at, updated_at
	`, groupID, orgID, req.Name, req.SelectionType, req.IsRequired, req.MinSelections, req.MaxSelections, req.SortOrder).Scan(
		&g.ID, &g.OrgID, &g.Name, &g.SelectionType,
		&g.IsRequired, &g.MinSelections, &g.MaxSelections, &g.SortOrder, &g.IsActive,
		&g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create variation group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Insert items if provided
	if len(req.Items) > 0 {
		for _, itemReq := range req.Items {
			itemID := uuid.New()
			var item models.VariationItem
			err = tx.QueryRow(`
				INSERT INTO variation_items (id, variation_group_id, name, price_adjustment, is_default, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id, variation_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
			`, itemID, groupID, itemReq.Name, itemReq.PriceAdjustment, itemReq.IsDefault, itemReq.SortOrder).Scan(
				&item.ID, &item.VariationGroupID, &item.Name, &item.PriceAdjustment,
				&item.IsDefault, &item.IsAvailable, &item.SortOrder,
				&item.CreatedAt, &item.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to create variation item",
					Error:   stringPtr(err.Error()),
				})
				return
			}
			g.Items = append(g.Items, item)
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

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Variation group created successfully",
		Data:    g,
	})
}

// UpdateVariationGroup updates a global variation group
func (h *VariationHandler) UpdateVariationGroup(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid variation group ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var req models.UpdateVariationGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	if req.SelectionType != nil && *req.SelectionType != "single" && *req.SelectionType != "multiple" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "selection_type must be 'single' or 'multiple'",
			Error:   stringPtr("invalid_selection_type"),
		})
		return
	}

	// Build dynamic update
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.SelectionType != nil {
		setClauses = append(setClauses, fmt.Sprintf("selection_type = $%d", argIdx))
		args = append(args, *req.SelectionType)
		argIdx++
	}
	if req.IsRequired != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_required = $%d", argIdx))
		args = append(args, *req.IsRequired)
		argIdx++
	}
	if req.MinSelections != nil {
		setClauses = append(setClauses, fmt.Sprintf("min_selections = $%d", argIdx))
		args = append(args, *req.MinSelections)
		argIdx++
	}
	if req.MaxSelections != nil {
		setClauses = append(setClauses, fmt.Sprintf("max_selections = $%d", argIdx))
		args = append(args, *req.MaxSelections)
		argIdx++
	}
	if req.SortOrder != nil {
		setClauses = append(setClauses, fmt.Sprintf("sort_order = $%d", argIdx))
		args = append(args, *req.SortOrder)
		argIdx++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argIdx))
		args = append(args, *req.IsActive)
		argIdx++
	}

	if len(setClauses) == 0 {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "No fields to update",
			Error:   stringPtr("no_fields"),
		})
		return
	}

	query := fmt.Sprintf(`
		UPDATE variation_groups SET %s
		WHERE id = $%d AND org_id = $%d
		RETURNING id, org_id, name, selection_type, is_required, min_selections, max_selections, sort_order, is_active, created_at, updated_at
	`, strings.Join(setClauses, ", "), argIdx, argIdx+1)
	args = append(args, groupID, orgID)

	var g models.VariationGroup
	err = h.db.QueryRow(query, args...).Scan(
		&g.ID, &g.OrgID, &g.Name, &g.SelectionType,
		&g.IsRequired, &g.MinSelections, &g.MaxSelections, &g.SortOrder, &g.IsActive,
		&g.CreatedAt, &g.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Variation group not found",
			Error:   stringPtr("variation_group_not_found"),
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update variation group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	items, err := h.loadVariationItems(g.ID)
	if err == nil {
		g.Items = items
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Variation group updated successfully",
		Data:    g,
	})
}

// DeleteVariationGroup deletes a global variation group
func (h *VariationHandler) DeleteVariationGroup(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid variation group ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	result, err := h.db.Exec("DELETE FROM variation_groups WHERE id = $1 AND org_id = $2", groupID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete variation group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Variation group not found",
			Error:   stringPtr("variation_group_not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Variation group deleted successfully",
	})
}

// CreateVariationItem adds an item to an existing variation group
func (h *VariationHandler) CreateVariationItem(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid group ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Verify group belongs to org
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM variation_groups WHERE id = $1 AND org_id = $2)", groupID, orgID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Variation group not found",
			Error:   stringPtr("variation_group_not_found"),
		})
		return
	}

	var req models.CreateVariationItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	itemID := uuid.New()
	var item models.VariationItem
	err = h.db.QueryRow(`
		INSERT INTO variation_items (id, variation_group_id, name, price_adjustment, is_default, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, variation_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
	`, itemID, groupID, req.Name, req.PriceAdjustment, req.IsDefault, req.SortOrder).Scan(
		&item.ID, &item.VariationGroupID, &item.Name, &item.PriceAdjustment,
		&item.IsDefault, &item.IsAvailable, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create variation item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Variation item created successfully",
		Data:    item,
	})
}

// DeleteVariationItem deletes a single variation item
func (h *VariationHandler) DeleteVariationItem(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid item ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Delete item only if it belongs to a group in this org
	result, err := h.db.Exec(`
		DELETE FROM variation_items WHERE id = $1
		AND variation_group_id IN (SELECT id FROM variation_groups WHERE org_id = $2)
	`, itemID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete variation item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Variation item not found",
			Error:   stringPtr("variation_item_not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Variation item deleted successfully",
	})
}

// LinkVariationsToProduct sets the global variation links for a product with per-item prices
func (h *VariationHandler) LinkVariationsToProduct(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Verify product belongs to org
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND org_id = $2)", productID, orgID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Product not found",
			Error:   stringPtr("product_not_found"),
		})
		return
	}

	var req models.LinkVariationsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
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

	// Delete existing links and prices
	_, err = tx.Exec("DELETE FROM product_variation_prices WHERE product_id = $1", productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to clear existing prices",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	_, err = tx.Exec("DELETE FROM product_variations WHERE product_id = $1", productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to clear existing links",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Insert new links with per-item prices
	for _, vg := range req.VariationGroups {
		vgID, err := uuid.Parse(vg.VariationGroupID)
		if err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: fmt.Sprintf("Invalid variation group ID: %s", vg.VariationGroupID),
				Error:   stringPtr("invalid_uuid"),
			})
			return
		}

		// Verify group belongs to org
		var groupExists bool
		err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM variation_groups WHERE id = $1 AND org_id = $2)", vgID, orgID).Scan(&groupExists)
		if err != nil || !groupExists {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: fmt.Sprintf("Variation group not found: %s", vg.VariationGroupID),
				Error:   stringPtr("variation_group_not_found"),
			})
			return
		}

		// Insert product_variations link
		linkID := uuid.New()
		_, err = tx.Exec(
			"INSERT INTO product_variations (id, product_id, variation_group_id, sort_order) VALUES ($1, $2, $3, $4)",
			linkID, productID, vgID, vg.SortOrder,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to link variation",
				Error:   stringPtr(err.Error()),
			})
			return
		}

		// Insert per-item prices
		for _, ip := range vg.ItemPrices {
			itemID, err := uuid.Parse(ip.VariationItemID)
			if err != nil {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: fmt.Sprintf("Invalid variation item ID: %s", ip.VariationItemID),
					Error:   stringPtr("invalid_uuid"),
				})
				return
			}

			// Verify item belongs to this group
			var itemExists bool
			err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM variation_items WHERE id = $1 AND variation_group_id = $2)", itemID, vgID).Scan(&itemExists)
			if err != nil || !itemExists {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: fmt.Sprintf("Variation item %s does not belong to group %s", ip.VariationItemID, vg.VariationGroupID),
					Error:   stringPtr("variation_item_not_in_group"),
				})
				return
			}

			priceID := uuid.New()
			_, err = tx.Exec(
				"INSERT INTO product_variation_prices (id, product_id, variation_item_id, price) VALUES ($1, $2, $3, $4)",
				priceID, productID, itemID, ip.Price,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to save variation price",
					Error:   stringPtr(err.Error()),
				})
				return
			}
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

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Product variations updated successfully",
	})
}

// GetProductVariationLinks returns the variation groups linked to a product with per-item prices
func (h *VariationHandler) GetProductVariationLinks(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	rows, err := h.db.Query(`
		SELECT vg.id, vg.name, vg.selection_type, vg.is_required, vg.min_selections, vg.max_selections,
		       pv.sort_order,
		       vi.id, vi.name, COALESCE(pvp.price, 0), vi.is_default, vi.is_available, vi.sort_order
		FROM product_variations pv
		JOIN variation_groups vg ON vg.id = pv.variation_group_id
		JOIN variation_items vi ON vi.variation_group_id = vg.id
		LEFT JOIN product_variation_prices pvp ON pvp.product_id = pv.product_id AND pvp.variation_item_id = vi.id
		WHERE pv.product_id = $1
		ORDER BY pv.sort_order ASC, vi.sort_order ASC
	`, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch product variation links",
			Error:   stringPtr(err.Error()),
		})
		return
	}
	defer rows.Close()

	// Group results by variation group
	groupMap := make(map[string]*models.ProductVariationLinkResponse)
	var groupOrder []string

	for rows.Next() {
		var (
			groupID       uuid.UUID
			groupName     string
			selectionType string
			isRequired    bool
			minSelections int
			maxSelections int
			sortOrder     int
			itemID        uuid.UUID
			itemName      string
			price         float64
			isDefault     bool
			isAvailable   bool
			itemSortOrder int
		)

		if err := rows.Scan(
			&groupID, &groupName, &selectionType, &isRequired, &minSelections, &maxSelections,
			&sortOrder,
			&itemID, &itemName, &price, &isDefault, &isAvailable, &itemSortOrder,
		); err != nil {
			continue
		}

		gid := groupID.String()
		if _, exists := groupMap[gid]; !exists {
			groupMap[gid] = &models.ProductVariationLinkResponse{
				VariationGroupID: gid,
				GroupName:        groupName,
				SelectionType:    selectionType,
				IsRequired:       isRequired,
				MinSelections:    minSelections,
				MaxSelections:    maxSelections,
				SortOrder:        sortOrder,
				Items:            []models.ProductVariationItemPrice{},
			}
			groupOrder = append(groupOrder, gid)
		}

		groupMap[gid].Items = append(groupMap[gid].Items, models.ProductVariationItemPrice{
			VariationItemID: itemID.String(),
			ItemName:        itemName,
			Price:           price,
			IsDefault:       isDefault,
			IsAvailable:     isAvailable,
			SortOrder:       itemSortOrder,
		})
	}

	// Build ordered result
	result := make([]models.ProductVariationLinkResponse, 0, len(groupOrder))
	for _, gid := range groupOrder {
		result = append(result, *groupMap[gid])
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Product variation links retrieved successfully",
		Data:    result,
	})
}

// loadVariationItems loads all items for a variation group
func (h *VariationHandler) loadVariationItems(groupID uuid.UUID) ([]models.VariationItem, error) {
	rows, err := h.db.Query(`
		SELECT id, variation_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
		FROM variation_items
		WHERE variation_group_id = $1
		ORDER BY sort_order ASC, name ASC
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.VariationItem
	for rows.Next() {
		var item models.VariationItem
		if err := rows.Scan(
			&item.ID, &item.VariationGroupID, &item.Name, &item.PriceAdjustment,
			&item.IsDefault, &item.IsAvailable, &item.SortOrder,
			&item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if items == nil {
		items = []models.VariationItem{}
	}

	return items, nil
}
