package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
	"github.com/benditandayusaputra/tripwire/api/pkg/webpush"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	store, err := repository.NewStore(ctx, cfg.PostgresDSN, cfg.RedisURL)
	cancel()
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer store.Close()

	scan, err := rakitScan(cfg, store)
	if err != nil {
		log.Fatalf("scan: %v", err)
	}

	jadwal := cron.New(cron.WithLocation(time.UTC))
	if _, err := jadwal.AddFunc(cfg.SchedulerCron, func() {
		jalankan(scan, "cron")
	}); err != nil {
		log.Fatalf("cron: %v", err)
	}

	jadwal.Start()
	log.Printf("scheduler TripWire jalan dengan jadwal %q", cfg.SchedulerCron)

	if cfg.SchedulerRunOnStart {
		jalankan(scan, "boot")
	}

	berhenti := make(chan os.Signal, 1)
	signal.Notify(berhenti, os.Interrupt, syscall.SIGTERM)
	<-berhenti

	<-jadwal.Stop().Done()
	log.Printf("scheduler berhenti")
}

func jalankan(scan *service.ScanService, pemicu string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	hasil, err := scan.Jalankan(ctx, pemicu)
	if err != nil {
		log.Printf("scan %s gagal: %v", pemicu, err)
		return
	}

	log.Printf(
		"scan %s selesai dalam %d ms, %d kondisi ditinjau, %d ticker diproses, %d insight baru, %d gagal",
		pemicu, hasil.DurasiMS, hasil.KondisiDitinjau, hasil.TickerDiproses, hasil.InsightBaru, hasil.Gagal,
	)
}

func rakitScan(cfg *config.Config, store *repository.Store) (*service.ScanService, error) {
	tickers, err := service.NewTickerService(store.Redis)
	if err != nil {
		return nil, err
	}
	if err := tickers.LoadFromCache(context.Background()); err != nil {
		log.Printf("ticker universe memakai seed bawaan")
	}

	signer, err := crypto.NewInsightSigner(cfg.InsightSigningKey)
	if err != nil {
		return nil, err
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

	integrity := service.NewIntegrityService(repository.NewInsightRepository(store), signer)

	pengirim := webpush.New(webpush.Options{
		PublicKey:  cfg.VAPIDPublicKey,
		PrivateKey: cfg.VAPIDPrivateKey,
		Subject:    cfg.VAPIDSubject,
	})

	notifikasi := service.NewNotificationService(
		repository.NewNotificationRepository(store),
		repository.NewPushRepository(store),
		nil,
		pengirim,
		!cfg.IsProduction(),
	)

	insight := service.NewInsightService(sectors, tickers, integrity, notifikasi)

	return service.NewScanService(repository.NewWatchlistRepository(store), insight, store.Redis), nil
}
