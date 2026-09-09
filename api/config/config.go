package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv         string
	AppPort        string
	FrontendURL    string
	PostgresDSN    string
	RedisURL       string
	MigrationDir   string
	EnableWebAuthn bool
}

func Load() (*Config, error) {
	for _, path := range []string{".env", "../.env", "../../.env"} {
		if err := godotenv.Load(path); err == nil {
			break
		}
	}

	dsn, err := postgresDSN()
	if err != nil {
		return nil, err
	}

	return &Config{
		AppEnv:         env("APP_ENV", "development"),
		AppPort:        env("APP_PORT", "8080"),
		FrontendURL:    env("FRONTEND_URL", "http://localhost:5173"),
		PostgresDSN:    dsn,
		RedisURL:       env("REDIS_URL", "redis://127.0.0.1:6379"),
		MigrationDir:   env("MIGRATION_DIR", "migrations"),
		EnableWebAuthn: envBool("FEATURE_WEBAUTHN", false),
	}, nil
}

func postgresDSN() (string, error) {
	if raw := os.Getenv("DATABASE_URL"); raw != "" {
		return raw, nil
	}

	host := env("DB_POSTGRES_HOST", "localhost")
	port := env("DB_POSTGRES_PORT", "5432")
	name := os.Getenv("DB_POSTGRES_NAME")
	user := os.Getenv("DB_POSTGRES_USERNAME")
	pass := os.Getenv("DB_POSTGRES_PASSWORD")
	sslmode := env("DB_POSTGRES_SSLMODE", "disable")

	if name == "" || user == "" {
		return "", fmt.Errorf("config: DB_POSTGRES_NAME dan DB_POSTGRES_USERNAME wajib diisi")
	}

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		escape(user), escape(pass), host, port, name, sslmode,
	), nil
}

func escape(value string) string {
	replacer := strings.NewReplacer("@", "%40", ":", "%3A", "/", "%2F", "?", "%3F", "#", "%23")
	return replacer.Replace(value)
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}
