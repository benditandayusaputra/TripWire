package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Store struct {
	DB    *sqlx.DB
	Redis *redis.Client
}

func NewStore(ctx context.Context, postgresDSN, redisURL string) (*Store, error) {
	db, err := sqlx.Open("pgx", postgresDSN)
	if err != nil {
		return nil, fmt.Errorf("repository: buka koneksi postgres: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("repository: parse redis url: %w", err)
	}

	store := &Store{DB: db, Redis: redis.NewClient(opt)}

	if err := store.DB.PingContext(ctx); err != nil {
		store.Close()
		return nil, fmt.Errorf("repository: ping postgres: %w", err)
	}
	if err := store.Redis.Ping(ctx).Err(); err != nil {
		store.Close()
		return nil, fmt.Errorf("repository: ping redis: %w", err)
	}

	return store, nil
}

func (s *Store) Close() error {
	if s.Redis != nil {
		s.Redis.Close()
	}
	if s.DB != nil {
		return s.DB.Close()
	}
	return nil
}

func (s *Store) PingPostgres(ctx context.Context) error {
	var result int
	if err := s.DB.GetContext(ctx, &result, "SELECT 1"); err != nil {
		return err
	}
	if result != 1 {
		return fmt.Errorf("repository: hasil SELECT 1 tidak terduga: %d", result)
	}
	return nil
}

func (s *Store) PingRedis(ctx context.Context) error {
	return s.Redis.Ping(ctx).Err()
}

func (s *Store) ListTableNames(ctx context.Context) ([]string, error) {
	var names []string
	query := `SELECT table_name
	          FROM information_schema.tables
	          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
	          ORDER BY table_name`
	if err := s.DB.SelectContext(ctx, &names, query); err != nil {
		return nil, err
	}
	return names, nil
}
