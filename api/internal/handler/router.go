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
	Config     *config.Config
	Redis      *redis.Client
	Signer     *crypto.TokenSigner
	Health     *service.HealthService
	Auth       *service.AuthService
	Watchlist  *service.WatchlistService
	Market     *service.MarketService
	Integrity  *service.IntegrityService
	Insight    *service.InsightService
	Stream     *service.StreamHub
	Notifikasi *service.NotificationService
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

	watchlist := NewWatchlistHandler(deps.Watchlist)
	app.Get("/tickers", requireAuth, watchlist.SearchTickers)

	group := app.Group("/watchlist", requireAuth, csrf, middleware.XSSSanitize())
	group.Get("/", watchlist.List)
	group.Post("/",
		middleware.RateLimit(deps.Redis, "watchlist_add", cfg.WatchlistRateLimit, cfg.RateLimitWindow, middleware.ClientIP),
		watchlist.Add)
	group.Patch("/:id", watchlist.Update)
	group.Delete("/:id", watchlist.Remove)
	group.Get("/:id/conditions", watchlist.ListConditions)
	group.Post("/:id/conditions", watchlist.AddCondition)
	group.Patch("/:id/conditions/:cid", watchlist.UpdateCondition)
	group.Delete("/:id/conditions/:cid", watchlist.RemoveCondition)

	market := NewMarketHandler(deps.Market)
	app.Get("/market/credits", requireAuth, market.Credits)
	app.Get("/market/:ticker", requireAuth, market.CompanyReport)

	verifikasi := NewIntegrityHandler(deps.Integrity)
	app.Get("/insights/verify/:id", verifikasi.Verify)

	insight := NewInsightHandler(deps.Insight)
	insights := app.Group("/insights", requireAuth)
	insights.Get("/red-flag/:ticker", insight.RedFlag)
	insights.Get("/market-intelligence/:ticker", insight.MarketIntelligence)

	stream := NewStreamHandler(deps.Stream)
	app.Get("/stream", requireAuth, stream.Stream)

	notifikasi := NewNotificationHandler(deps.Notifikasi)
	notifications := app.Group("/notifications", requireAuth)
	notifications.Get("/", notifikasi.List)
	notifications.Patch("/:id/read", csrf, notifikasi.MarkRead)

	push := app.Group("/push", requireAuth)
	push.Get("/public-key", notifikasi.VapidPublicKey)
	push.Post("/subscribe", csrf, middleware.XSSSanitize(), notifikasi.Subscribe)
	push.Delete("/subscribe/:endpoint", csrf, notifikasi.Unsubscribe)
}
