package service

import (
	"context"
	"time"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

type HealthService struct {
	store   *repository.Store
	version string
}

func NewHealthService(store *repository.Store, version string) *HealthService {
	return &HealthService{store: store, version: version}
}

func (s *HealthService) Check(ctx context.Context) model.HealthStatus {
	status := model.HealthStatus{
		Status:   "ok",
		Version:  s.version,
		Postgres: probe(ctx, s.store.PingPostgres),
		Redis:    probe(ctx, s.store.PingRedis),
	}
	if !status.Postgres.Connected || !status.Redis.Connected {
		status.Status = "degraded"
	}
	return status
}

func (s *HealthService) TableNames(ctx context.Context) ([]string, error) {
	return s.store.ListTableNames(ctx)
}

func probe(ctx context.Context, ping func(context.Context) error) model.DependencyStatus {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	start := time.Now()
	err := ping(ctx)
	elapsed := time.Since(start).Milliseconds()

	if err != nil {
		return model.DependencyStatus{Connected: false, LatencyMS: elapsed, Error: err.Error()}
	}
	return model.DependencyStatus{Connected: true, LatencyMS: elapsed}
}

func (s *HealthService) ColumnNames(ctx context.Context, table string) ([]string, error) {
	return s.store.ListColumnNames(ctx, table)
}
