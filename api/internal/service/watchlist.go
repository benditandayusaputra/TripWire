package service

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	ErrTickerSudahAda = errors.New("service: ticker sudah ada di watchlist")
	ErrTidakDitemukan = errors.New("service: data tidak ditemukan")
)

const maxWatchlistItems = 50

type WatchlistService struct {
	repo    *repository.WatchlistRepository
	tickers *TickerService
}

func NewWatchlistService(repo *repository.WatchlistRepository, tickers *TickerService) *WatchlistService {
	return &WatchlistService{repo: repo, tickers: tickers}
}

func (s *WatchlistService) List(ctx context.Context, userID string) ([]model.WatchlistItem, error) {
	items, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, err
	}

	grouped, err := s.repo.ListConditionsForItems(ctx, userID)
	if err != nil {
		return nil, err
	}

	for i := range items {
		items[i].Conditions = grouped[items[i].ID]
		if items[i].Conditions == nil {
			items[i].Conditions = []model.WatchCondition{}
		}
		if ticker, err := s.tickers.Lookup(items[i].Ticker); err == nil {
			items[i].CompanyName = ticker.Name
		}
	}

	return items, nil
}

func (s *WatchlistService) Detail(ctx context.Context, userID, itemID string) (*model.WatchlistItem, error) {
	item, err := s.repo.ByID(ctx, userID, itemID)
	if err != nil {
		return nil, translate(err)
	}

	conditions, err := s.repo.ListConditions(ctx, userID, itemID)
	if err != nil {
		return nil, err
	}
	item.Conditions = conditions

	if ticker, err := s.tickers.Lookup(item.Ticker); err == nil {
		item.CompanyName = ticker.Name
	}

	return item, nil
}

func (s *WatchlistService) Add(ctx context.Context, userID, rawTicker, displayPref string) (*model.WatchlistItem, error) {
	v := newValidationError()

	ticker, err := s.tickers.Lookup(rawTicker)
	if err != nil {
		v.add("ticker", "Ticker tidak terdaftar di IDX")
	}

	displayPref = strings.TrimSpace(displayPref)
	if displayPref == "" {
		displayPref = model.DisplayInsightOnly
	}
	if !slices.Contains(model.DisplayPrefs, displayPref) {
		v.add("data_display_pref", "Preferensi tampilan tidak dikenal")
	}

	if err := v.orNil(); err != nil {
		return nil, err
	}

	existing, err := s.repo.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(existing) >= maxWatchlistItems {
		v.add("ticker", "Watchlist sudah mencapai batas maksimum")
		return nil, v
	}

	sudahAda, err := s.repo.TickerExists(ctx, userID, ticker.Code)
	if err != nil {
		return nil, err
	}
	if sudahAda {
		return nil, ErrTickerSudahAda
	}

	item, err := s.repo.Create(ctx, userID, ticker.Code, displayPref)
	if err != nil {
		return nil, err
	}

	item.CompanyName = ticker.Name
	item.Conditions = []model.WatchCondition{}

	return item, nil
}

func (s *WatchlistService) UpdateDisplayPref(ctx context.Context, userID, itemID, displayPref string) (*model.WatchlistItem, error) {
	if !slices.Contains(model.DisplayPrefs, displayPref) {
		v := newValidationError()
		v.add("data_display_pref", "Preferensi tampilan tidak dikenal")
		return nil, v
	}

	item, err := s.repo.UpdateDisplayPref(ctx, userID, itemID, displayPref)
	if err != nil {
		return nil, translate(err)
	}

	if ticker, err := s.tickers.Lookup(item.Ticker); err == nil {
		item.CompanyName = ticker.Name
	}

	return item, nil
}

func (s *WatchlistService) Remove(ctx context.Context, userID, itemID string) error {
	return translate(s.repo.Delete(ctx, userID, itemID))
}

