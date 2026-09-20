package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

const (
	kunciRunTerakhir = "scheduler:run:terakhir"
	kunciRiwayatRun  = "scheduler:run:riwayat"
	panjangRiwayat   = 20
)

type HasilScan struct {
	MulaiPada       time.Time `json:"mulai_pada"`
	SelesaiPada     time.Time `json:"selesai_pada"`
	DurasiMS        int64     `json:"durasi_ms"`
	Pemicu          string    `json:"pemicu"`
	KondisiDitinjau int       `json:"kondisi_ditinjau"`
	TickerDiproses  int       `json:"ticker_diproses"`
	InsightBaru     int       `json:"insight_baru"`
	Dilewati        int       `json:"dilewati"`
	Gagal           int       `json:"gagal"`
	Catatan         []string  `json:"catatan"`
}

type ScanService struct {
	watchlist *repository.WatchlistRepository
	insight   *InsightService
	redis     *redis.Client
}

func NewScanService(
	watchlist *repository.WatchlistRepository,
	insight *InsightService,
	client *redis.Client,
) *ScanService {
	return &ScanService{watchlist: watchlist, insight: insight, redis: client}
}

func (s *ScanService) Jalankan(ctx context.Context, pemicu string) (*HasilScan, error) {
	mulai := time.Now().UTC()

	kondisi, err := s.watchlist.KondisiAktif(ctx)
	if err != nil {
		return nil, err
	}

	hasil := &HasilScan{
		MulaiPada:       mulai,
		Pemicu:          pemicu,
		KondisiDitinjau: len(kondisi),
		Catatan:         []string{},
	}

	sudah := map[string]bool{}

	for _, satu := range kondisi {
		if !jatuhTempo(satu, mulai) {
			hasil.Dilewati += 1
			continue
		}
		if sudah[satu.Ticker] {
			continue
		}
		sudah[satu.Ticker] = true
		hasil.TickerDiproses += 1

		baru, err := s.prosesTicker(ctx, satu.Ticker, mulai)
		if err != nil {
			hasil.Gagal += 1
			hasil.Catatan = append(hasil.Catatan, fmt.Sprintf("%s: %s", satu.Ticker, ringkasGalat(err)))
			continue
		}
		hasil.InsightBaru += baru
	}

	hasil.SelesaiPada = time.Now().UTC()
	hasil.DurasiMS = hasil.SelesaiPada.Sub(mulai).Milliseconds()

	s.simpanRun(ctx, hasil)

	return hasil, nil
}

func (s *ScanService) prosesTicker(ctx context.Context, ticker string, mulai time.Time) (int, error) {
	baru := 0

	redFlag, err := s.insight.RedFlag(ctx, ticker)
	if err != nil {
		return 0, err
	}
	if dibuatDalamRun(redFlag, mulai) {
		baru += 1
	}

	pasar, err := s.insight.MarketIntelligence(ctx, ticker)
	if err != nil {
		if errors.Is(err, sectorsclient.ErrCreditHabis) || errors.Is(err, sectorsclient.ErrCircuitTerbuka) {
			return baru, err
		}
		return baru, nil
	}
	if dibuatDalamRun(pasar, mulai) {
		baru += 1
	}

	return baru, nil
}

func dibuatDalamRun(insight *Insight, mulai time.Time) bool {
	return insight != nil && insight.GeneratedAt != nil && !insight.GeneratedAt.Before(mulai)
}

func (s *ScanService) RunTerakhir(ctx context.Context) (*HasilScan, error) {
	mentah, err := s.redis.Get(ctx, kunciRunTerakhir).Bytes()
	if err != nil {
		return nil, nil
	}

	hasil := &HasilScan{}
	if err := json.Unmarshal(mentah, hasil); err != nil {
		return nil, nil
	}

	return hasil, nil
}

func (s *ScanService) Riwayat(ctx context.Context, batas int64) ([]HasilScan, error) {
	if batas <= 0 || batas > panjangRiwayat {
		batas = panjangRiwayat
	}

	baris, err := s.redis.LRange(ctx, kunciRiwayatRun, 0, batas-1).Result()
	if err != nil {
		return []HasilScan{}, nil
	}

	riwayat := make([]HasilScan, 0, len(baris))
	for _, satu := range baris {
		var hasil HasilScan
		if err := json.Unmarshal([]byte(satu), &hasil); err == nil {
			riwayat = append(riwayat, hasil)
		}
	}

	return riwayat, nil
}

func (s *ScanService) simpanRun(ctx context.Context, hasil *HasilScan) {
	mentah, err := json.Marshal(hasil)
	if err != nil {
		return
	}

	s.redis.Set(ctx, kunciRunTerakhir, mentah, 30*24*time.Hour)
	s.redis.LPush(ctx, kunciRiwayatRun, mentah)
	s.redis.LTrim(ctx, kunciRiwayatRun, 0, panjangRiwayat-1)
}

func jatuhTempo(kondisi repository.KondisiTerjadwal, sekarang time.Time) bool {
	config := map[string]any{}
	if len(kondisi.Config) > 0 {
		_ = json.Unmarshal(kondisi.Config, &config)
	}

	switch kondisi.ConditionType {
	case model.ConditionWeekly:
		hari, ok := angka(config["weekday"])
		if !ok {
			hari = 1
		}
		return int(sekarang.In(zonaJakarta()).Weekday()) == hari%7
	case model.ConditionPeriodicCustom:
		jam, ok := angka(config["interval_hours"])
		if !ok || jam <= 0 {
			return true
		}
		return int(sekarang.Unix()/3600)%jam == 0
	default:
		return true
	}
}

func zonaJakarta() *time.Location {
	lokasi, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.UTC
	}
	return lokasi
}

func ringkasGalat(err error) string {
	pesan := err.Error()
	if len(pesan) > 160 {
		return pesan[:160]
	}
	return pesan
}
