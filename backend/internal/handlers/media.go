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

type MediaHandler struct {
	db *sql.DB
}

func NewMediaHandler(db *sql.DB) *MediaHandler {
	return &MediaHandler{db: db}
}

// ListMedia returns all media items for the org, ordered by newest first
func (h *MediaHandler) ListMedia(c *gin.Context) {
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
		SELECT id, org_id, filename, original_name, file_url, file_size, mime_type, created_at
		FROM media
		WHERE org_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch media",
			"error":   "db_error",
		})
		return
	}
	defer rows.Close()

	media := []gin.H{}
	for rows.Next() {
		var id, filename, fileURL, createdAt string
		var orgIDVal, originalName, mimeType *string
		var fileSize int64
		if err := rows.Scan(&id, &orgIDVal, &filename, &originalName, &fileURL, &fileSize, &mimeType, &createdAt); err != nil {
			continue
		}
		media = append(media, gin.H{
			"id":            id,
			"org_id":        orgIDVal,
			"filename":      filename,
			"original_name": originalName,
			"file_url":      fileURL,
			"file_size":     fileSize,
			"mime_type":     mimeType,
			"created_at":    createdAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Media fetched",
		"data":    media,
	})
}

// UploadMedia handles multipart file upload for images
func (h *MediaHandler) UploadMedia(c *gin.Context) {
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

	// Validate file type — images only
	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Only image files are allowed",
			"error":   "invalid_file_type",
		})
		return
	}

	// Validate file size (10MB max)
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File size must be under 10MB",
			"error":   "file_too_large",
		})
		return
	}

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		switch {
		case strings.Contains(contentType, "jpeg") || strings.Contains(contentType, "jpg"):
			ext = ".jpg"
		case strings.Contains(contentType, "png"):
			ext = ".png"
		case strings.Contains(contentType, "webp"):
			ext = ".webp"
		case strings.Contains(contentType, "gif"):
			ext = ".gif"
		case strings.Contains(contentType, "svg"):
			ext = ".svg"
		default:
			ext = ".bin"
		}
	}
	filename := uuid.New().String() + ext

	// Ensure upload directory exists
	uploadDir := "./uploads/media"
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

	fileURL := fmt.Sprintf("/uploads/media/%s", filename)
	originalName := file.Filename

	var mediaID string
	err = h.db.QueryRow(`
		INSERT INTO media (org_id, filename, original_name, file_url, file_size, mime_type)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, orgID, filename, originalName, fileURL, file.Size, contentType).Scan(&mediaID)
	if err != nil {
		// Clean up uploaded file on DB error
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create media record",
			"error":   "db_error",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Media uploaded successfully",
		"data": gin.H{
			"id":            mediaID,
			"filename":      filename,
			"original_name": originalName,
			"file_url":      fileURL,
			"file_size":     file.Size,
			"mime_type":     contentType,
		},
	})
}

// DeleteMedia removes a media item and its file from disk
func (h *MediaHandler) DeleteMedia(c *gin.Context) {
	orgID, _, ok := middleware.GetOrgLocationFromContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Organization context required",
			"error":   "org_context_required",
		})
		return
	}

	mediaID := c.Param("id")
	if _, err := uuid.Parse(mediaID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid media ID",
			"error":   "invalid_id",
		})
		return
	}

	// Get file URL before deleting
	var fileURL string
	err := h.db.QueryRow(`SELECT file_url FROM media WHERE id = $1 AND org_id = $2`, mediaID, orgID).Scan(&fileURL)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Media not found",
			"error":   "not_found",
		})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to find media",
			"error":   "db_error",
		})
		return
	}

	// Delete DB record
	_, err = h.db.Exec(`DELETE FROM media WHERE id = $1 AND org_id = $2`, mediaID, orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete media",
			"error":   "db_error",
		})
		return
	}

	// Remove file from disk (best effort)
	if fileURL != "" {
		localPath := "." + fileURL
		os.Remove(localPath)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Media deleted successfully",
	})
}
