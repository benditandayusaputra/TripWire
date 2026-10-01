package service

import (
	"context"

	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

const hariPemakaian = 7

type KreditAdmin struct {
	MarketMeta
	Ambang     int64                         `json:"credit_threshold"`
	Harian     []sectorsclient.PemakaianHari `json:"daily_usage"`
	RataHarian *float64                      `json:"daily_average"`
	SisaHari   *int                          `json:"days_left"`
}

type AdminService struct {
	repo   *repository.AdminRepository
	market *MarketService
	scan   *ScanService
}

func NewAdminService(repo *repository.AdminRepository, market *MarketService, scan *ScanService) *AdminService {
	return &AdminService{repo: repo, market: market, scan: scan}
}

func (s *AdminService) Credits(ctx context.Context) KreditAdmin {
	kredit := KreditAdmin{
		MarketMeta: s.market.Credits(ctx),
		Ambang:     s.market.client.Threshold(),
		Harian:     s.market.client.PemakaianHarian(ctx, hariPemakaian),
	}
	kredit.RataHarian, kredit.SisaHari = PerkiraanSisaHari(kredit.Harian, kredit.CreditsRemaining-kredit.Ambang)
	return kredit
}

func PerkiraanSisaHari(harian []sectorsclient.PemakaianHari, cadangan int64) (*float64, *int) {
	awal, total := -1, int64(0)
	for i, hari := range harian {
		if hari.Credit > 0 && awal < 0 {
			awal = i
		}
		total += hari.Credit
	}
	if awal < 0 {
		return nil, nil
	}

	rata := float64(total) / float64(len(harian)-awal)
	sisa := 0
	if cadangan > 0 {
		sisa = int(float64(cadangan) / rata)
	}
	return &rata, &sisa
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
