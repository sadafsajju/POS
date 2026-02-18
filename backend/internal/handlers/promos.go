package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"pos-backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PromoHandler struct {
	db *sql.DB
}

func NewPromoHandler(db *sql.DB) *PromoHandler {
	return &PromoHandler{db: db}
}

type Promo struct {
	ID              string  `json:"id"`
	OrgID           *string `json:"org_id,omitempty"`
	Title           *string `json:"title"`
	MediaType       string  `json:"media_type"`
	FileURL         string  `json:"file_url"`
	DisplayOrder    int     `json:"display_order"`
	DurationSeconds int     `json:"duration_seconds"`
	IsActive        bool    `json:"is_active"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

// ListPublicPromos returns active promos ordered by display_order (no auth required)
func (h *PromoHandler) ListPublicPromos(c *gin.Context) {
	rows, err := h.db.Query(`
		SELECT id, title, media_type, file_url, display_order, duration_seconds
		FROM promos
		WHERE is_active = true
		ORDER BY display_order ASC, created_at ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch promos",
			"error":   "db_error",
		})
		return
	}
	defer rows.Close()

	promos := []gin.H{}
	for rows.Next() {
		var id, mediaType, fileURL string
		var title *string
		var displayOrder, durationSeconds int
		if err := rows.Scan(&id, &title, &mediaType, &fileURL, &displayOrder, &durationSeconds); err != nil {
			continue
		}
		promos = append(promos, gin.H{
			"id":               id,
			"title":            title,
			"media_type":       mediaType,
			"file_url":         fileURL,
			"display_order":    displayOrder,
			"duration_seconds": durationSeconds,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Promos fetched",
		"data":    promos,
	})
}

// ListPromos returns all promos for admin management
func (h *PromoHandler) ListPromos(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	rows, err := h.db.Query(`
		SELECT id, org_id, title, media_type, file_url, display_order, duration_seconds, is_active, created_at, updated_at
		FROM promos
		WHERE org_id = $1
		ORDER BY display_order ASC, created_at ASC
	`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch promos",
			"error":   "db_error",
		})
		return
	}
	defer rows.Close()

	promos := []Promo{}
	for rows.Next() {
		var p Promo
		if err := rows.Scan(&p.ID, &p.OrgID, &p.Title, &p.MediaType, &p.FileURL, &p.DisplayOrder, &p.DurationSeconds, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		promos = append(promos, p)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Promos fetched",
		"data":    promos,
	})
}

