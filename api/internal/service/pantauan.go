package service

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

const (
	batasRiwayatSkor = 40
	hariRiwayatHarga = 90
	cakrawalaJadwal  = 62 * 24 * time.Hour
	batasLangkahCron = 2000
	biayaHargaHarian = 1
	formatTanggalIDX = "2006-01-02"
)

type TitikSkor struct {
	Skor  float64   `json:"score"`
	Waktu time.Time `json:"at"`
}

type InsightRingkas struct {
	ID          string          `json:"id"`
	Subtype     string          `json:"subtype"`
	Score       *float64        `json:"score"`
	GeneratedAt time.Time       `json:"generated_at"`
	SubScores   json.RawMessage `json:"sub_scores,omitempty"`
	Pengali     *float64        `json:"multiplier,omitempty"`
}

type RisikoEmiten struct {
	RedFlag     *InsightRingkas `json:"red_flag"`
	SkorSebelum *float64        `json:"previous_score"`
	Pasar       *InsightRingkas `json:"market"`
	Riwayat     []TitikSkor     `json:"history"`
	Jumlah      int             `json:"insight_count"`
}

type JadwalPantauan struct {
	ScanTerakhir *time.Time           `json:"last_scan_at"`
	ScanBerikut  *time.Time           `json:"next_scan_at"`
	Kondisi      map[string]time.Time `json:"conditions"`
}

type RingkasanPantauan struct {
	Risiko map[string]RisikoEmiten `json:"risk"`
	Jadwal JadwalPantauan          `json:"schedule"`
}

type HargaHarian struct {
	Tanggal string   `json:"date"`
	Buka    *float64 `json:"open"`
	Tinggi  *float64 `json:"high"`
	Rendah  *float64 `json:"low"`
	Tutup   float64  `json:"close"`
	Volume  *float64 `json:"volume"`
}

type SeriHarga struct {
	Ticker string        `json:"ticker"`
	Seri   []HargaHarian `json:"series"`
	Meta   MarketMeta    `json:"meta"`
}

type PantauanService struct {
	watchlist *repository.WatchlistRepository
	insights  *repository.InsightRepository
	scan      *ScanService
	market    *MarketService
	jadwal    cron.Schedule
}

func NewPantauanService(
	watchlist *repository.WatchlistRepository,
	insights *repository.InsightRepository,
	scan *ScanService,
	market *MarketService,
	specCron string,
) *PantauanService {
	jadwal, _ := cron.ParseStandard(specCron)
	return &PantauanService{watchlist: watchlist, insights: insights, scan: scan, market: market, jadwal: jadwal}
}

