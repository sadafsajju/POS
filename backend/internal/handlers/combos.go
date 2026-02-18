package handlers

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"pos-backend/internal/middleware"
	"pos-backend/internal/models"
)

// ComboHandler handles combo slot CRUD operations
type ComboHandler struct {
	db *sql.DB
}

// NewComboHandler creates a new ComboHandler
func NewComboHandler(db *sql.DB) *ComboHandler {
	return &ComboHandler{db: db}
}

// GetComboSlotsByProduct returns all combo slots with their choices for a product
func (h *ComboHandler) GetComboSlotsByProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   strPtr("invalid_product_id"),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   strPtr("org_context_required"),
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
			Error:   strPtr("product_not_found"),
		})
		return
	}

	slots, err := h.loadComboSlots(productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to fetch combo slots",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Combo slots fetched successfully",
		Data:    slots,
	})
}

// CreateComboSlot creates a new combo slot with optional inline choices
func (h *ComboHandler) CreateComboSlot(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   strPtr("invalid_product_id"),
		})
		return
	}

	var req models.CreateComboSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   strPtr("org_context_required"),
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
			Error:   strPtr("product_not_found"),
		})
		return
	}

	// Validate choice products belong to the same org
	for _, choice := range req.Choices {
		var choiceExists bool
		err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND org_id = $2)", choice.ProductID, orgID).Scan(&choiceExists)
		if err != nil || !choiceExists {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: fmt.Sprintf("Choice product %s not found in organization", choice.ProductID),
				Error:   strPtr("choice_product_not_found"),
			})
			return
		}
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to start transaction",
			Error:   strPtr(err.Error()),
		})
		return
	}
	defer tx.Rollback()

	slotID := uuid.New()
	_, err = tx.Exec(`
		INSERT INTO combo_slots (id, product_id, name, is_required, sort_order)
		VALUES ($1, $2, $3, $4, $5)
	`, slotID, productID, req.Name, req.IsRequired, req.SortOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create combo slot",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Create inline choices
	for _, choice := range req.Choices {
		_, err = tx.Exec(`
			INSERT INTO combo_slot_choices (id, combo_slot_id, product_id, variation_item_id, price_override, sort_order)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, uuid.New(), slotID, choice.ProductID, choice.VariationItemID, choice.PriceOverride, choice.SortOrder)
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to create combo slot choice",
				Error:   strPtr(err.Error()),
			})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to commit transaction",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Return updated slots
	slots, _ := h.loadComboSlots(productID)
	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Combo slot created successfully",
		Data:    slots,
	})
}

// UpdateComboSlot updates a combo slot's metadata
func (h *ComboHandler) UpdateComboSlot(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   strPtr("invalid_product_id"),
		})
		return
	}

	slotID, err := uuid.Parse(c.Param("slot_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid slot ID",
			Error:   strPtr("invalid_slot_id"),
		})
		return
	}

	var req models.UpdateComboSlotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   strPtr("org_context_required"),
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
			Error:   strPtr("product_not_found"),
		})
		return
	}

	// Build dynamic update
	query := "UPDATE combo_slots SET updated_at = NOW()"
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, *req.Name)
		argIdx++
	}
	if req.IsRequired != nil {
		query += fmt.Sprintf(", is_required = $%d", argIdx)
		args = append(args, *req.IsRequired)
		argIdx++
	}
	if req.SortOrder != nil {
		query += fmt.Sprintf(", sort_order = $%d", argIdx)
		args = append(args, *req.SortOrder)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, slotID)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to update combo slot",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Combo slot updated successfully",
	})
}

// DeleteComboSlot deletes a combo slot and its choices (cascade)
func (h *ComboHandler) DeleteComboSlot(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid product ID",
			Error:   strPtr("invalid_product_id"),
		})
		return
	}

	slotID, err := uuid.Parse(c.Param("slot_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid slot ID",
			Error:   strPtr("invalid_slot_id"),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   strPtr("org_context_required"),
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
			Error:   strPtr("product_not_found"),
		})
		return
	}

	_, err = h.db.Exec("DELETE FROM combo_slots WHERE id = $1 AND product_id = $2", slotID, productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete combo slot",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Combo slot deleted successfully",
	})
}

// CreateComboSlotChoice adds a product choice to a combo slot
func (h *ComboHandler) CreateComboSlotChoice(c *gin.Context) {
	slotID, err := uuid.Parse(c.Param("slot_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid slot ID",
			Error:   strPtr("invalid_slot_id"),
		})
		return
	}

	var req models.CreateComboSlotChoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid request body",
			Error:   strPtr(err.Error()),
		})
		return
	}

	// Scope to org
	orgID, _, orgLocOk := middleware.GetOrgLocationFromContext(c)
	if !orgLocOk {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Message: "Organization context required",
			Error:   strPtr("org_context_required"),
		})
		return
	}

	// Validate that the product exists in org and is not a combo (no nesting combos)
	var productType string
	err = h.db.QueryRow("SELECT product_type FROM products WHERE id = $1 AND org_id = $2", req.ProductID, orgID).Scan(&productType)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Product not found",
			Error:   strPtr("product_not_found"),
		})
		return
	}
	if productType == "combo" {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Combo products cannot be added as combo slot choices",
			Error:   strPtr("no_nested_combos"),
		})
		return
	}

	_, err = h.db.Exec(`
		INSERT INTO combo_slot_choices (id, combo_slot_id, product_id, variation_item_id, price_override, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, uuid.New(), slotID, req.ProductID, req.VariationItemID, req.PriceOverride, req.SortOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to create combo slot choice",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusCreated, models.APIResponse{
		Success: true,
		Message: "Combo slot choice created successfully",
	})
}

// DeleteComboSlotChoice deletes a choice from a combo slot
func (h *ComboHandler) DeleteComboSlotChoice(c *gin.Context) {
	choiceID, err := uuid.Parse(c.Param("choice_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Message: "Invalid choice ID",
			Error:   strPtr("invalid_choice_id"),
		})
		return
	}

	_, err = h.db.Exec("DELETE FROM combo_slot_choices WHERE id = $1", choiceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Message: "Failed to delete combo slot choice",
			Error:   strPtr(err.Error()),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Combo slot choice deleted successfully",
	})
}

