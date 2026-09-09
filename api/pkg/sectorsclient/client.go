package sectorsclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrCreditHabis     = errors.New("sectorsclient: sisa credit di bawah ambang batas")
	ErrCircuitTerbuka  = errors.New("sectorsclient: circuit breaker sedang terbuka")
	ErrUpstreamGagal   = errors.New("sectorsclient: panggilan ke Sectors API gagal")
	ErrTidakDitemukan  = errors.New("sectorsclient: data tidak ditemukan di Sectors API")
	ErrKunciBelumDiisi = errors.New("sectorsclient: SECTORS_API_KEY belum diisi")
)

const (
	keyCreditTerpakai = "sectors:credit:terpakai"
	keyCircuit        = "sectors:circuit:terbuka"
	keyKegagalan      = "sectors:circuit:kegagalan"
	prefixCache       = "sectors:cache:"
)

type Options struct {
	BaseURL         string
	APIKey          string
	CreditBudget    int64
	CreditThreshold int64
	CacheTTL        time.Duration
	FailureLimit    int64
	CircuitCooldown time.Duration
	Timeout         time.Duration
}

type Client struct {
	opts  Options
	redis *redis.Client
	http  *http.Client
}

type Hasil struct {
	Data      json.RawMessage
	Cached    bool
	Latensi   time.Duration
	Terpakai  int64
	Tersisa   int64
	CacheKey  string
	SumberURL string
}

func New(client *redis.Client, opts Options) *Client {
	if opts.CacheTTL <= 0 {
		opts.CacheTTL = 6 * time.Hour
	}
	if opts.FailureLimit <= 0 {
		opts.FailureLimit = 5
	}
	if opts.CircuitCooldown <= 0 {
		opts.CircuitCooldown = 60 * time.Second
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 10 * time.Second
	}
	opts.BaseURL = strings.TrimSuffix(opts.BaseURL, "/")

	return &Client{
		opts:  opts,
		redis: client,
		http:  &http.Client{Timeout: opts.Timeout},
	}
}

func (c *Client) Get(ctx context.Context, path string) (*Hasil, error) {
	return c.GetWithTTL(ctx, path, c.opts.CacheTTL)
}

func (c *Client) GetWithTTL(ctx context.Context, path string, ttl time.Duration) (*Hasil, error) {
	mulai := time.Now()
	cacheKey := prefixCache + strings.TrimPrefix(path, "/")

	if cached, err := c.redis.Get(ctx, cacheKey).Bytes(); err == nil && len(cached) > 0 {
		terpakai, tersisa := c.Kredit(ctx)
		return &Hasil{
			Data:     cached,
			Cached:   true,
			Latensi:  time.Since(mulai),
			Terpakai: terpakai,
			Tersisa:  tersisa,
			CacheKey: cacheKey,
		}, nil
	}

	if c.opts.APIKey == "" {
		return nil, ErrKunciBelumDiisi
	}

	if terbuka, _ := c.redis.Exists(ctx, keyCircuit).Result(); terbuka > 0 {
		return nil, ErrCircuitTerbuka
	}

	terpakai, tersisa := c.Kredit(ctx)
	if tersisa <= c.opts.CreditThreshold {
		return nil, ErrCreditHabis
	}

	data, err := c.ambilUpstream(ctx, path)
	if err != nil {
		if errors.Is(err, ErrUpstreamGagal) {
			c.catatKegagalan(ctx)
		}
		return nil, err
	}

	c.redis.Del(ctx, keyKegagalan)
	terpakai, _ = c.redis.Incr(ctx, keyCreditTerpakai).Result()
	tersisa = c.opts.CreditBudget - terpakai

	if err := c.redis.Set(ctx, cacheKey, []byte(data), ttl).Err(); err != nil {
		return nil, err
	}

	return &Hasil{
		Data:      data,
		Cached:    false,
		Latensi:   time.Since(mulai),
		Terpakai:  terpakai,
		Tersisa:   tersisa,
		CacheKey:  cacheKey,
		SumberURL: c.opts.BaseURL + path,
	}, nil
}

func (c *Client) ambilUpstream(ctx context.Context, path string) (json.RawMessage, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.opts.BaseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstreamGagal, err)
	}
	request.Header.Set("Authorization", c.opts.APIKey)
	request.Header.Set("Accept", "application/json")

	response, err := c.http.Do(request)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstreamGagal, err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstreamGagal, err)
	}

	switch {
	case response.StatusCode == http.StatusNotFound:
		return nil, ErrTidakDitemukan
	case response.StatusCode >= 400:
		return nil, fmt.Errorf("%w: status %d", ErrUpstreamGagal, response.StatusCode)
	}

	if !json.Valid(body) {
		return nil, fmt.Errorf("%w: respons bukan JSON valid", ErrUpstreamGagal)
	}

	return json.RawMessage(body), nil
}

func (c *Client) catatKegagalan(ctx context.Context) {
	kegagalan, err := c.redis.Incr(ctx, keyKegagalan).Result()
	if err != nil {
		return
	}
	if kegagalan == 1 {
		c.redis.Expire(ctx, keyKegagalan, c.opts.CircuitCooldown)
	}
	if kegagalan >= c.opts.FailureLimit {
		c.redis.Set(ctx, keyCircuit, "1", c.opts.CircuitCooldown)
		c.redis.Del(ctx, keyKegagalan)
	}
}

func (c *Client) Kredit(ctx context.Context) (terpakai, tersisa int64) {
	terpakai, err := c.redis.Get(ctx, keyCreditTerpakai).Int64()
	if err != nil {
		terpakai = 0
	}
	return terpakai, c.opts.CreditBudget - terpakai
}

func (c *Client) CircuitTerbuka(ctx context.Context) bool {
	terbuka, _ := c.redis.Exists(ctx, keyCircuit).Result()
	return terbuka > 0
}

func (c *Client) Budget() int64 {
	return c.opts.CreditBudget
}

func (c *Client) Threshold() int64 {
	return c.opts.CreditThreshold
}