// UploadPromo handles multipart file upload and creates a promo record
func (h *PromoHandler) UploadPromo(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File is required",
			"error":   "file_required",
		})
		return
	}

	// Validate file type
	contentType := file.Header.Get("Content-Type")
	var mediaType string
	switch {
	case strings.HasPrefix(contentType, "image/"):
		mediaType = "image"
	case strings.HasPrefix(contentType, "video/"):
		mediaType = "video"
	default:
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Only image and video files are allowed",
			"error":   "invalid_file_type",
		})
		return
	}

	// Validate file size (50MB max)
	if file.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File size must be under 50MB",
			"error":   "file_too_large",
		})
		return
	}

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		// Fallback extensions
		switch {
		case strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg"):
			ext = ".jpg"
		case strings.Contains(contentType, "png"):
			ext = ".png"
		case strings.Contains(contentType, "webp"):
			ext = ".webp"
		case strings.Contains(contentType, "mp4"):
			ext = ".mp4"
		case strings.Contains(contentType, "webm"):
			ext = ".webm"
		default:
			ext = ".bin"
		}
	}
	filename := uuid.New().String() + ext

	// Ensure upload directory exists
	uploadDir := "./uploads/promos"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create upload directory",
			"error":   "upload_dir_error",
		})
		return
	}

	// Save file
	filePath := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to save file",
			"error":   "file_save_error",
		})
		return
	}

	// Get title from form
	title := c.PostForm("title")

	// Get next display order
	var maxOrder int
	h.db.QueryRow(`SELECT COALESCE(MAX(display_order), -1) FROM promos WHERE org_id = $1`, orgID).Scan(&maxOrder)

	// Default duration
	durationSeconds := 5
	if mediaType == "video" {
		durationSeconds = 0 // 0 = play to completion
	}

	fileURL := fmt.Sprintf("/uploads/promos/%s", filename)

	var promoID string
	err = h.db.QueryRow(`
		INSERT INTO promos (org_id, title, media_type, file_url, display_order, duration_seconds, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		RETURNING id
	`, orgID, nilIfEmpty(title), mediaType, fileURL, maxOrder+1, durationSeconds).Scan(&promoID)
	if err != nil {
		// Clean up uploaded file on DB error
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create promo record",
			"error":   "db_error",
		})
		return
	}

	// Also save to media table so it appears in the media library
	if strings.HasPrefix(contentType, "image/") {
		h.db.Exec(`
			INSERT INTO media (org_id, filename, original_name, file_url, file_size, mime_type)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, orgID, filename, file.Filename, fileURL, file.Size, contentType)
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Promo uploaded successfully",
		"data": gin.H{
			"id":               promoID,
			"title":            title,
			"media_type":       mediaType,
			"file_url":         fileURL,
			"display_order":    maxOrder + 1,
			"duration_seconds": durationSeconds,
			"is_active":        true,
		},
	})
}

// CreatePromoFromMedia creates a promo record using an existing media library file URL
func (h *PromoHandler) CreatePromoFromMedia(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	var req struct {
		FileURL string `json:"file_url" binding:"required"`
		Title   string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "file_url is required",
			"error":   "validation_error",
		})
		return
	}

	// Verify the media file exists in the media table for this org
	var mediaID string
	err := h.db.QueryRow(`SELECT id FROM media WHERE file_url = $1 AND org_id = $2`, req.FileURL, orgID).Scan(&mediaID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Media file not found in library",
			"error":   "media_not_found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to verify media",
			"error":   "db_error",
		})
		return
	}

	// Get next display order
	var maxOrder int
	h.db.QueryRow(`SELECT COALESCE(MAX(display_order), -1) FROM promos WHERE org_id = $1`, orgID).Scan(&maxOrder)

	mediaType := "image"
	durationSeconds := 5

	var promoID string
	err = h.db.QueryRow(`
		INSERT INTO promos (org_id, title, media_type, file_url, display_order, duration_seconds, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, true)
		RETURNING id
	`, orgID, nilIfEmpty(req.Title), mediaType, req.FileURL, maxOrder+1, durationSeconds).Scan(&promoID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create promo record",
			"error":   "db_error",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Promo created from media",
		"data": gin.H{
			"id":               promoID,
			"title":            req.Title,
			"media_type":       mediaType,
			"file_url":         req.FileURL,
			"display_order":    maxOrder + 1,
			"duration_seconds": durationSeconds,
			"is_active":        true,
		},
	})
}

// DeletePromo removes a promo record. Only deletes the file if it's not in the media library.
func (h *PromoHandler) DeletePromo(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	promoID := c.Param("id")
	if _, err := uuid.Parse(promoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid promo ID",
			"error":   "invalid_id",
		})
		return
	}

	// Get file URL before deleting
	var fileURL string
	err := h.db.QueryRow(`SELECT file_url FROM promos WHERE id = $1 AND org_id = $2`, promoID, orgID).Scan(&fileURL)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Promo not found",
			"error":   "not_found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to find promo",
			"error":   "db_error",
		})
		return
	}

	// Delete DB record
	_, err = h.db.Exec(`DELETE FROM promos WHERE id = $1 AND org_id = $2`, promoID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete promo",
			"error":   "db_error",
		})
		return
	}

	// Only remove the file from disk if it's NOT referenced by the media library
	if fileURL != "" {
		var mediaExists bool
		h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM media WHERE file_url = $1)`, fileURL).Scan(&mediaExists)
		if !mediaExists {
			localPath := "." + fileURL
			os.Remove(localPath)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Promo deleted successfully",
	})
}

// ReorderPromos batch-updates display_order for a list of promos
func (h *PromoHandler) ReorderPromos(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	var req []struct {
		ID           string `json:"id"`
		DisplayOrder int    `json:"display_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
			"error":   "invalid_body",
		})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to start transaction",
			"error":   "db_error",
		})
		return
	}
	defer tx.Rollback()

	for _, item := range req {
		_, err := tx.Exec(`UPDATE promos SET display_order = $1 WHERE id = $2 AND org_id = $3`, item.DisplayOrder, item.ID, orgID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Failed to update promo order",
				"error":   "db_error",
			})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to commit reorder",
			"error":   "db_error",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Promos reordered successfully",
	})
}

// TogglePromo flips the is_active flag
func (h *PromoHandler) TogglePromo(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	promoID := c.Param("id")
	if _, err := uuid.Parse(promoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid promo ID",
			"error":   "invalid_id",
		})
		return
	}

	result, err := h.db.Exec(`
		UPDATE promos SET is_active = NOT is_active
		WHERE id = $1 AND org_id = $2
	`, promoID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to toggle promo",
			"error":   "db_error",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Promo not found",
			"error":   "not_found",
		})
		return
	}

	// Fetch updated state
	var isActive bool
	h.db.QueryRow(`SELECT is_active FROM promos WHERE id = $1`, promoID).Scan(&isActive)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Promo toggled successfully",
		"data": gin.H{
			"id":        promoID,
			"is_active": isActive,
		},
	})
}

// UpdatePromoDuration updates the duration_seconds for a promo
func (h *PromoHandler) UpdatePromoDuration(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	promoID := c.Param("id")
	if _, err := uuid.Parse(promoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid promo ID",
			"error":   "invalid_id",
		})
		return
	}

	var req struct {
		DurationSeconds int `json:"duration_seconds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
			"error":   "invalid_body",
		})
		return
	}

	result, err := h.db.Exec(`
		UPDATE promos SET duration_seconds = $1
		WHERE id = $2 AND org_id = $3
	`, req.DurationSeconds, promoID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update duration",
			"error":   "db_error",
		})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Promo not found",
			"error":   "not_found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Duration updated successfully",
	})
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
