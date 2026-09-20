package service

import (
	"context"
	"errors"
	"slices"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

type FeedItem struct {
	model.InsightEvent
	CompanyName string `json:"company_name"`
}

type InsightDetail struct {
	FeedItem
	Verification *model.InsightVerification `json:"verification"`
}

type FeedService struct {
	insights  *repository.InsightRepository
	watchlist *repository.WatchlistRepository
	tickers   *TickerService
	integrity *IntegrityService
}

func NewFeedService(
	insights *repository.InsightRepository,
	watchlist *repository.WatchlistRepository,
	tickers *TickerService,
	integrity *IntegrityService,
) *FeedService {
	return &FeedService{insights: insights, watchlist: watchlist, tickers: tickers, integrity: integrity}
}

func (s *FeedService) Feed(ctx context.Context, userID, insightType, ticker string, limit int) ([]FeedItem, error) {
	dipantau, err := s.tickerDipantau(ctx, userID)
	if err != nil {
		return nil, err
	}

	if ticker != "" {
		kode := s.tickers.Normalize(ticker)
		if !slices.Contains(dipantau, kode) {
			return []FeedItem{}, nil
		}
		dipantau = []string{kode}
	}

	if insightType != "" && insightType != InsightRedFlag && insightType != InsightMarketIntelligence {
		v := newValidationError()
		v.add("type", "Jenis insight tidak dikenal")
		return nil, v
	}

	baris, err := s.insights.Feed(ctx, dipantau, insightType, limit)
	if err != nil {
		return nil, err
	}

	return s.lengkapi(baris), nil
}

func (s *FeedService) Detail(ctx context.Context, userID, insightID string) (*InsightDetail, error) {
	event, err := s.insights.ByID(ctx, insightID)
	if err != nil {
		return nil, translate(err)
	}

	dipantau, err := s.tickerDipantau(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(dipantau, event.Ticker) {
		return nil, ErrTidakDitemukan
	}

	verifikasi, err := s.integrity.Verify(ctx, insightID)
	if err != nil && !errors.Is(err, ErrTidakDitemukan) {
		return nil, err
	}

	return &InsightDetail{
		FeedItem:     s.lengkapi([]model.InsightEvent{*event})[0],
		Verification: verifikasi,
	}, nil
}

func (s *FeedService) Ringkasan(ctx context.Context, userID string) (map[string]any, error) {
	dipantau, err := s.tickerDipantau(ctx, userID)
	if err != nil {
		return nil, err
	}

	baris, err := s.insights.Feed(ctx, dipantau, "", 100)
	if err != nil {
		return nil, err
	}

	kritis := 0
	for _, item := range baris {
		if item.Score != nil && *item.Score >= 86 {
			kritis += 1
		}
	}

	kondisi, err := s.watchlist.ListConditionsForItems(ctx, userID)
	if err != nil {
		return nil, err
	}

	kondisiAktif := 0
	for _, daftar := range kondisi {
		for _, satu := range daftar {
			if satu.IsActive {
				kondisiAktif += 1
			}
		}
	}

	return map[string]any{
		"saham_dipantau": len(dipantau),
		"insight_total":  len(baris),
		"insight_kritis": kritis,
		"kondisi_aktif":  kondisiAktif,
	}, nil
}

func (s *FeedService) tickerDipantau(ctx context.Context, userID string) ([]string, error) {
	item, err := s.watchlist.List(ctx, userID)
	if err != nil {
		return nil, err
	}

	kode := make([]string, 0, len(item))
	for _, satu := range item {
		kode = append(kode, satu.Ticker)
	}

	return kode, nil
}

func (s *FeedService) lengkapi(baris []model.InsightEvent) []FeedItem {
	hasil := make([]FeedItem, 0, len(baris))
	for _, event := range baris {
		item := FeedItem{InsightEvent: event}
		if ticker, err := s.tickers.Lookup(event.Ticker); err == nil {
			item.CompanyName = ticker.Name
		}
		hasil = append(hasil, item)
	}
	return hasil
}
