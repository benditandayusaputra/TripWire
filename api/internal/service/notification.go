package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
	"github.com/benditandayusaputra/tripwire/api/pkg/webpush"
)

const (
	batasDispatch       = 15 * time.Second
	batasHalamanNotif   = 30
	maksHalamanNotif    = 100
	jumlahHariAktivitas = 30
	batasEmitenNotif    = 50
)

var (
	ErrPushNonaktif = errors.New("service: web push belum dikonfigurasi")

	statusNotifikasi = []string{"", "unread", "read"}
	tierNotifikasi   = []string{"", "critical", "high", "moderate", "low"}
)

type NotificationService struct {
	notifikasi  *repository.NotificationRepository
	langganan   *repository.PushRepository
	hub         *StreamHub
	pengirim    *webpush.Pengirim
	tickers     *TickerService
	izinkanHTTP bool
}

func NewNotificationService(
	notifikasi *repository.NotificationRepository,
	langganan *repository.PushRepository,
	hub *StreamHub,
	pengirim *webpush.Pengirim,
	tickers *TickerService,
	izinkanHTTP bool,
) *NotificationService {
	return &NotificationService{
		notifikasi:  notifikasi,
		langganan:   langganan,
		hub:         hub,
		pengirim:    pengirim,
		tickers:     tickers,
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

	penerima, err := s.notifikasi.PenerimaTicker(ctx, insight.Ticker, insight.Score)
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

		if s.hub.Antar(ctx, userID, StreamEvent{Type: "insight", Data: ringkasan}) {
			hasil.ViaSSE++
			continue
		}

		if s.kirimPush(ctx, userID, ringkasan) {
			hasil.ViaPush++
		}
	}

	return hasil, nil
}

func (s *NotificationService) kirimPush(ctx context.Context, userID string, ringkasan RingkasanInsight) bool {
	payload, err := json.Marshal(map[string]any{
		"title": "TripWire: insight baru " + ringkasan.Ticker,
		"body":  pesanRingkas(ringkasan),
		"url":   "/insights/" + ringkasan.InsightID,
		"data":  ringkasan,
	})
	if err != nil {
		return false
	}

	_, terkirim := s.kirimKeSemua(ctx, userID, payload)
	return terkirim > 0
}

