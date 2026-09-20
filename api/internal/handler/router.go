package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

func Register(app *fiber.App, cfg *config.Config, health *service.HealthService) {
	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.CORS(cfg.FrontendURL))

	healthHandler := NewHealthHandler(health)
	app.Get("/health", healthHandler.Health)
	app.Get("/health/tables", healthHandler.Tables)
}
