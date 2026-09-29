package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

var ErrPasarTidakTersedia = errors.New("service: data pasar sedang tidak tersedia")

const (
	batasHalamanUniverse = 200
	maksHalamanUniverse  = 10
	jumlahTeratas        = 10
)

type MarketMeta struct {
	Cached           bool  `json:"cached"`
	LatencyMS        int64 `json:"latency_ms"`
	CreditsUsed      int64 `json:"credits_used"`
	CreditsRemaining int64 `json:"credits_remaining"`
	CreditBudget     int64 `json:"credit_budget"`
	CircuitOpen      bool  `json:"circuit_open"`
}

type MarketReport struct {
	Ticker      string          `json:"ticker"`
	CompanyName string          `json:"company_name"`
	Meta        MarketMeta      `json:"meta"`
	Data        json.RawMessage `json:"data"`
}

type Kutipan struct {
	Ticker          string   `json:"ticker"`
	Harga           float64  `json:"last_close_price"`
	TanggalTutup    string   `json:"latest_close_date,omitempty"`
	PerubahanHarian *float64 `json:"daily_close_change"`
	Kapitalisasi    *float64 `json:"market_cap"`
	Peringkat       *float64 `json:"market_cap_rank"`
	Tertinggi52     *float64 `json:"high_52w"`
	Terendah52      *float64 `json:"low_52w"`
	Sektor          string   `json:"sector,omitempty"`
	SubSektor       string   `json:"sub_sector,omitempty"`
	Indeks          []string `json:"indices"`
}

type SahamTeratas struct {
	Ticker          string   `json:"ticker"`
	Nama            string   `json:"company_name"`
	Harga           float64  `json:"last_close_price"`
	PerubahanHarian *float64 `json:"daily_close_change"`
	Kapitalisasi    *float64 `json:"market_cap"`
}

type MarketService struct {
	client  *sectorsclient.Client
	tickers *TickerService
}

func NewMarketService(client *sectorsclient.Client, tickers *TickerService) *MarketService {
	return &MarketService{client: client, tickers: tickers}
}

func (s *MarketService) CompanyReport(ctx context.Context, rawTicker string) (*MarketReport, error) {
	ticker, err := s.tickers.Lookup(rawTicker)
	if err != nil {
		v := newValidationError()
		v.add("ticker", "Ticker tidak terdaftar di IDX")
		return nil, v
	}

	hasil, err := s.client.Get(ctx, pathLaporan(ticker.Code), 0, biayaLaporan)
	if err != nil {
		return nil, err
	}

	return &MarketReport{
		Ticker:      ticker.Code,
		CompanyName: ticker.Name,
		Data:        hasil.Data,
		Meta:        s.meta(ctx, hasil),
	}, nil
}

func (s *MarketService) meta(ctx context.Context, hasil *sectorsclient.Hasil) MarketMeta {
	return MarketMeta{
		Cached:           hasil.Cached,
		LatencyMS:        hasil.Latensi.Milliseconds(),
		CreditsUsed:      hasil.Terpakai,
		CreditsRemaining: hasil.Tersisa,
		CreditBudget:     s.client.Budget(),
		CircuitOpen:      s.client.CircuitTerbuka(ctx),
	}
}

func (s *MarketService) Teratas(ctx context.Context) ([]SahamTeratas, MarketMeta, error) {
	kueri := url.Values{
		"where":                {"last_close_price > 0 and daily_close_change > -1 and market_cap > 0"},
		"order_by":             {"-market_cap"},
		"include_query_values": {"true"},
		"limit":                {strconv.Itoa(jumlahTeratas)},
	}
	hasil, err := s.client.Get(ctx, "/companies/?"+kueri.Encode(), 0, 1)
	if err != nil {
		return nil, MarketMeta{}, err
	}

	var isi struct {
		Results []struct {
			Symbol string `json:"symbol"`
			Nilai  struct {
				Harga        angkaFleksibel `json:"last_close_price"`
				Perubahan    angkaFleksibel `json:"daily_close_change"`
				Kapitalisasi angkaFleksibel `json:"market_cap"`
			} `json:"query_values"`
		} `json:"results"`
	}
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil, MarketMeta{}, fmt.Errorf("%w: screener emiten tidak terbaca", sectorsclient.ErrUpstreamGagal)
	}

	saham := make([]SahamTeratas, 0, len(isi.Results))
	for _, baris := range isi.Results {
		ticker, err := s.tickers.Lookup(baris.Symbol)
		if err != nil || !baris.Nilai.Harga.Ada || baris.Nilai.Harga.Nilai <= 0 {
			continue
		}
		saham = append(saham, SahamTeratas{
			Ticker:          ticker.Code,
			Nama:            ticker.Name,
			Harga:           baris.Nilai.Harga.Nilai,
			PerubahanHarian: baris.Nilai.Perubahan.ptr(),
			Kapitalisasi:    baris.Nilai.Kapitalisasi.ptr(),
		})
	}

	return saham, s.meta(ctx, hasil), nil
}

