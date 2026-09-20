package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

var ErrPasarTidakTersedia = errors.New("service: data pasar sedang tidak tersedia")

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

	hasil, err := s.client.Get(ctx, fmt.Sprintf("/company/report/%s/", strings.ToLower(ticker.Code)))
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
	hasil, err := s.client.GetWithTTL(ctx, "/companies/", 24*time.Hour)
	if err != nil {
		return 0, err
	}

	var mentah []struct {
		Symbol      string `json:"symbol"`
		CompanyName string `json:"company_name"`
		Name        string `json:"name"`
	}
	if err := json.Unmarshal(hasil.Data, &mentah); err != nil {
		return 0, fmt.Errorf("service: daftar emiten Sectors tidak terbaca: %w", err)
	}

	tickers := make([]Ticker, 0, len(mentah))
	for _, baris := range mentah {
		code := s.tickers.Normalize(baris.Symbol)
		if len(code) != 4 {
			continue
		}

		nama := baris.CompanyName
		if nama == "" {
			nama = baris.Name
		}

		tickers = append(tickers, Ticker{Code: code, Name: nama, ListingBoard: "Sectors"})
	}

	if len(tickers) == 0 {
		return 0, fmt.Errorf("service: daftar emiten Sectors kosong")
	}

	if err := s.tickers.SaveToCache(ctx, tickers); err != nil {
		return 0, err
	}

	return len(tickers), nil
}
