package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type Dependencies struct {
	Config *config.Config
	Redis  *redis.Client
	Signer *crypto.TokenSigner
	Health *service.HealthService
	Auth   *service.AuthService
}

func Register(app *fiber.App, deps Dependencies) {
	cfg := deps.Config

	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.CORS(cfg.FrontendURL))

	requireAuth := middleware.RequireAuth(deps.Signer)
	csrf := middleware.CSRF()

	health := NewHealthHandler(deps.Health)
	app.Get("/health", health.Health)
	app.Get("/health/tables", health.Tables)

	auth := NewAuthHandler(cfg, deps.Auth)
	authGroup := app.Group("/auth")
	authGroup.Post("/register",
		middleware.RateLimit(deps.Redis, "register", cfg.RegisterRateLimit, cfg.RateLimitWindow, middleware.ClientIP),
		auth.Register)
	authGroup.Post("/login",
		middleware.RateLimit(deps.Redis, "login", cfg.LoginRateLimit, cfg.RateLimitWindow, middleware.ClientIPAndEmail),
		auth.Login)
	authGroup.Post("/refresh", auth.Refresh)
	authGroup.Post("/password/forgot",
		middleware.RateLimit(deps.Redis, "password_forgot", cfg.RegisterRateLimit, cfg.RateLimitWindow, middleware.ClientIPAndEmail),
		auth.ForgotPassword)
	authGroup.Post("/password/reset", auth.ResetPassword)
	authGroup.Get("/verify-email/:token", auth.VerifyEmail)

	authGroup.Post("/logout", requireAuth, csrf, auth.Logout)
	authGroup.Post("/verify-email/resend", requireAuth, csrf, auth.ResendVerification)

	account := app.Group("/account", requireAuth)
	account.Get("/me", auth.Me)
}
