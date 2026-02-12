package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// OptionHandler handles product option group and item CRUD
type OptionHandler struct {
	db *sql.DB
}

// NewOptionHandler creates a new OptionHandler
func NewOptionHandler(db *sql.DB) *OptionHandler {
	return &OptionHandler{db: db}
}

// GetOptionGroupsByProduct retrieves all option groups with items for a product
func (h *OptionHandler) GetOptionGroupsByProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
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

	groups, err := h.loadOptionGroups(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch option groups",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Option groups retrieved successfully",
		Data:    groups,
	})
}

// CreateOptionGroup creates an option group with optional inline items
func (h *OptionHandler) CreateOptionGroup(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var req models.CreateOptionGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate selection_type
	if req.SelectionType != "single" && req.SelectionType != "multiple" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "selection_type must be 'single' or 'multiple'",
			Error:   stringPtr("invalid_selection_type"),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
		})
		return
	}

	// Verify product exists and belongs to org
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

	// Insert option group
	groupID := uuid.New()
	var group models.ProductOptionGroup
	err = tx.QueryRow(`
		INSERT INTO product_option_groups (id, product_id, name, selection_type, is_required, min_selections, max_selections, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, product_id, name, selection_type, is_required, min_selections, max_selections, sort_order, created_at, updated_at
	`, groupID, productID, req.Name, req.SelectionType, req.IsRequired, req.MinSelections, req.MaxSelections, req.SortOrder).Scan(
		&group.ID, &group.ProductID, &group.Name, &group.SelectionType,
		&group.IsRequired, &group.MinSelections, &group.MaxSelections, &group.SortOrder,
		&group.CreatedAt, &group.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create option group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Insert items if provided
	if len(req.Items) > 0 {
		for _, itemReq := range req.Items {
			itemID := uuid.New()
			var item models.ProductOptionItem
			err = tx.QueryRow(`
				INSERT INTO product_option_items (id, option_group_id, name, price_adjustment, is_default, sort_order)
				VALUES ($1, $2, $3, $4, $5, $6)
				RETURNING id, option_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
			`, itemID, groupID, itemReq.Name, itemReq.PriceAdjustment, itemReq.IsDefault, itemReq.SortOrder).Scan(
				&item.ID, &item.OptionGroupID, &item.Name, &item.PriceAdjustment,
				&item.IsDefault, &item.IsAvailable, &item.SortOrder,
				&item.CreatedAt, &item.UpdatedAt,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, models.APIResponse{
					Success: false,
					Message: "Failed to create option item",
					Error:   stringPtr(err.Error()),
				})
				return
			}
			group.Items = append(group.Items, item)
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
		Message: "Option group created successfully",
		Data:    group,
	})
}

// UpdateOptionGroup updates an option group's metadata
func (h *OptionHandler) UpdateOptionGroup(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
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

	var req models.UpdateOptionGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Validate selection_type if provided
	if req.SelectionType != nil && *req.SelectionType != "single" && *req.SelectionType != "multiple" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "selection_type must be 'single' or 'multiple'",
			Error:   stringPtr("invalid_selection_type"),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
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

	// Build dynamic update query
	query := "UPDATE product_option_groups SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argIdx := 0

	if req.Name != nil {
		argIdx++
		query += ", name = $" + intToStr(argIdx)
		args = append(args, *req.Name)
	}
	if req.SelectionType != nil {
		argIdx++
		query += ", selection_type = $" + intToStr(argIdx)
		args = append(args, *req.SelectionType)
	}
	if req.IsRequired != nil {
		argIdx++
		query += ", is_required = $" + intToStr(argIdx)
		args = append(args, *req.IsRequired)
	}
	if req.MinSelections != nil {
		argIdx++
		query += ", min_selections = $" + intToStr(argIdx)
		args = append(args, *req.MinSelections)
	}
	if req.MaxSelections != nil {
		argIdx++
		query += ", max_selections = $" + intToStr(argIdx)
		args = append(args, *req.MaxSelections)
	}
	if req.SortOrder != nil {
		argIdx++
		query += ", sort_order = $" + intToStr(argIdx)
		args = append(args, *req.SortOrder)
	}

	argIdx++
	query += " WHERE id = $" + intToStr(argIdx)
	args = append(args, groupID)

	argIdx++
	query += " AND product_id = $" + intToStr(argIdx)
	args = append(args, productID)

	result, err := h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update option group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Option group not found",
			Error:   stringPtr("option_group_not_found"),
		})
		return
	}

	// Fetch updated group with items
	groups, err := h.loadOptionGroups(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to load updated group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	var updatedGroup *models.ProductOptionGroup
	for _, g := range groups {
		if g.ID == groupID {
			gCopy := g
			updatedGroup = &gCopy
			break
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Option group updated successfully",
		Data:    updatedGroup,
	})
}

// DeleteOptionGroup deletes an option group and its items (cascaded)
func (h *OptionHandler) DeleteOptionGroup(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   stringPtr("invalid_uuid"),
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

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   stringPtr("org_context_required"),
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

	result, err := h.db.Exec("DELETE FROM product_option_groups WHERE id = $1 AND product_id = $2", groupID, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete option group",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Option group not found",
			Error:   stringPtr("option_group_not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Option group deleted successfully",
	})
}

