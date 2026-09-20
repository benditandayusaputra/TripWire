package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/pkg/webpush"
)

const batasDispatch = 15 * time.Second

type NotificationService struct {
	notifikasi  *repository.NotificationRepository
	langganan   *repository.PushRepository
	hub         *StreamHub
	pengirim    *webpush.Pengirim
	izinkanHTTP bool
}

func NewNotificationService(
	notifikasi *repository.NotificationRepository,
	langganan *repository.PushRepository,
	hub *StreamHub,
	pengirim *webpush.Pengirim,
	izinkanHTTP bool,
) *NotificationService {
	return &NotificationService{
		notifikasi:  notifikasi,
		langganan:   langganan,
		hub:         hub,
		pengirim:    pengirim,
		izinkanHTTP: izinkanHTTP,
	}
}

type LanggananPush struct {
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

func (l *LanggananPush) bersihkan() {
	l.Endpoint = strings.TrimSpace(l.Endpoint)
	l.P256dh = strings.TrimSpace(l.P256dh)
	l.Auth = strings.TrimSpace(l.Auth)
}

func (l LanggananPush) validasi(izinkanHTTP bool) error {
	v := newValidationError()

	switch {
	case l.Endpoint == "":
		v.add("endpoint", "Endpoint langganan wajib diisi")
	case len(l.Endpoint) > 2048:
		v.add("endpoint", "Endpoint langganan terlalu panjang")
	default:
		alamat, err := url.Parse(l.Endpoint)
		switch {
		case err != nil || alamat.Host == "":
			v.add("endpoint", "Endpoint langganan bukan URL yang valid")
		case alamat.Scheme == "https":
		case alamat.Scheme == "http" && izinkanHTTP:
		default:
			v.add("endpoint", "Endpoint langganan wajib memakai HTTPS")
		}
	}

	if !kunciPushValid(l.P256dh, 32) {
		v.add("p256dh", "Kunci p256dh tidak valid")
	}
	if !kunciPushValid(l.Auth, 8) {
		v.add("auth", "Kunci auth tidak valid")
	}

	return v.orNil()
}

func kunciPushValid(kunci string, minimal int) bool {
	if kunci == "" || len(kunci) > 512 {
		return false
	}
	for _, encoding := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding, base64.StdEncoding, base64.RawStdEncoding} {
		if mentah, err := encoding.DecodeString(kunci); err == nil {
			return len(mentah) >= minimal
		}
	}
	return false
}

type RingkasanInsight struct {
	NotificationID string     `json:"notification_id"`
	InsightID      string     `json:"insight_id"`
	Ticker         string     `json:"ticker"`
	CompanyName    string     `json:"company_name"`
	InsightType    string     `json:"insight_type"`
	Subtype        string     `json:"subtype"`
	Score          *float64   `json:"score"`
	Category       string     `json:"category,omitempty"`
	GeneratedAt    *time.Time `json:"generated_at,omitempty"`
}

type HasilDispatch struct {
	Penerima int `json:"recipients"`
	ViaSSE   int `json:"via_sse"`
	ViaPush  int `json:"via_web_push"`
	Gagal    int `json:"failed"`
}

func (s *NotificationService) Dispatch(ctx context.Context, insight *Insight) (HasilDispatch, error) {
	hasil := HasilDispatch{}
	if insight == nil || insight.ID == "" {
		return hasil, nil
	}

	penerima, err := s.notifikasi.PenerimaTicker(ctx, insight.Ticker)
	if err != nil {
		return hasil, err
	}

	for _, userID := range penerima {
		tersimpan, err := s.notifikasi.Simpan(ctx, userID, insight.ID)
		if err != nil {
			hasil.Gagal++
			log.Printf("notifikasi: simpan untuk user %s gagal: %v", userID, err)
			continue
		}

		hasil.Penerima++
		ringkasan := ringkasInsight(insight, tersimpan.ID)

		if s.hub.Online(userID) {
			s.hub.SegarkanPresence(ctx, userID)
			if s.hub.Kirim(userID, StreamEvent{Type: "insight", Data: ringkasan}) {
				hasil.ViaSSE++
				continue
			}
		}

		if s.kirimPush(ctx, userID, ringkasan) {
			hasil.ViaPush++
		}
	}

	return hasil, nil
}

