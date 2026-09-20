package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/data"
)

const (
	tickerUniverseKey = "sectors:ticker_universe"
	tickerUniverseTTL = 24 * time.Hour
)

var ErrTickerTidakDikenal = errors.New("service: ticker tidak terdaftar di IDX")

type Ticker struct {
	Code         string `json:"code"`
	Name         string `json:"name"`
	ListingBoard string `json:"listing_board"`
}

type TickerService struct {
	redis *redis.Client

	mu       sync.RWMutex
	byCode   map[string]Ticker
	ordered  []Ticker
	loadedAt time.Time
}

func NewTickerService(client *redis.Client) (*TickerService, error) {
	s := &TickerService{redis: client}

	seed, err := loadSeedTickers()
	if err != nil {
		return nil, err
	}
	s.replace(seed)

	return s, nil
}

func loadSeedTickers() ([]Ticker, error) {
	reader := csv.NewReader(bytes.NewReader(data.IDXTickersCSV))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, err
	}

	tickers := make([]Ticker, 0, len(records))
	for i, record := range records {
		if i == 0 || len(record) < 3 {
			continue
		}
		tickers = append(tickers, Ticker{
			Code:         strings.ToUpper(strings.TrimSpace(record[0])),
			Name:         strings.TrimSpace(record[1]),
			ListingBoard: strings.TrimSpace(record[2]),
		})
	}

	return tickers, nil
}

func (s *TickerService) replace(tickers []Ticker) {
	byCode := make(map[string]Ticker, len(tickers))
	for _, ticker := range tickers {
		byCode[ticker.Code] = ticker
	}

	sort.Slice(tickers, func(i, j int) bool { return tickers[i].Code < tickers[j].Code })

	s.mu.Lock()
	s.byCode = byCode
	s.ordered = tickers
	s.loadedAt = time.Now()
	s.mu.Unlock()
}

func (s *TickerService) Normalize(raw string) string {
	return strings.ToUpper(strings.TrimSpace(strings.TrimSuffix(strings.ToUpper(strings.TrimSpace(raw)), ".JK")))
}

func (s *TickerService) Lookup(raw string) (Ticker, error) {
	code := s.Normalize(raw)

	s.mu.RLock()
	ticker, found := s.byCode[code]
	s.mu.RUnlock()

	if !found {
		return Ticker{}, ErrTickerTidakDikenal
	}
	return ticker, nil
}

func (s *TickerService) Search(query string, limit int) []Ticker {
	needle := strings.ToUpper(strings.TrimSpace(query))
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	hasil := make([]Ticker, 0, limit)
	for _, ticker := range s.ordered {
		if needle != "" &&
			!strings.HasPrefix(ticker.Code, needle) &&
			!strings.Contains(strings.ToUpper(ticker.Name), needle) {
			continue
		}
		hasil = append(hasil, ticker)
		if len(hasil) == limit {
			break
		}
	}

	return hasil
}

func (s *TickerService) Total() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.ordered)
}

func (s *TickerService) LoadFromCache(ctx context.Context) error {
	raw, err := s.redis.Get(ctx, tickerUniverseKey).Bytes()
	if err != nil {
		return err
	}

	var tickers []Ticker
	if err := json.Unmarshal(raw, &tickers); err != nil || len(tickers) == 0 {
		return errors.New("service: cache ticker universe tidak terbaca")
	}

	s.replace(tickers)
	return nil
}

func (s *TickerService) SaveToCache(ctx context.Context, tickers []Ticker) error {
	if len(tickers) == 0 {
		return nil
	}

	raw, err := json.Marshal(tickers)
	if err != nil {
		return err
	}

	s.replace(tickers)
	return s.redis.Set(ctx, tickerUniverseKey, raw, tickerUniverseTTL).Err()
}
