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

	market := service.NewMarketService(sectors, tickers)
	if total, err := market.RefreshTickerUniverse(ctx); err == nil {
		log.Printf("ticker universe disegarkan dari Sectors, %d emiten", total)
	}

	handler.Register(app, handler.Dependencies{
		Config: cfg,
		Redis:  store.Redis,
		Signer: signer,
		Health: service.NewHealthService(store, version),
		Auth: service.NewAuthService(
			cfg,
			repository.NewUserRepository(store),
			repository.NewTokenRepository(store),
			repository.NewAuditRepository(store),
			signer,
			mailer,
		),
		Watchlist: service.NewWatchlistService(repository.NewWatchlistRepository(store), tickers),
		Market:    market,
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
