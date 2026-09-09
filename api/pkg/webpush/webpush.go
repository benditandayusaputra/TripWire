package webpush

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	pustaka "github.com/SherClockHolmes/webpush-go"
)

var (
	ErrBelumDikonfigurasi  = errors.New("webpush: kunci VAPID belum diisi")
	ErrLanggananHilang     = errors.New("webpush: langganan sudah tidak berlaku di push service")
	ErrPengirimanGagal     = errors.New("webpush: push service menolak pengiriman")
	ErrLanggananTidakValid = errors.New("webpush: data langganan tidak lengkap")
)

type Langganan struct {
	Endpoint  string
	P256dhKey string
	AuthKey   string
}

type Pengirim struct {
	publik   string
	privat   string
	subjek   string
	ttl      int
	timeout  time.Duration
	aktif    bool
	transpor *http.Client
}

type Options struct {
	PublicKey  string
	PrivateKey string
	Subject    string
	TTL        int
	Timeout    time.Duration
}

func New(opts Options) *Pengirim {
	if opts.TTL <= 0 {
		opts.TTL = 86400
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 10 * time.Second
	}
	if opts.Subject == "" {
		opts.Subject = "mailto:admin@tripwire.local"
	}

	return &Pengirim{
		publik:   strings.TrimSpace(opts.PublicKey),
		privat:   strings.TrimSpace(opts.PrivateKey),
		subjek:   opts.Subject,
		ttl:      opts.TTL,
		timeout:  opts.Timeout,
		aktif:    strings.TrimSpace(opts.PublicKey) != "" && strings.TrimSpace(opts.PrivateKey) != "",
		transpor: &http.Client{Timeout: opts.Timeout},
	}
}

func GenerateVAPIDKeys() (privat string, publik string, err error) {
	return pustaka.GenerateVAPIDKeys()
}

func (p *Pengirim) Aktif() bool {
	return p.aktif
}

func (p *Pengirim) PublicKey() string {
	return p.publik
}

func (p *Pengirim) Kirim(ctx context.Context, langganan Langganan, payload []byte) error {
	if !p.aktif {
		return ErrBelumDikonfigurasi
	}
	if langganan.Endpoint == "" || langganan.P256dhKey == "" || langganan.AuthKey == "" {
		return ErrLanggananTidakValid
	}

	tujuan := &pustaka.Subscription{
		Endpoint: langganan.Endpoint,
		Keys: pustaka.Keys{
			P256dh: langganan.P256dhKey,
			Auth:   langganan.AuthKey,
		},
	}

	response, err := pustaka.SendNotificationWithContext(ctx, payload, tujuan, &pustaka.Options{
		Subscriber:      p.subjek,
		VAPIDPublicKey:  p.publik,
		VAPIDPrivateKey: p.privat,
		TTL:             p.ttl,
		HTTPClient:      p.transpor,
	})
	if err != nil {
		return fmt.Errorf("%w: %v", ErrPengirimanGagal, err)
	}
	defer response.Body.Close()

	io.Copy(io.Discard, io.LimitReader(response.Body, 4<<10))

	switch {
	case response.StatusCode == http.StatusNotFound, response.StatusCode == http.StatusGone:
		return ErrLanggananHilang
	case response.StatusCode >= 400:
		return fmt.Errorf("%w: status %d", ErrPengirimanGagal, response.StatusCode)
	}

	return nil
}