// CreateOptionItem adds an item to an existing option group
func (h *OptionHandler) CreateOptionItem(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid group ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var req models.CreateOptionItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Verify group exists
	var exists bool
	err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM product_option_groups WHERE id = $1)", groupID).Scan(&exists)
	if err != nil || !exists {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Option group not found",
			Error:   stringPtr("option_group_not_found"),
		})
		return
	}

	itemID := uuid.New()
	var item models.ProductOptionItem
	err = h.db.QueryRow(`
		INSERT INTO product_option_items (id, option_group_id, name, price_adjustment, is_default, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, option_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
	`, itemID, groupID, req.Name, req.PriceAdjustment, req.IsDefault, req.SortOrder).Scan(
		&item.ID, &item.OptionGroupID, &item.Name, &item.PriceAdjustment,
		&item.IsDefault, &item.IsAvailable, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create option item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Option item created successfully",
		Data:    item,
	})
}

// UpdateOptionItem updates a single option item
func (h *OptionHandler) UpdateOptionItem(c *gin.Context) {
	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid item ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	var req models.UpdateOptionItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	// Build dynamic update query
	query := "UPDATE product_option_items SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argIdx := 0

	if req.Name != nil {
		argIdx++
		query += ", name = $" + intToStr(argIdx)
		args = append(args, *req.Name)
	}
	if req.PriceAdjustment != nil {
		argIdx++
		query += ", price_adjustment = $" + intToStr(argIdx)
		args = append(args, *req.PriceAdjustment)
	}
	if req.IsDefault != nil {
		argIdx++
		query += ", is_default = $" + intToStr(argIdx)
		args = append(args, *req.IsDefault)
	}
	if req.IsAvailable != nil {
		argIdx++
		query += ", is_available = $" + intToStr(argIdx)
		args = append(args, *req.IsAvailable)
	}
	if req.SortOrder != nil {
		argIdx++
		query += ", sort_order = $" + intToStr(argIdx)
		args = append(args, *req.SortOrder)
	}

	argIdx++
	query += " WHERE id = $" + intToStr(argIdx)
	args = append(args, itemID)

	result, err := h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update option item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Option item not found",
			Error:   stringPtr("option_item_not_found"),
		})
		return
	}

	// Fetch updated item
	var item models.ProductOptionItem
	err = h.db.QueryRow(`
		SELECT id, option_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
		FROM product_option_items WHERE id = $1
	`, itemID).Scan(
		&item.ID, &item.OptionGroupID, &item.Name, &item.PriceAdjustment,
		&item.IsDefault, &item.IsAvailable, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch updated item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Option item updated successfully",
		Data:    item,
	})
}

// DeleteOptionItem deletes a single option item
func (h *OptionHandler) DeleteOptionItem(c *gin.Context) {
	itemID, err := uuid.Parse(c.Param("item_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid item ID",
			Error:   stringPtr("invalid_uuid"),
		})
		return
	}

	result, err := h.db.Exec("DELETE FROM product_option_items WHERE id = $1", itemID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete option item",
			Error:   stringPtr(err.Error()),
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Message: "Option item not found",
			Error:   stringPtr("option_item_not_found"),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Option item deleted successfully",
	})
}

// loadOptionGroups loads all option groups with their items for a product
func (h *OptionHandler) loadOptionGroups(productID uuid.UUID) ([]models.ProductOptionGroup, error) {
	groupRows, err := h.db.Query(`
		SELECT id, product_id, name, selection_type, is_required, min_selections, max_selections, sort_order, created_at, updated_at
		FROM product_option_groups
		WHERE product_id = $1
		ORDER BY sort_order ASC, name ASC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer groupRows.Close()

	var groups []models.ProductOptionGroup
	for groupRows.Next() {
		var group models.ProductOptionGroup
		err := groupRows.Scan(
			&group.ID, &group.ProductID, &group.Name, &group.SelectionType,
			&group.IsRequired, &group.MinSelections, &group.MaxSelections, &group.SortOrder,
			&group.CreatedAt, &group.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		groups = append(groups, group)
	}

	// Load items for each group
	for i := range groups {
		itemRows, err := h.db.Query(`
			SELECT id, option_group_id, name, price_adjustment, is_default, is_available, sort_order, created_at, updated_at
			FROM product_option_items
			WHERE option_group_id = $1
			ORDER BY sort_order ASC, name ASC
		`, groups[i].ID)
		if err != nil {
			return nil, err
		}

		var items []models.ProductOptionItem
		for itemRows.Next() {
			var item models.ProductOptionItem
			err := itemRows.Scan(
				&item.ID, &item.OptionGroupID, &item.Name, &item.PriceAdjustment,
				&item.IsDefault, &item.IsAvailable, &item.SortOrder,
				&item.CreatedAt, &item.UpdatedAt,
			)
			if err != nil {
				itemRows.Close()
				return nil, err
			}
			items = append(items, item)
		}
		itemRows.Close()

		groups[i].Items = items
	}

	if groups == nil {
		groups = []models.ProductOptionGroup{}
	}

	return groups, nil
}

// intToStr converts an int to string for query building
func intToStr(i int) string {
	return strconv.Itoa(i)
}