func (s *NotificationService) kirimPush(ctx context.Context, userID string, ringkasan RingkasanInsight) bool {
	if !s.pengirim.Aktif() {
		return false
	}

	daftar, err := s.langganan.UntukUser(ctx, userID)
	if err != nil || len(daftar) == 0 {
		return false
	}

	payload, err := json.Marshal(map[string]any{
		"title": "TripWire: insight baru " + ringkasan.Ticker,
		"body":  pesanRingkas(ringkasan),
		"url":   "/insights/" + ringkasan.InsightID,
		"data":  ringkasan,
	})
	if err != nil {
		return false
	}

	kirimCtx, batal := context.WithTimeout(ctx, batasDispatch)
	defer batal()

	terkirim := false
	for _, item := range daftar {
		err := s.pengirim.Kirim(kirimCtx, webpush.Langganan{
			Endpoint:  item.Endpoint,
			P256dhKey: item.P256dhKey,
			AuthKey:   item.AuthKey,
		}, payload)

		switch {
		case err == nil:
			terkirim = true
		case errors.Is(err, webpush.ErrLanggananHilang):
			if err := s.langganan.HapusEndpoint(context.WithoutCancel(ctx), item.Endpoint); err != nil {
				log.Printf("notifikasi: bersihkan langganan mati gagal: %v", err)
			}
		default:
			log.Printf("notifikasi: web push ke user %s gagal: %v", userID, err)
		}
	}

	return terkirim
}

func ringkasInsight(insight *Insight, notificationID string) RingkasanInsight {
	return RingkasanInsight{
		NotificationID: notificationID,
		InsightID:      insight.ID,
		Ticker:         insight.Ticker,
		CompanyName:    insight.CompanyName,
		InsightType:    insight.InsightType,
		Subtype:        insight.Subtype,
		Score:          insight.Score,
		Category:       kategoriDariPayload(insight.Payload),
		GeneratedAt:    insight.GeneratedAt,
	}
}

func kategoriDariPayload(payload any) string {
	switch isi := payload.(type) {
	case RedFlagPayload:
		return isi.Category
	case MarketIntelPayload:
		if isi.CommodityExposure != nil {
			return isi.CommodityExposure.Category
		}
	}
	return ""
}

func pesanRingkas(ringkasan RingkasanInsight) string {
	nama := ringkasan.CompanyName
	if nama == "" {
		nama = ringkasan.Ticker
	}
	if ringkasan.Category != "" {
		return nama + ", kategori " + ringkasan.Category + ", informasi analisis bukan rekomendasi beli jual"
	}
	return nama + ", insight baru tersedia, informasi analisis bukan rekomendasi beli jual"
}

func (s *NotificationService) Riwayat(ctx context.Context, userID string, limit int) ([]model.Notification, int, error) {
	daftar, err := s.notifikasi.Riwayat(ctx, userID, limit)
	if err != nil {
		return nil, 0, err
	}

	belum, err := s.notifikasi.BelumDibaca(ctx, userID)
	if err != nil {
		return nil, 0, err
	}

	return daftar, belum, nil
}

func (s *NotificationService) TandaiDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	notifikasi, err := s.notifikasi.TandaiDibaca(ctx, userID, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrTidakDitemukan
		}
		return nil, err
	}
	return notifikasi, nil
}

func (s *NotificationService) Berlangganan(ctx context.Context, userID string, masukan LanggananPush) (*model.PushSubscription, error) {
	masukan.bersihkan()
	if err := masukan.validasi(s.izinkanHTTP); err != nil {
		return nil, err
	}

	langganan := &model.PushSubscription{
		UserID:    userID,
		Endpoint:  masukan.Endpoint,
		P256dhKey: masukan.P256dh,
		AuthKey:   masukan.Auth,
	}
	if err := s.langganan.Simpan(ctx, langganan); err != nil {
		return nil, err
	}

	return langganan, nil
}

func (s *NotificationService) BerhentiBerlangganan(ctx context.Context, userID, endpoint string) error {
	if err := s.langganan.Hapus(ctx, userID, endpoint); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrTidakDitemukan
		}
		return err
	}
	return nil
}

func (s *NotificationService) PublicKeyVAPID() string {
	return s.pengirim.PublicKey()
}

func (s *NotificationService) PushAktif() bool {
	return s.pengirim.Aktif()
}

func (s *NotificationService) Online(userID string) bool {
	return s.hub.Online(userID)
}
