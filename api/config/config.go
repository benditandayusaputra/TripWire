package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv       string
	AppPort      string
	FrontendURL  string
	PostgresDSN  string
	RedisURL     string
	MigrationDir string

	JWTAccessSecret  string
	JWTRefreshSecret string
	AccessTTL        time.Duration
	RefreshTTL       time.Duration

	BcryptCost         int
	MaxFailedLogins    int
	LockoutDuration    time.Duration
	EmailTokenTTL      time.Duration
	PasswordResetTTL   time.Duration
	LoginRateLimit     int
	RegisterRateLimit  int
	WatchlistRateLimit int
	RateLimitWindow    time.Duration
	CookieSecure       bool
	CookieDomain       string

	InsightSigningKey string

	SectorsBaseURL         string
	SectorsAPIKey          string
	SectorsCreditBudget    int64
	SectorsCreditThreshold int64
	SectorsCacheTTL        time.Duration
	SectorsFailureLimit    int64
	SectorsCircuitCooldown time.Duration
	SectorsTimeout         time.Duration

	EnableWebAuthn bool
}

func (c *Config) IsProduction() bool {
	return c.AppEnv == "production"
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

	appEnv := env("APP_ENV", "development")

	cfg := &Config{
		AppEnv:       appEnv,
		AppPort:      env("APP_PORT", "8080"),
		FrontendURL:  env("FRONTEND_URL", "http://localhost:5173"),
		PostgresDSN:  dsn,
		RedisURL:     env("REDIS_URL", "redis://127.0.0.1:6379"),
		MigrationDir: env("MIGRATION_DIR", "migrations"),

		JWTAccessSecret:  os.Getenv("JWT_ACCESS_SECRET"),
		JWTRefreshSecret: os.Getenv("JWT_REFRESH_SECRET"),
		AccessTTL:        envDuration("JWT_ACCESS_TTL", 15*time.Minute),
		RefreshTTL:       envDuration("JWT_REFRESH_TTL", 720*time.Hour),

		BcryptCost:         envInt("BCRYPT_COST", bcryptCostDefault(appEnv)),
		MaxFailedLogins:    envInt("MAX_FAILED_LOGINS", 5),
		LockoutDuration:    envDuration("LOCKOUT_DURATION", 15*time.Minute),
		EmailTokenTTL:      envDuration("EMAIL_TOKEN_TTL", 24*time.Hour),
		PasswordResetTTL:   envDuration("PASSWORD_RESET_TTL", time.Hour),
		LoginRateLimit:     envInt("LOGIN_RATE_LIMIT", 20),
		RegisterRateLimit:  envInt("REGISTER_RATE_LIMIT", 10),
		WatchlistRateLimit: envInt("WATCHLIST_RATE_LIMIT", 30),
		RateLimitWindow:    envDuration("RATE_LIMIT_WINDOW", time.Minute),
		CookieSecure:       envBool("COOKIE_SECURE", true),
		CookieDomain:       os.Getenv("COOKIE_DOMAIN"),

		InsightSigningKey: os.Getenv("INSIGHT_SIGNING_PRIVATE_KEY"),

		SectorsBaseURL:         env("SECTORS_API_BASE_URL", "https://api.sectors.app/v1"),
		SectorsAPIKey:          os.Getenv("SECTORS_API_KEY"),
		SectorsCreditBudget:    int64(envInt("SECTORS_CREDIT_BUDGET", 1000)),
		SectorsCreditThreshold: int64(envInt("SECTORS_CREDIT_THRESHOLD", 100)),
		SectorsCacheTTL:        envDuration("SECTORS_CACHE_TTL", 6*time.Hour),
		SectorsFailureLimit:    int64(envInt("SECTORS_FAILURE_LIMIT", 5)),
		SectorsCircuitCooldown: envDuration("SECTORS_CIRCUIT_COOLDOWN", time.Minute),
		SectorsTimeout:         envDuration("SECTORS_TIMEOUT", 10*time.Second),

		EnableWebAuthn: envBool("FEATURE_WEBAUTHN", false),
	}

	if len(cfg.JWTAccessSecret) < 32 || len(cfg.JWTRefreshSecret) < 32 {
		return nil, fmt.Errorf("config: JWT_ACCESS_SECRET dan JWT_REFRESH_SECRET wajib diisi minimal 32 karakter")
	}

	if cfg.InsightSigningKey == "" {
		return nil, fmt.Errorf("config: INSIGHT_SIGNING_PRIVATE_KEY wajib diisi, kunci Ed25519 base64")
	}

	return cfg, nil
}

func bcryptCostDefault(appEnv string) int {
	if appEnv == "production" {
		return 12
	}
	return 10
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

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, err := time.ParseDuration(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value, err := strconv.ParseBool(os.Getenv(key))
	if err != nil {
		return fallback
	}
	return value
}
