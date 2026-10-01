package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

const batasUjiPush = 5

type Dependencies struct {
	Config     *config.Config
	Redis      *redis.Client
	Signer     *crypto.TokenSigner
	Health     *service.HealthService
	Auth       *service.AuthService
	Captcha    *service.CaptchaService
	Watchlist  *service.WatchlistService
	Market     *service.MarketService
	Integrity  *service.IntegrityService
	Insight    *service.InsightService
	Stream     *service.StreamHub
	Notifikasi *service.NotificationService
	TwoFactor  *service.TwoFactorService
	WebAuthn   *service.WebAuthnService
	Files      *service.FileService
	Account    *service.AccountService
	Feed       *service.FeedService
	Admin      *service.AdminService
	Pantauan   *service.PantauanService
	Scan       *service.ScanService
}

func Register(app *fiber.App, deps Dependencies) {
	cfg := deps.Config

	app.Use(middleware.Language())
	app.Use(middleware.SecurityHeaders(cfg.IsProduction()))
	app.Use(middleware.CORS(cfg.FrontendURL))

	requireAuth := middleware.RequireAuth(deps.Signer)
	csrf := middleware.CSRF()

	health := NewHealthHandler(deps.Health)
	app.Get("/health", health.Health)
	app.Get("/health/tables", health.Tables)

	auth := NewAuthHandler(cfg, deps.Auth, deps.Captcha)
	authGroup := app.Group("/auth")
	batasCaptcha := middleware.RateLimit(deps.Redis, "captcha", cfg.CaptchaRateLimit, cfg.RateLimitWindow, middleware.ClientIP)
	authGroup.Post("/captcha", batasCaptcha, auth.Captcha)
	authGroup.Get("/captcha/:id/audio", batasCaptcha, auth.CaptchaAudio)
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

	twoFactor := NewTwoFactorHandler(deps.TwoFactor, deps.WebAuthn)
	authGroup.Post("/webauthn/login/options", twoFactor.LoginOptions)

	authGroup.Post("/logout", requireAuth, csrf, auth.Logout)
	authGroup.Post("/verify-email/resend", requireAuth, csrf, auth.ResendVerification)

	totpGroup := authGroup.Group("/totp", requireAuth, csrf)
	totpGroup.Get("/status", twoFactor.Status)
	totpGroup.Post("/setup", twoFactor.Setup)
	totpGroup.Post("/verify", twoFactor.Verify)
	totpGroup.Post("/disable", twoFactor.Disable)
	totpGroup.Get("/backup-codes", twoFactor.BackupCodes)

	webauthnGroup := authGroup.Group("/webauthn", requireAuth, csrf)
	webauthnGroup.Post("/register/options", twoFactor.RegisterOptions)
	webauthnGroup.Post("/register/verify", twoFactor.RegisterVerify)
	webauthnGroup.Get("/credentials", twoFactor.Credentials)
	webauthnGroup.Delete("/credentials/:id", twoFactor.HapusCredential)

	berkas := NewFileHandler(deps.Files)
	app.Get("/files/:id", berkas.Ambil)

	account := app.Group("/account", requireAuth)
	account.Get("/me", auth.Me)
	account.Post("/avatar", csrf, berkas.UploadAvatar)
	account.Delete("/avatar", csrf, berkas.HapusAvatar)

	akun := NewAccountHandler(deps.Account, deps.Feed)
	account.Get("/profile", akun.Profile)
	account.Patch("/profile", csrf, middleware.XSSSanitize(), akun.UpdateProfile)
	account.Get("/sessions", akun.Sessions)
	account.Delete("/sessions/:id", csrf, akun.RevokeSession)
	account.Delete("/sessions", csrf, akun.RevokeOtherSessions)
	account.Get("/summary", akun.Ringkasan)

	files := app.Group("/files", requireAuth, csrf)
	files.Post("/", berkas.Upload)
	files.Delete("/:id", berkas.Hapus)

	watchlist := NewWatchlistHandler(deps.Watchlist, deps.Market, deps.Scan)
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

	pantauan := NewPantauanHandler(deps.Pantauan)
	group.Get("/overview", pantauan.Ringkasan)
	group.Get("/:id/prices", pantauan.Harga)
	group.Post("/:id/scan", watchlist.Pindai)

	market := NewMarketHandler(deps.Market)
	app.Get("/market/credits", requireAuth, market.Credits)
	app.Get("/market/top", requireAuth, market.Teratas)
	app.Get("/market/stocks", requireAuth, market.DaftarSaham)
	app.Get("/market/foreign-flow", requireAuth, market.ArusAsing)
	app.Get("/market/index/:code", requireAuth, market.Indeks)
	app.Get("/market/:ticker", requireAuth, market.CompanyReport)
	app.Get("/market/:ticker/profile", requireAuth, market.Profil)
	app.Get("/market/:ticker/prices", requireAuth, market.Harga)

	verifikasi := NewIntegrityHandler(deps.Integrity)
	app.Get("/insights/verify/:id", verifikasi.Verify)

	insight := NewInsightHandler(deps.Insight)
	insights := app.Group("/insights", requireAuth)
	insights.Get("/", akun.Feed)
	insights.Get("/red-flag/:ticker", insight.RedFlag)
	insights.Get("/market-intelligence/:ticker", insight.MarketIntelligence)
	insights.Get("/:id", akun.InsightDetail)

	stream := NewStreamHandler(deps.Stream)
	app.Get("/stream", requireAuth, stream.Stream)

	notifikasi := NewNotificationHandler(deps.Notifikasi)
	notifications := app.Group("/notifications", requireAuth)
	notifications.Get("/", notifikasi.List)
	notifications.Get("/summary", notifikasi.Summary)
	notifications.Post("/read-all", csrf, notifikasi.MarkAllRead)
	notifications.Delete("/read", csrf, notifikasi.DeleteRead)
	notifications.Patch("/:id/read", csrf, notifikasi.MarkRead)
	notifications.Delete("/:id/read", csrf, notifikasi.MarkUnread)
	notifications.Delete("/:id", csrf, notifikasi.Delete)

	adminHandler := NewAdminHandler(deps.Admin)
	admin := app.Group("/admin", requireAuth, middleware.RequireAdmin())
	admin.Get("/stats", adminHandler.Statistik)
	admin.Get("/system/credits", adminHandler.Credits)
	admin.Get("/system/scheduler-status", adminHandler.SchedulerStatus)
	admin.Post("/system/trigger-scan", csrf, adminHandler.TriggerScan)
	admin.Get("/users", adminHandler.Users)

	push := app.Group("/push", requireAuth)
	push.Get("/public-key", notifikasi.VapidPublicKey)
	push.Get("/subscriptions", notifikasi.Devices)
	push.Post("/test", csrf,
		middleware.RateLimit(deps.Redis, "push_test", batasUjiPush, cfg.RateLimitWindow, middleware.UserID),
		notifikasi.TestPush)
	push.Post("/subscribe", csrf, middleware.XSSSanitize(), notifikasi.Subscribe)
	push.Delete("/subscribe/:endpoint", csrf, notifikasi.Unsubscribe)
}