func (s *NotificationService) kirimKeSemua(ctx context.Context, userID string, payload []byte) (int, int) {
	if !s.pengirim.Aktif() {
		return 0, 0
	}

	daftar, err := s.langganan.UntukUser(ctx, userID)
	if err != nil || len(daftar) == 0 {
		return 0, 0
	}

	kirimCtx, batal := context.WithTimeout(ctx, batasDispatch)
	defer batal()

	terkirim := 0
	for _, item := range daftar {
		err := s.pengirim.Kirim(kirimCtx, webpush.Langganan{
			Endpoint:  item.Endpoint,
			P256dhKey: item.P256dhKey,
			AuthKey:   item.AuthKey,
		}, payload)

		switch {
		case err == nil:
			terkirim++
		case errors.Is(err, webpush.ErrLanggananHilang):
			if err := s.langganan.HapusEndpoint(context.WithoutCancel(ctx), item.Endpoint); err != nil {
				log.Printf("notifikasi: bersihkan langganan mati gagal: %v", err)
			}
		default:
			log.Printf("notifikasi: web push ke user %s gagal: %v", userID, err)
		}
	}

	return len(daftar), terkirim
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

type FilterNotifikasi = repository.FilterNotifikasi

type HalamanNotifikasi struct {
	Daftar []model.Notification
	Belum  int
	Kursor string
}

func (s *NotificationService) Riwayat(ctx context.Context, userID string, filter FilterNotifikasi) (*HalamanNotifikasi, error) {
	filter.Status = strings.ToLower(strings.TrimSpace(filter.Status))
	filter.Jenis = strings.ToLower(strings.TrimSpace(filter.Jenis))
	filter.Tier = strings.ToLower(strings.TrimSpace(filter.Tier))
	filter.Ticker = s.tickers.Normalize(filter.Ticker)
	filter.Kursor = strings.TrimSpace(filter.Kursor)

	v := newValidationError()
	if !slices.Contains(statusNotifikasi, filter.Status) {
		v.add("status", "Status notifikasi tidak dikenal")
	}
	if filter.Jenis != "" && filter.Jenis != InsightRedFlag && filter.Jenis != InsightMarketIntelligence {
		v.add("type", "Jenis insight tidak dikenal")
	}
	if !slices.Contains(tierNotifikasi, filter.Tier) {
		v.add("tier", "Tingkat risiko tidak dikenal")
	}
	if filter.Kursor != "" && !idValid(filter.Kursor) {
		v.add("before", "Penanda halaman tidak valid")
	}
	if err := v.orNil(); err != nil {
		return nil, err
	}

	batas := filter.Batas
	if batas <= 0 || batas > maksHalamanNotif {
		batas = batasHalamanNotif
	}
	filter.Batas = batas + 1

	daftar, err := s.notifikasi.Riwayat(ctx, userID, filter)
	if err != nil {
		return nil, err
	}

	halaman := &HalamanNotifikasi{Daftar: daftar}
	if len(daftar) > batas {
		halaman.Daftar = daftar[:batas]
		halaman.Kursor = daftar[batas-1].ID
	}
	for i := range halaman.Daftar {
		halaman.Daftar[i].CompanyName = s.namaEmiten(halaman.Daftar[i].Ticker)
	}

	halaman.Belum, err = s.notifikasi.BelumDibaca(ctx, userID)
	if err != nil {
		return nil, err
	}

	return halaman, nil
}

type RingkasanNotifikasi struct {
	model.NotificationSummary
	Harian    []model.NotificationDay    `json:"daily"`
	Emiten    []model.NotificationTicker `json:"tickers"`
	Puncak    *model.NotificationPeak    `json:"peak_30_days"`
	Perangkat int                        `json:"push_devices"`
	PushAktif bool                       `json:"push_enabled"`
	Online    bool                       `json:"online"`
}

func (s *NotificationService) Ringkasan(ctx context.Context, userID string) (*RingkasanNotifikasi, error) {
	dasar, err := s.notifikasi.Ringkasan(ctx, userID)
	if err != nil {
		return nil, err
	}

	harian, err := s.notifikasi.Harian(ctx, userID, jumlahHariAktivitas)
	if err != nil {
		return nil, err
	}

	emiten, err := s.notifikasi.PerEmiten(ctx, userID, batasEmitenNotif)
	if err != nil {
		return nil, err
	}
	for i := range emiten {
		emiten[i].CompanyName = s.namaEmiten(emiten[i].Ticker)
	}

	puncak, err := s.notifikasi.Puncak(ctx, userID)
	if err != nil {
		return nil, err
	}

	perangkat, err := s.langganan.UntukUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	return &RingkasanNotifikasi{
		NotificationSummary: *dasar,
		Harian:              harian,
		Emiten:              emiten,
		Puncak:              puncak,
		Perangkat:           len(perangkat),
		PushAktif:           s.pengirim.Aktif(),
		Online:              s.hub.Online(userID),
	}, nil
}

func (s *NotificationService) namaEmiten(ticker string) string {
	if emiten, err := s.tickers.Lookup(ticker); err == nil {
		return emiten.Name
	}
	return ""
}

func (s *NotificationService) TandaiDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	return ubahSatu(id, func() (*model.Notification, error) {
		return s.notifikasi.TandaiDibaca(ctx, userID, id)
	})
}

func (s *NotificationService) TandaiBelumDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	return ubahSatu(id, func() (*model.Notification, error) {
		return s.notifikasi.TandaiBelumDibaca(ctx, userID, id)
	})
}

