package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
)

func SecurityHeaders(produksi bool) fiber.Handler {
	config := helmet.Config{
		XSSProtection:         "0",
		ContentTypeNosniff:    "nosniff",
		XFrameOptions:         "DENY",
		ReferrerPolicy:        "strict-origin-when-cross-origin",
		ContentSecurityPolicy: "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
		PermissionPolicy:      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
	}

	if produksi {
		config.HSTSMaxAge = 31536000
		config.HSTSPreloadEnabled = true
		config.HSTSExcludeSubdomains = false
	}

	return helmet.New(config)
}

func CORS(frontendURL string) fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PATCH,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type,Authorization,X-CSRF-Token",
		AllowCredentials: true,
		MaxAge:           600,
	})
}
