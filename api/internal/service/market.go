package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

var ErrPasarTidakTersedia = errors.New("service: data pasar sedang tidak tersedia")

const (
	batasHalamanUniverse = 200
	maksHalamanUniverse  = 10
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
		Meta: MarketMeta{
			Cached:           hasil.Cached,
			LatencyMS:        hasil.Latensi.Milliseconds(),
			CreditsUsed:      hasil.Terpakai,
			CreditsRemaining: hasil.Tersisa,
			CreditBudget:     s.client.Budget(),
			CircuitOpen:      s.client.CircuitTerbuka(ctx),
		},
	}, nil
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