func (s *PantauanService) Ringkasan(ctx context.Context, userID string) (*RingkasanPantauan, error) {
	items, err := s.watchlist.List(ctx, userID)
	if err != nil {
		return nil, err
	}

	kode := make([]string, 0, len(items))
	for _, item := range items {
		kode = append(kode, item.Ticker)
	}

	baris, err := s.insights.RiwayatRisiko(ctx, kode, batasRiwayatSkor)
	if err != nil {
		return nil, err
	}

	kondisi, err := s.watchlist.ListConditionsForItems(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &RingkasanPantauan{
		Risiko: susunRisiko(baris),
		Jadwal: s.susunJadwal(ctx, kondisi, time.Now().UTC()),
	}, nil
}

func susunRisiko(baris []repository.BarisRisiko) map[string]RisikoEmiten {
	hasil := map[string]RisikoEmiten{}
	for _, satu := range baris {
		risiko := hasil[satu.Ticker]
		risiko.Jumlah = satu.Jumlah
		if risiko.Riwayat == nil {
			risiko.Riwayat = []TitikSkor{}
		}

		ringkas := &InsightRingkas{
			ID:          satu.ID,
			Subtype:     satu.Subtype,
			Score:       satu.Score,
			GeneratedAt: satu.GeneratedAt,
			SubScores:   json.RawMessage(satu.SubScores),
			Pengali:     satu.Pengali,
		}

		if satu.InsightType == InsightRedFlag {
			if risiko.RedFlag != nil {
				risiko.SkorSebelum = risiko.RedFlag.Score
			}
			risiko.RedFlag = ringkas
			if satu.Score != nil {
				risiko.Riwayat = append(risiko.Riwayat, TitikSkor{Skor: *satu.Score, Waktu: satu.GeneratedAt})
			}
		} else {
			risiko.Pasar = ringkas
		}

		hasil[satu.Ticker] = risiko
	}
	return hasil
}

func (s *PantauanService) susunJadwal(ctx context.Context, kondisi map[string][]model.WatchCondition, sekarang time.Time) JadwalPantauan {
	jadwal := JadwalPantauan{Kondisi: map[string]time.Time{}}

	if run, _ := s.scan.RunTerakhir(ctx); run != nil {
		mulai := run.MulaiPada
		jadwal.ScanTerakhir = &mulai
	}

	if s.jadwal == nil {
		return jadwal
	}

	berikut := s.jadwal.Next(sekarang)
	jadwal.ScanBerikut = &berikut

	for _, daftar := range kondisi {
		for _, satu := range daftar {
			if !satu.IsActive {
				continue
			}
			if waktu, ada := cekBerikut(s.jadwal, satu, sekarang); ada {
				jadwal.Kondisi[satu.ID] = waktu
			}
		}
	}

	return jadwal
}

func cekBerikut(jadwal cron.Schedule, kondisi model.WatchCondition, sejak time.Time) (time.Time, bool) {
	terjadwal := repository.KondisiTerjadwal{ConditionType: kondisi.ConditionType, Config: kondisi.Config}
	batas := sejak.Add(cakrawalaJadwal)

	waktu := sejak
	for langkah := 0; langkah < batasLangkahCron; langkah++ {
		waktu = jadwal.Next(waktu)
		if waktu.IsZero() || waktu.After(batas) {
			break
		}
		if jatuhTempo(terjadwal, waktu) {
			return waktu, true
		}
	}

	return time.Time{}, false
}

func (s *PantauanService) Harga(ctx context.Context, userID, itemID string) (*SeriHarga, error) {
	item, err := s.watchlist.ByID(ctx, userID, itemID)
	if err != nil {
		return nil, translate(err)
	}
	return s.market.HargaHarian(ctx, item.Ticker)
}

func (s *MarketService) HargaHarian(ctx context.Context, kode string) (*SeriHarga, error) {
	mulai := time.Now().In(zonaJakarta()).AddDate(0, 0, -hariRiwayatHarga).Format(formatTanggalIDX)
	path := fmt.Sprintf("/daily/%s/?start=%s", url.PathEscape(kode), mulai)

	hasil, err := s.client.Get(ctx, path, 0, biayaHargaHarian)
	if err != nil {
		return nil, err
	}

	var mentah []struct {
		Date   string         `json:"date"`
		Open   angkaFleksibel `json:"open"`
		High   angkaFleksibel `json:"high"`
		Low    angkaFleksibel `json:"low"`
		Close  angkaFleksibel `json:"close"`
		Volume angkaFleksibel `json:"volume"`
	}
	if err := json.Unmarshal(hasil.Data, &mentah); err != nil {
		return nil, fmt.Errorf("%w: harga harian %s tidak terbaca", sectorsclient.ErrUpstreamGagal, kode)
	}

	seri := make([]HargaHarian, 0, len(mentah))
	for _, baris := range mentah {
		if baris.Date == "" || !baris.Close.Ada || baris.Close.Nilai <= 0 {
			continue
		}
		seri = append(seri, HargaHarian{
			Tanggal: baris.Date,
			Buka:    baris.Open.ptr(),
			Tinggi:  baris.High.ptr(),
			Rendah:  baris.Low.ptr(),
			Tutup:   baris.Close.Nilai,
			Volume:  baris.Volume.ptr(),
		})
	}
	sort.Slice(seri, func(i, j int) bool { return seri[i].Tanggal < seri[j].Tanggal })

	return &SeriHarga{Ticker: kode, Seri: seri, Meta: s.meta(ctx, hasil)}, nil
}