// loadComboSlots loads all combo slots with their choices and product info for a product
func (h *ComboHandler) loadComboSlots(productID uuid.UUID) ([]models.ComboSlot, error) {
	slotRows, err := h.db.Query(`
		SELECT id, product_id, name, is_required, sort_order, created_at, updated_at
		FROM combo_slots
		WHERE product_id = $1
		ORDER BY sort_order, created_at
	`, productID)
	if err != nil {
		return nil, err
	}
	defer slotRows.Close()

	var slots []models.ComboSlot
	for slotRows.Next() {
		var slot models.ComboSlot
		err := slotRows.Scan(&slot.ID, &slot.ProductID, &slot.Name, &slot.IsRequired, &slot.SortOrder, &slot.CreatedAt, &slot.UpdatedAt)
		if err != nil {
			return nil, err
		}
		slots = append(slots, slot)
	}

	// Load choices for each slot
	for i, slot := range slots {
		choiceRows, err := h.db.Query(`
			SELECT c.id, c.combo_slot_id, c.product_id, c.variation_item_id, c.price_override, c.sort_order, c.created_at, c.updated_at,
			       p.name, p.price, p.product_type, p.is_available,
			       (EXISTS(SELECT 1 FROM product_option_groups WHERE product_id = p.id) OR EXISTS(SELECT 1 FROM product_variations WHERE product_id = p.id)) as has_option_groups,
			       (SELECT MIN(pvp.price) FROM product_variation_prices pvp WHERE pvp.product_id = p.id) as min_variation_price,
			       (SELECT MAX(pvp.price) FROM product_variation_prices pvp WHERE pvp.product_id = p.id) as max_variation_price,
			       vi.name as variation_item_name
			FROM combo_slot_choices c
			JOIN products p ON c.product_id = p.id
			LEFT JOIN variation_items vi ON c.variation_item_id = vi.id
			WHERE c.combo_slot_id = $1
			ORDER BY c.sort_order, c.created_at
		`, slot.ID)
		if err != nil {
			return nil, err
		}

		var choices []models.ComboSlotChoice
		for choiceRows.Next() {
			var choice models.ComboSlotChoice
			var variationItemID *uuid.UUID
			var productName string
			var productPrice float64
			var productType string
			var isAvailable bool
			var hasOptionGroups bool
			var minVarPrice, maxVarPrice sql.NullFloat64
			var variationItemName sql.NullString

			err := choiceRows.Scan(&choice.ID, &choice.ComboSlotID, &choice.ProductID, &variationItemID, &choice.PriceOverride,
				&choice.SortOrder, &choice.CreatedAt, &choice.UpdatedAt,
				&productName, &productPrice, &productType, &isAvailable,
				&hasOptionGroups, &minVarPrice, &maxVarPrice, &variationItemName)
			if err != nil {
				choiceRows.Close()
				return nil, err
			}

			choice.VariationItemID = variationItemID
			if variationItemName.Valid {
				choice.VariationItemName = variationItemName.String
			}

			prod := models.Product{
				ID:              choice.ProductID,
				Name:            productName,
				Price:           productPrice,
				ProductType:     productType,
				IsAvailable:     isAvailable,
				HasOptionGroups: hasOptionGroups,
			}
			if minVarPrice.Valid {
				prod.MinVariationPrice = &minVarPrice.Float64
			}
			if maxVarPrice.Valid {
				prod.MaxVariationPrice = &maxVarPrice.Float64
			}
			choice.Product = &prod
			choices = append(choices, choice)
		}
		choiceRows.Close()

		slots[i].Choices = choices
	}

	return slots, nil
}

// helper to avoid importing stringPtr from another file
func strPtr(s string) *string {
	return &s
}
