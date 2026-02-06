package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io"
	"net/http"

	"pos-backend/internal/models"

	"github.com/gin-gonic/gin"
)

// WebhookAuthMiddleware validates incoming webhook requests using HMAC-SHA256 signature.
// It reads the webhook_secret from platform_configs for the given platform.
func WebhookAuthMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		platform := c.Param("platform")
		if platform == "" {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "Platform parameter required",
				Error:   stringPtr("missing_platform"),
			})
			c.Abort()
			return
		}

		// Validate platform value
		if platform != "swiggy" && platform != "zomato" {
			c.JSON(http.StatusBadRequest, models.APIResponse{
				Success: false,
				Message: "Invalid platform",
				Error:   stringPtr("invalid_platform"),
			})
			c.Abort()
			return
		}

		// Get webhook secret for this platform
		var webhookSecret sql.NullString
		var isEnabled bool
		err := db.QueryRow(
			"SELECT webhook_secret, is_enabled FROM platform_configs WHERE platform = $1",
			platform,
		).Scan(&webhookSecret, &isEnabled)

		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, models.APIResponse{
				Success: false,
				Message: "Platform not configured",
				Error:   stringPtr("platform_not_configured"),
			})
			c.Abort()
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, models.APIResponse{
				Success: false,
				Message: "Failed to fetch platform config",
				Error:   stringPtr(err.Error()),
			})
			c.Abort()
			return
		}

		if !isEnabled {
			c.JSON(http.StatusForbidden, models.APIResponse{
				Success: false,
				Message: "Platform integration is disabled",
				Error:   stringPtr("platform_disabled"),
			})
			c.Abort()
			return
		}

		// If webhook secret is configured, verify the signature
		if webhookSecret.Valid && webhookSecret.String != "" {
			signature := c.GetHeader("X-Webhook-Signature")
			if signature == "" {
				c.JSON(http.StatusUnauthorized, models.APIResponse{
					Success: false,
					Message: "Webhook signature required",
					Error:   stringPtr("missing_signature"),
				})
				c.Abort()
				return
			}

			// Read the request body
			body, err := io.ReadAll(c.Request.Body)
			if err != nil {
				c.JSON(http.StatusBadRequest, models.APIResponse{
					Success: false,
					Message: "Failed to read request body",
					Error:   stringPtr(err.Error()),
				})
				c.Abort()
				return
			}

			// Verify HMAC-SHA256 signature
			mac := hmac.New(sha256.New, []byte(webhookSecret.String))
			mac.Write(body)
			expectedSignature := hex.EncodeToString(mac.Sum(nil))

			if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
				c.JSON(http.StatusUnauthorized, models.APIResponse{
					Success: false,
					Message: "Invalid webhook signature",
					Error:   stringPtr("invalid_signature"),
				})
				c.Abort()
				return
			}

			// Restore the body so handlers can read it
			c.Request.Body = io.NopCloser(
				&bodyReader{data: body, offset: 0},
			)
		}

		// Set platform in context
		c.Set("webhook_platform", platform)
		c.Next()
	}
}

// bodyReader implements io.Reader for restoring request body after reading
type bodyReader struct {
	data   []byte
	offset int
}

func (r *bodyReader) Read(p []byte) (n int, err error) {
	if r.offset >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.offset:])
	r.offset += n
	return n, nil
}
