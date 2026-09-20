package main

import (
	"log"
	"os"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

func main() {
	direction := "up"
	if len(os.Args) > 1 {
		direction = os.Args[1]
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	migrator, err := repository.NewMigrator(cfg.PostgresDSN, cfg.MigrationDir)
	if err != nil {
		log.Fatalf("migrasi: %v", err)
	}
	defer migrator.Close()

	if err := repository.RunMigration(migrator, direction); err != nil {
		log.Fatalf("migrasi %s: %v", direction, err)
	}

	version, dirty, err := migrator.Version()
	if err != nil {
		log.Printf("migrasi %s selesai, versi tidak terbaca: %v", direction, err)
		return
	}

	log.Printf("migrasi %s selesai, versi %d, dirty %t", direction, version, dirty)
}
