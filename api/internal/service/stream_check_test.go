package service

import (
	"context"
	"sync"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestKirimBersamaanDenganLepasTidakPanic(t *testing.T) {
	hub := NewStreamHub(redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", MaxRetries: -1}))
	ctx := context.Background()

	var tunggu sync.WaitGroup
	for range 50 {
		_, lepas := hub.Daftar(ctx, "pengguna")
		tunggu.Add(2)
		go func() {
			defer tunggu.Done()
			for range 200 {
				hub.Kirim("pengguna", StreamEvent{Type: "uji"})
			}
		}()
		go func() {
			defer tunggu.Done()
			lepas()
		}()
	}
	tunggu.Wait()

	if hub.Online("pengguna") {
		t.Fatal("semua klien sudah dilepas tapi hub masih menganggap pengguna online")
	}
}