func (s *MarketService) Kutipan(ctx context.Context, kode []string) map[string]Kutipan {
	hasil := map[string]Kutipan{}
	for _, satu := range kode {
		data, ada := s.client.Terakhir(ctx, pathLaporan(satu))
		if !ada {
			continue
		}
		if kutipan, ok := uraiKutipan(satu, data); ok {
			hasil[satu] = kutipan
		}
	}
	return hasil
}

func uraiKutipan(kode string, data json.RawMessage) (Kutipan, bool) {
	var isi struct {
		Overview struct {
			Sector        string                               `json:"sector"`
			SubSector     string                               `json:"sub_sector"`
			MarketCap     angkaFleksibel                       `json:"market_cap"`
			MarketCapRank angkaFleksibel                       `json:"market_cap_rank"`
			Harga         angkaFleksibel                       `json:"last_close_price"`
			TanggalTutup  string                               `json:"latest_close_date"`
			Perubahan     angkaFleksibel                       `json:"daily_close_change"`
			Rentang       map[string]map[string]angkaFleksibel `json:"all_time_price"`
			Indices       []string                             `json:"indices"`
		} `json:"overview"`
	}
	_ = json.Unmarshal(data, &isi)

	o := isi.Overview
	if !o.Harga.Ada || o.Harga.Nilai <= 0 {
		return Kutipan{}, false
	}

	ujung := func(kunci string) *float64 {
		for _, nilai := range o.Rentang[kunci] {
			return nilai.ptr()
		}
		return nil
	}

	indeks := o.Indices
	if indeks == nil {
		indeks = []string{}
	}

	return Kutipan{
		Ticker:          kode,
		Harga:           o.Harga.Nilai,
		TanggalTutup:    o.TanggalTutup,
		PerubahanHarian: o.Perubahan.ptr(),
		Kapitalisasi:    o.MarketCap.ptr(),
		Peringkat:       o.MarketCapRank.ptr(),
		Tertinggi52:     ujung("52_w_high"),
		Terendah52:      ujung("52_w_low"),
		Sektor:          o.Sector,
		SubSektor:       o.SubSector,
		Indeks:          indeks,
	}, true
}

func (s *MarketService) Credits(ctx context.Context) MarketMeta {
	terpakai, tersisa := s.client.Kredit(ctx)
	return MarketMeta{
		CreditsUsed:      terpakai,
		CreditsRemaining: tersisa,
		CreditBudget:     s.client.Budget(),
		CircuitOpen:      s.client.CircuitTerbuka(ctx),
	}
}

func (s *MarketService) RefreshTickerUniverse(ctx context.Context) (int, error) {
	tickers := make([]Ticker, 0, 1000)
	offset := 0

	for halaman := 0; halaman < maksHalamanUniverse; halaman++ {
		path := fmt.Sprintf("/companies/?limit=%d&offset=%d", batasHalamanUniverse, offset)
		hasil, err := s.client.Get(ctx, path, ttlReferensi, 1)
		if err != nil {
			return 0, err
		}

		var isi struct {
			Results []struct {
				Symbol      string `json:"symbol"`
				CompanyName string `json:"company_name"`
			} `json:"results"`
			Pagination struct {
				HasNext    bool `json:"has_next"`
				NextOffset *int `json:"next_offset"`
			} `json:"pagination"`
		}
		if err := json.Unmarshal(hasil.Data, &isi); err != nil {
			return 0, fmt.Errorf("service: daftar emiten Sectors tidak terbaca: %w", err)
		}

		for _, baris := range isi.Results {
			code := s.tickers.Normalize(baris.Symbol)
			if len(code) != 4 {
				continue
			}
			tickers = append(tickers, Ticker{Code: code, Name: strings.TrimSpace(baris.CompanyName), ListingBoard: "Sectors"})
		}

		if !isi.Pagination.HasNext || isi.Pagination.NextOffset == nil || *isi.Pagination.NextOffset <= offset {
			break
		}
		offset = *isi.Pagination.NextOffset
	}

	if len(tickers) == 0 {
		return 0, fmt.Errorf("service: daftar emiten Sectors kosong")
	}

	if err := s.tickers.SaveToCache(ctx, tickers); err != nil {
		return 0, err
	}

	return len(tickers), nil
}
