package service

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	prefixPresence = "presence:"
	presenceTTL    = 90 * time.Second
	bufferKlien    = 16
	kanalSiaran    = "stream:siaran"
)

type StreamEvent struct {
	Type string `json:"type"`
	Data any    `json:"data,omitempty"`
	At   string `json:"at"`
}

type siaranStream struct {
	UserID string      `json:"user_id"`
	Event  StreamEvent `json:"event"`
}

type StreamHub struct {
	redis *redis.Client

	mu    sync.RWMutex
	klien map[string]map[chan []byte]struct{}
}

func NewStreamHub(client *redis.Client) *StreamHub {
	return &StreamHub{redis: client, klien: make(map[string]map[chan []byte]struct{})}
}

func (h *StreamHub) Daftar(ctx context.Context, userID string) (<-chan []byte, func()) {
	saluran := make(chan []byte, bufferKlien)

	h.mu.Lock()
	if h.klien[userID] == nil {
		h.klien[userID] = make(map[chan []byte]struct{})
	}
	h.klien[userID][saluran] = struct{}{}
	h.mu.Unlock()

	h.tandaiHadir(ctx, userID)

	lepas := func() {
		h.mu.Lock()
		if daftar, ada := h.klien[userID]; ada {
			if _, masih := daftar[saluran]; masih {
				delete(daftar, saluran)
				close(saluran)
			}
			if len(daftar) == 0 {
				delete(h.klien, userID)
			}
		}
		kosong := h.klien[userID] == nil
		h.mu.Unlock()

		if kosong {
			h.redis.Del(context.WithoutCancel(ctx), prefixPresence+userID)
		}
	}

	return saluran, lepas
}

func (h *StreamHub) Online(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.klien[userID]) > 0
}

func (h *StreamHub) OnlineDiRedis(ctx context.Context, userID string) bool {
	ada, err := h.redis.Exists(ctx, prefixPresence+userID).Result()
	return err == nil && ada > 0
}

func (h *StreamHub) Kirim(userID string, event StreamEvent) bool {
	if event.At == "" {
		event.At = time.Now().UTC().Format(time.RFC3339Nano)
	}

	isi, err := json.Marshal(event)
	if err != nil {
		return false
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	terkirim := false
	for saluran := range h.klien[userID] {
		select {
		case saluran <- isi:
			terkirim = true
		default:
		}
	}

	return terkirim
}

func (h *StreamHub) Antar(ctx context.Context, userID string, event StreamEvent) bool {
	if h.Online(userID) {
		h.tandaiHadir(ctx, userID)
		return h.Kirim(userID, event)
	}

	if !h.OnlineDiRedis(ctx, userID) {
		return false
	}

	isi, err := json.Marshal(siaranStream{UserID: userID, Event: event})
	if err != nil {
		return false
	}

	penerima, err := h.redis.Publish(ctx, kanalSiaran, isi).Result()
	return err == nil && penerima > 0
}

func (h *StreamHub) Dengarkan(ctx context.Context) {
	langganan := h.redis.Subscribe(ctx, kanalSiaran)
	defer langganan.Close()

	for pesan := range langganan.Channel() {
		var siaran siaranStream
		if json.Unmarshal([]byte(pesan.Payload), &siaran) == nil && siaran.UserID != "" {
			h.Kirim(siaran.UserID, siaran.Event)
		}
	}
}

func (h *StreamHub) SegarkanPresence(ctx context.Context, userID string) {
	h.tandaiHadir(ctx, userID)
}

func (h *StreamHub) tandaiHadir(ctx context.Context, userID string) {
	h.redis.Set(ctx, prefixPresence+userID, time.Now().UTC().Format(time.RFC3339), presenceTTL)
}

func (e StreamEvent) JSON() ([]byte, error) {
	return json.Marshal(e)
}