func (s *NotificationService) Hapus(ctx context.Context, userID, id string) error {
	_, err := ubahSatu(id, func() (*model.Notification, error) {
		return nil, s.notifikasi.Hapus(ctx, userID, id)
	})
	return err
}

func ubahSatu(id string, ubah func() (*model.Notification, error)) (*model.Notification, error) {
	if !idValid(id) {
		return nil, ErrTidakDitemukan
	}

	notifikasi, err := ubah()
	if errors.Is(err, repository.ErrNotFound) {
		return nil, ErrTidakDitemukan
	}
	return notifikasi, err
}

func (s *NotificationService) TandaiSemuaDibaca(ctx context.Context, userID string) (int64, error) {
	return s.notifikasi.TandaiSemuaDibaca(ctx, userID)
}

func (s *NotificationService) HapusDibaca(ctx context.Context, userID string) (int64, error) {
	return s.notifikasi.HapusDibaca(ctx, userID)
}

func idValid(id string) bool {
	_, err := uuid.Parse(id)
	return err == nil
}

type HasilUjiPush struct {
	Perangkat int `json:"devices"`
	Terkirim  int `json:"delivered"`
}

var ErrBelumAdaInsight = errors.New("notifikasi: watchlist belum punya insight")

type HasilContoh struct {
	InsightID string `json:"insight_id"`
	Ticker    string `json:"ticker"`
	ViaSSE    bool   `json:"via_sse"`
	ViaPush   bool   `json:"via_web_push"`
}

func (s *NotificationService) KirimContoh(ctx context.Context, userID string) (HasilContoh, error) {
	event, err := s.notifikasi.InsightTerkuatDipantau(ctx, userID)
	if errors.Is(err, repository.ErrNotFound) {
		return HasilContoh{}, ErrBelumAdaInsight
	}
	if err != nil {
		return HasilContoh{}, err
	}

	tersimpan, err := s.notifikasi.Simpan(ctx, userID, event.ID)
	if err != nil {
		return HasilContoh{}, err
	}

	var isi struct {
		Category          string `json:"category"`
		CommodityExposure *struct {
			Category string `json:"category"`
		} `json:"commodity_exposure"`
	}
	_ = json.Unmarshal(event.Payload, &isi)
	if isi.Category == "" && isi.CommodityExposure != nil {
		isi.Category = isi.CommodityExposure.Category
	}

	dibuat := event.GeneratedAt
	ringkasan := RingkasanInsight{
		NotificationID: tersimpan.ID,
		InsightID:      event.ID,
		Ticker:         event.Ticker,
		CompanyName:    s.namaEmiten(event.Ticker),
		InsightType:    event.InsightType,
		Subtype:        event.Subtype,
		Score:          event.Score,
		Category:       isi.Category,
		GeneratedAt:    &dibuat,
	}

	return HasilContoh{
		InsightID: event.ID,
		Ticker:    event.Ticker,
		ViaSSE:    s.hub.Antar(ctx, userID, StreamEvent{Type: "insight", Data: ringkasan}),
		ViaPush:   s.kirimPush(ctx, userID, ringkasan),
	}, nil
}

func (s *NotificationService) KirimUji(ctx context.Context, userID string) (HasilUjiPush, error) {
	if !s.pengirim.Aktif() {
		return HasilUjiPush{}, ErrPushNonaktif
	}

	payload, err := json.Marshal(map[string]any{
		"title": "TripWire: notifikasi uji",
		"body":  "Notifikasi push di perangkat ini sudah berfungsi. Insight baru dari watchlist akan tampil seperti ini.",
		"url":   "/notifications",
		"tag":   "tripwire-uji",
	})
	if err != nil {
		return HasilUjiPush{}, err
	}

	perangkat, terkirim := s.kirimKeSemua(ctx, userID, payload)
	return HasilUjiPush{Perangkat: perangkat, Terkirim: terkirim}, nil
}

func (s *NotificationService) Perangkat(ctx context.Context, userID string) ([]model.PushSubscription, error) {
	return s.langganan.UntukUser(ctx, userID)
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
