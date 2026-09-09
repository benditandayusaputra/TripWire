package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/handler"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
	"github.com/benditandayusaputra/tripwire/api/pkg/webpush"
)

const version = "0.1.0"

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	store, err := repository.NewStore(ctx, cfg.PostgresDSN, cfg.RedisURL)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer store.Close()

	app := fiber.New(fiber.Config{
		AppName:               "TripWire API",
		DisableStartupMessage: true,
		BodyLimit:             int(cfg.MaxUploadBytes) + (1 << 20),
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          30 * time.Second,
	})

	signer := crypto.NewTokenSigner(cfg.JWTAccessSecret, "tripwire")
	mailer := service.NewMailer(cfg.FrontendURL, "http://localhost:"+cfg.AppPort)

	tickers, err := service.NewTickerService(store.Redis)
	if err != nil {
		log.Fatalf("ticker: %v", err)
	}
	if err := tickers.LoadFromCache(ctx); err == nil {
		log.Printf("ticker universe dimuat dari cache, %d emiten", tickers.Total())
	}

	sectors := sectorsclient.New(store.Redis, sectorsclient.Options{
		BaseURL:         cfg.SectorsBaseURL,
		APIKey:          cfg.SectorsAPIKey,
		CreditBudget:    cfg.SectorsCreditBudget,
		CreditThreshold: cfg.SectorsCreditThreshold,
		CacheTTL:        cfg.SectorsCacheTTL,
		FailureLimit:    cfg.SectorsFailureLimit,
		CircuitCooldown: cfg.SectorsCircuitCooldown,
		Timeout:         cfg.SectorsTimeout,
	})

	insightSigner, err := crypto.NewInsightSigner(cfg.InsightSigningKey)
	if err != nil {
		log.Fatalf("insight signer: %v", err)
	}

	integrity := service.NewIntegrityService(repository.NewInsightRepository(store), insightSigner)

	totpCipher, err := crypto.NewCipher(cfg.TOTPEncryptionKey)
	if err != nil {
		log.Fatalf("kunci enkripsi TOTP: %v", err)
	}

	twoFactorRepo := repository.NewTwoFactorRepository(store)
	userRepo := repository.NewUserRepository(store)
	auditRepo := repository.NewAuditRepository(store)

	twoFactor := service.NewTwoFactorService(cfg, twoFactorRepo, userRepo, auditRepo, totpCipher)

	urlSigner, err := crypto.NewURLSigner(cfg.SignedURLSecret)
	if err != nil {
		log.Fatalf("signed url: %v", err)
	}

	fileService := service.NewFileService(cfg, repository.NewFileRepository(store), auditRepo, urlSigner)

	tokenRepo := repository.NewTokenRepository(store)
	watchlistRepo := repository.NewWatchlistRepository(store)
	insightRepo := repository.NewInsightRepository(store)
	accountService := service.NewAccountService(userRepo, tokenRepo, auditRepo, fileService)
	feedService := service.NewFeedService(insightRepo, watchlistRepo, tickers, integrity)

	webauthnService, err := service.NewWebAuthnService(cfg, twoFactorRepo, userRepo, auditRepo, store.Redis)
	if err != nil {
		log.Fatalf("webauthn: %v", err)
	}
	if cfg.EnableWebAuthn {
		log.Printf("WebAuthn aktif lewat feature flag")
	}

	pengirimPush := webpush.New(webpush.Options{
		PublicKey:  cfg.VAPIDPublicKey,
		PrivateKey: cfg.VAPIDPrivateKey,
		Subject:    cfg.VAPIDSubject,
		TTL:        cfg.PushTTL,
		Timeout:    cfg.PushTimeout,
	})
	if !pengirimPush.Aktif() {
		log.Printf("web push nonaktif, VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY belum diisi")
	}

	streamHub := service.NewStreamHub(store.Redis)
	notifikasi := service.NewNotificationService(
		repository.NewNotificationRepository(store),
		repository.NewPushRepository(store),
		streamHub,
		pengirimPush,
		!cfg.IsProduction(),
	)

	market := service.NewMarketService(sectors, tickers)
	if total, err := market.RefreshTickerUniverse(ctx); err == nil {
		log.Printf("ticker universe disegarkan dari Sectors, %d emiten", total)
	}

	authService := service.NewAuthService(
		cfg,
		userRepo,
		repository.NewTokenRepository(store),
		auditRepo,
		signer,
		mailer,
	)
	authService.PakaiTwoFactor(twoFactor)
	authService.PakaiFile(fileService)

	insightService := service.NewInsightService(sectors, tickers, integrity, notifikasi)
	scanService := service.NewScanService(watchlistRepo, insightService, store.Redis)
	adminService := service.NewAdminService(repository.NewAdminRepository(store), market, scanService)

	handler.Register(app, handler.Dependencies{
		Config:     cfg,
		Redis:      store.Redis,
		Signer:     signer,
		Health:     service.NewHealthService(store, version),
		Auth:       authService,
		Watchlist:  service.NewWatchlistService(watchlistRepo, tickers),
		Market:     market,
		Integrity:  integrity,
		Insight:    insightService,
		Stream:     streamHub,
		Notifikasi: notifikasi,
		TwoFactor:  twoFactor,
		WebAuthn:   webauthnService,
		Files:      fileService,
		Account:    accountService,
		Feed:       feedService,
		Admin:      adminService,
	})

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-shutdown
		if err := app.ShutdownWithTimeout(10 * time.Second); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()

	log.Printf("TripWire API listening on :%s (env=%s)", cfg.AppPort, cfg.AppEnv)
	if err := app.Listen(":" + cfg.AppPort); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
