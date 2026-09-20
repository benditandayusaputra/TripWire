package repository

import (
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	migratepostgres "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

func NewMigrator(postgresDSN, migrationDir string) (*migrate.Migrate, error) {
	connConfig, err := pgx.ParseConfig(postgresDSN)
	if err != nil {
		return nil, fmt.Errorf("migrator: parse dsn: %w", err)
	}
	connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	db := stdlib.OpenDB(*connConfig)

	driver, err := migratepostgres.WithInstance(db, &migratepostgres.Config{})
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("migrator: buat driver postgres: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance("file://"+migrationDir, "postgres", driver)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("migrator: buka sumber migrasi %s: %w", migrationDir, err)
	}

	return m, nil
}

func RunMigration(m *migrate.Migrate, direction string) error {
	var err error
	switch direction {
	case "up":
		err = m.Up()
	case "down":
		err = m.Down()
	case "drop":
		err = m.Drop()
	default:
		return fmt.Errorf("migrator: arah migrasi tidak dikenal: %s", direction)
	}

	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return err
	}
	return nil
}
