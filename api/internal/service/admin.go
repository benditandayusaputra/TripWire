package service

import (
	"context"

	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

type AdminService struct {
	repo   *repository.AdminRepository
	market *MarketService
	scan   *ScanService
}

func NewAdminService(repo *repository.AdminRepository, market *MarketService, scan *ScanService) *AdminService {
	return &AdminService{repo: repo, market: market, scan: scan}
}

func (s *AdminService) Credits(ctx context.Context) MarketMeta {
	return s.market.Credits(ctx)
}

func (s *AdminService) SchedulerStatus(ctx context.Context) (map[string]any, error) {
	terakhir, err := s.scan.RunTerakhir(ctx)
	if err != nil {
		return nil, err
	}

	riwayat, err := s.scan.Riwayat(ctx, panjangRiwayat)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"terakhir":     terakhir,
		"riwayat":      riwayat,
		"pernah_jalan": terakhir != nil,
	}, nil
}

func (s *AdminService) TriggerScan(ctx context.Context) (*HasilScan, error) {
	return s.scan.Jalankan(ctx, "manual")
}

func (s *AdminService) Users(ctx context.Context, limit int) ([]repository.AdminUser, error) {
	return s.repo.ListUsers(ctx, limit)
}

func (s *AdminService) Statistik(ctx context.Context) (*repository.Statistik, error) {
	return s.repo.Statistik(ctx)
}