func (s *WatchlistService) Conditions(ctx context.Context, userID, itemID string) ([]model.WatchCondition, error) {
	if _, err := s.repo.ByID(ctx, userID, itemID); err != nil {
		return nil, translate(err)
	}
	return s.repo.ListConditions(ctx, userID, itemID)
}

func (s *WatchlistService) AddCondition(ctx context.Context, userID, itemID, conditionType string, config json.RawMessage, isActive bool) (*model.WatchCondition, error) {
	normalized, err := validateCondition(conditionType, config)
	if err != nil {
		return nil, err
	}

	condition, err := s.repo.CreateCondition(ctx, userID, itemID, conditionType, normalized, isActive)
	if err != nil {
		return nil, translate(err)
	}

	return condition, nil
}

func (s *WatchlistService) UpdateCondition(ctx context.Context, userID, itemID, conditionID string, config json.RawMessage, isActive *bool) (*model.WatchCondition, error) {
	existing, err := s.repo.ConditionByID(ctx, userID, itemID, conditionID)
	if err != nil {
		return nil, translate(err)
	}

	normalized := json.RawMessage(nil)
	if len(config) > 0 {
		normalized, err = validateCondition(existing.ConditionType, config)
		if err != nil {
			return nil, err
		}
	}

	condition, err := s.repo.UpdateCondition(ctx, userID, itemID, conditionID, normalized, isActive)
	if err != nil {
		return nil, translate(err)
	}

	return condition, nil
}

func (s *WatchlistService) RemoveCondition(ctx context.Context, userID, itemID, conditionID string) error {
	return translate(s.repo.DeleteCondition(ctx, userID, itemID, conditionID))
}

func (s *WatchlistService) SearchTickers(query string, limit int) []Ticker {
	return s.tickers.Search(query, limit)
}

func validateCondition(conditionType string, config json.RawMessage) (json.RawMessage, error) {
	v := newValidationError()

	if !slices.Contains(model.ConditionTypes, conditionType) {
		v.add("condition_type", "Jenis kondisi tidak dikenal")
		return nil, v
	}

	parsed := map[string]any{}
	if len(config) > 0 {
		if err := json.Unmarshal(config, &parsed); err != nil {
			v.add("config", "Config harus berupa objek JSON")
			return nil, v
		}
	}

	bersih := map[string]any{}

	switch conditionType {
	case model.ConditionPeriodicCustom:
		jam, ok := angka(parsed["interval_hours"])
		if !ok || jam < 1 || jam > 720 {
			v.add("config", "interval_hours wajib diisi antara 1 sampai 720")
		} else {
			bersih["interval_hours"] = jam
		}
	case model.ConditionWeekly:
		hari, ok := angka(parsed["weekday"])
		if !ok {
			hari = 1
		}
		if hari < 1 || hari > 7 {
			v.add("config", "weekday wajib antara 1 sampai 7")
		} else {
			bersih["weekday"] = hari
		}
	case model.ConditionGeopolitical, model.ConditionRecentEvent:
		ambang, ok := angka(parsed["min_score"])
		if !ok {
			ambang = 50
		}
		if ambang < 0 || ambang > 100 {
			v.add("config", "min_score wajib antara 0 sampai 100")
		} else {
			bersih["min_score"] = ambang
		}
	}

	if jam, ok := angka(parsed["hour_of_day"]); ok {
		if jam < 0 || jam > 23 {
			v.add("config", "hour_of_day wajib antara 0 sampai 23")
		} else {
			bersih["hour_of_day"] = jam
		}
	}

	if err := v.orNil(); err != nil {
		return nil, err
	}

	encoded, err := json.Marshal(bersih)
	if err != nil {
		return nil, err
	}

	return encoded, nil
}

func angka(raw any) (int, bool) {
	switch nilai := raw.(type) {
	case float64:
		return int(nilai), true
	case int:
		return nilai, true
	default:
		return 0, false
	}
}

func translate(err error) error {
	if errors.Is(err, repository.ErrNotFound) {
		return ErrTidakDitemukan
	}
	return err
}
