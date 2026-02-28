package main

import (
	"database/sql"
	"log"
	"os"

	"pos-backend/internal/api"
	"pos-backend/internal/database"
	"pos-backend/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Database configuration - Railway provides DATABASE_URL
	var db *sql.DB
	var err error

	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		// Railway/production mode - use DATABASE_URL directly
		log.Println("Using DATABASE_URL for database connection")
		db, err = sql.Open("postgres", databaseURL)
	} else {
		// Local development mode - use individual env vars
		log.Println("Using individual DB env vars for database connection")
		dbConfig := database.Config{
			Host:     getEnv("DB_HOST", "postgres"),
			Port:     getEnv("DB_PORT", "5432"),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres123"),
			DBName:   getEnv("DB_NAME", "pos_system"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		}
		db, err = database.Connect(dbConfig)
	}

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Successfully connected to database")

	// Initialize Gin router
	gin.SetMode(getEnv("GIN_MODE", "release"))
	router := gin.New()

	// Add middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true // Local POS app — all origins allowed (Tauri uses tauri://localhost)
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "accept", "origin", "Cache-Control", "X-Requested-With"},
		AllowCredentials: true,
	}))

	// Add authentication middleware to protected routes
	authMiddleware := middleware.AuthMiddleware()

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "healthy", "message": "POS API is running"})
	})

	// Serve uploaded files (promos, etc.)
	router.Static("/uploads", "./uploads")

	// Initialize API routes
	apiRoutes := router.Group("/api/v1")
	api.SetupRoutes(apiRoutes, db, authMiddleware)

	// Start server
	port := getEnv("PORT", "8080")
	log.Printf("Starting server on port %s", port)

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
