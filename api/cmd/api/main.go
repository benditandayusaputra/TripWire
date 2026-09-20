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
