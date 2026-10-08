package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type NotificationRepository struct {
	store *Store
}

func NewNotificationRepository(store *Store) *NotificationRepository {
	return &NotificationRepository{store: store}
}

type FilterNotifikasi struct {
	Status string
	Jenis  string
	Tier   string
	Ticker string
	Kursor string
	Batas  int
}

var rentangTier = map[string]string{
	"critical": "e.score >= 86",
	"high":     "e.score >= 61 AND e.score < 86",
	"moderate": "e.score >= 31 AND e.score < 61",
	"low":      "(e.score IS NULL OR e.score < 31)",
}

const kolomNotifikasi = `n.id, n.user_id, n.insight_event_id, n.sent_at, n.read_at,
	e.ticker, e.insight_type, e.subtype, e.score::float8 AS score, e.generated_at,
	COALESCE(e.payload->>'category', e.payload->'commodity_exposure'->>'category', '') AS category,
	e.payload->'sub_scores' AS sub_scores,
	e.payload->'cross_pattern'->'active_signals' AS signals,
	(SELECT p.score::float8 FROM insight_events p
	  WHERE p.ticker = e.ticker AND p.insight_type = e.insight_type AND p.subtype = e.subtype
	    AND p.score IS NOT NULL AND (p.generated_at, p.id) < (e.generated_at, e.id)
	  ORDER BY p.generated_at DESC, p.id DESC LIMIT 1) AS prev_score`

func (r *NotificationRepository) PenerimaTicker(ctx context.Context, ticker string, skor *float64) ([]string, error) {
	penerima := []string{}
	query := `SELECT DISTINCT w.user_id::text
	          FROM watchlist_items w
	          WHERE w.ticker = $1
	            AND (
	              NOT EXISTS (
	                SELECT 1 FROM watch_conditions c
	                WHERE c.watchlist_item_id = w.id AND c.is_active
	              )
	              OR EXISTS (
	                SELECT 1 FROM watch_conditions c
	                WHERE c.watchlist_item_id = w.id AND c.is_active
	                  AND (
	                    c.condition_type NOT IN ('recent_event', 'geopolitical')
	                    OR $2::numeric >= COALESCE((c.config->>'min_score')::numeric, 0)
	                  )
	              )
	            )`
	if err := r.store.DB.SelectContext(ctx, &penerima, query, ticker, skor); err != nil {
		return nil, err
	}
	return penerima, nil
}

func (r *NotificationRepository) Simpan(ctx context.Context, userID, insightEventID string) (*model.Notification, error) {
	notifikasi := &model.Notification{}
	query := `INSERT INTO notifications (user_id, insight_event_id)
	          VALUES ($1, $2)
	          RETURNING id, user_id, insight_event_id, sent_at, read_at`
	if err := r.store.DB.GetContext(ctx, notifikasi, query, userID, insightEventID); err != nil {
		return nil, err
	}
	return notifikasi, nil
}

func (r *NotificationRepository) InsightTerkuatDipantau(ctx context.Context, userID string) (*model.InsightEvent, error) {
	event := &model.InsightEvent{}
	query := `SELECT id, ticker, insight_type, subtype, score, payload, signature, prev_hash, current_hash, generated_at
	          FROM insight_events
	          WHERE ticker IN (SELECT ticker FROM watchlist_items WHERE user_id = $1)
	          ORDER BY score DESC NULLS LAST, generated_at DESC
	          LIMIT 1`
	if err := r.store.DB.GetContext(ctx, event, query, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return event, nil
}

func (r *NotificationRepository) Riwayat(ctx context.Context, userID string, filter FilterNotifikasi) ([]model.Notification, error) {
	kondisi := []string{"n.user_id = $1"}
	args := []any{userID}
	param := func(nilai any) string {
		args = append(args, nilai)
		return fmt.Sprintf("$%d", len(args))
	}

	switch filter.Status {
	case "unread":
		kondisi = append(kondisi, "n.read_at IS NULL")
	case "read":
		kondisi = append(kondisi, "n.read_at IS NOT NULL")
	}
	if filter.Jenis != "" {
		kondisi = append(kondisi, "e.insight_type = "+param(filter.Jenis))
	}
	if rentang, ada := rentangTier[filter.Tier]; ada {
		kondisi = append(kondisi, "e.insight_type = 'red_flag'", rentang)
	}
	if filter.Ticker != "" {
		kondisi = append(kondisi, "e.ticker = "+param(filter.Ticker))
	}
	if filter.Kursor != "" {
		kondisi = append(kondisi, `(n.sent_at, n.id) < (SELECT c.sent_at, c.id FROM notifications c
		                           WHERE c.id = `+param(filter.Kursor)+` AND c.user_id = $1)`)
	}

	daftar := []model.Notification{}
	query := `SELECT ` + kolomNotifikasi + `
	          FROM notifications n
	          JOIN insight_events e ON e.id = n.insight_event_id
	          WHERE ` + strings.Join(kondisi, " AND ") + `
	          ORDER BY n.sent_at DESC, n.id DESC
	          LIMIT ` + param(filter.Batas)
	if err := r.store.DB.SelectContext(ctx, &daftar, query, args...); err != nil {
		return nil, err
	}
	return daftar, nil
}

func (r *NotificationRepository) TandaiDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	return r.ubahDibaca(ctx, userID, id, "COALESCE(read_at, now())")
}

func (r *NotificationRepository) TandaiBelumDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	return r.ubahDibaca(ctx, userID, id, "NULL")
}

func (r *NotificationRepository) ubahDibaca(ctx context.Context, userID, id, nilai string) (*model.Notification, error) {
	notifikasi := &model.Notification{}
	query := `UPDATE notifications
	          SET read_at = ` + nilai + `
	          WHERE id = $1 AND user_id = $2
	          RETURNING id, user_id, insight_event_id, sent_at, read_at`
	if err := r.store.DB.GetContext(ctx, notifikasi, query, id, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return notifikasi, nil
}

func (r *NotificationRepository) TandaiSemuaDibaca(ctx context.Context, userID string) (int64, error) {
	return r.ubahBanyak(ctx, `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, userID)
}

func (r *NotificationRepository) Hapus(ctx context.Context, userID, id string) error {
	terhapus, err := r.ubahBanyak(ctx, `DELETE FROM notifications WHERE id = $2 AND user_id = $1`, userID, id)
	if err != nil {
		return err
	}
	if terhapus == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *NotificationRepository) HapusDibaca(ctx context.Context, userID string) (int64, error) {
	return r.ubahBanyak(ctx, `DELETE FROM notifications WHERE user_id = $1 AND read_at IS NOT NULL`, userID)
}

func (r *NotificationRepository) ubahBanyak(ctx context.Context, query string, args ...any) (int64, error) {
	hasil, err := r.store.DB.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	return hasil.RowsAffected()
}

func (r *NotificationRepository) BelumDibaca(ctx context.Context, userID string) (int, error) {
	var jumlah int
	query := `SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`
	if err := r.store.DB.GetContext(ctx, &jumlah, query, userID); err != nil {
		return 0, err
	}
	return jumlah, nil
}

func (r *NotificationRepository) Ringkasan(ctx context.Context, userID string) (*model.NotificationSummary, error) {
	ringkasan := &model.NotificationSummary{}
	query := `SELECT count(*) AS total,
	                 count(*) FILTER (WHERE n.read_at IS NULL) AS unread,
	                 count(*) FILTER (WHERE n.sent_at >= now() - interval '7 days') AS last_7_days,
	                 count(*) FILTER (WHERE n.sent_at >= now() - interval '7 days'
	                                    AND e.insight_type = 'red_flag' AND e.score >= 86) AS critical_7_days,
	                 count(*) FILTER (WHERE n.sent_at >= now() - interval '30 days') AS last_30_days,
	                 count(*) FILTER (WHERE n.sent_at >= now() - interval '60 days'
	                                    AND n.sent_at < now() - interval '30 days') AS previous_30_days,
	                 count(*) FILTER (WHERE e.insight_type = 'red_flag') AS red_flag,
	                 count(*) FILTER (WHERE e.insight_type = 'market_intelligence') AS market_intelligence,
	                 count(*) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["critical"] + `) AS critical,
	                 count(*) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["high"] + `) AS high,
	                 count(*) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["moderate"] + `) AS moderate,
	                 count(*) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["low"] + `) AS low,
	                 max(n.sent_at) AS last_sent_at
	          FROM notifications n
	          JOIN insight_events e ON e.id = n.insight_event_id
	          WHERE n.user_id = $1`
	if err := r.store.DB.GetContext(ctx, ringkasan, query, userID); err != nil {
		return nil, err
	}
	return ringkasan, nil
}

func (r *NotificationRepository) Harian(ctx context.Context, userID string, jumlahHari int) ([]model.NotificationDay, error) {
	daftar := []model.NotificationDay{}
	query := `WITH hari AS (
	            SELECT generate_series(
	              (now() AT TIME ZONE 'Asia/Jakarta')::date - ($2::int - 1),
	              (now() AT TIME ZONE 'Asia/Jakarta')::date,
	              interval '1 day'
	            )::date AS tanggal
	          )
	          SELECT to_char(h.tanggal, 'YYYY-MM-DD') AS date,
	                 count(e.id) AS total,
	                 count(e.id) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["critical"] + `) AS critical,
	                 count(e.id) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["high"] + `) AS high,
	                 count(e.id) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["moderate"] + `) AS moderate,
	                 count(e.id) FILTER (WHERE e.insight_type = 'red_flag' AND ` + rentangTier["low"] + `) AS low,
	                 count(e.id) FILTER (WHERE e.insight_type = 'market_intelligence') AS market
	          FROM hari h
	          LEFT JOIN notifications n
	            ON n.user_id = $1 AND (n.sent_at AT TIME ZONE 'Asia/Jakarta')::date = h.tanggal
	          LEFT JOIN insight_events e ON e.id = n.insight_event_id
	          GROUP BY h.tanggal
	          ORDER BY h.tanggal`
	if err := r.store.DB.SelectContext(ctx, &daftar, query, userID, jumlahHari); err != nil {
		return nil, err
	}
	return daftar, nil
}

func (r *NotificationRepository) PerEmiten(ctx context.Context, userID string, batas int) ([]model.NotificationTicker, error) {
	daftar := []model.NotificationTicker{}
	query := `SELECT e.ticker,
	                 count(*) AS total,
	                 count(*) FILTER (WHERE n.sent_at >= now() - interval '30 days') AS recent,
	                 count(*) FILTER (WHERE n.read_at IS NULL) AS unread,
	                 max(n.sent_at) AS latest_at,
	                 (array_agg(e.score::float8 ORDER BY n.sent_at DESC, n.id DESC)
	                   FILTER (WHERE e.insight_type = 'red_flag' AND e.score IS NOT NULL))[1] AS latest_score,
	                 COALESCE(to_jsonb((array_agg(e.score::float8 ORDER BY n.sent_at DESC, n.id DESC)
	                   FILTER (WHERE e.insight_type = 'red_flag' AND e.score IS NOT NULL))[1:12]), '[]'::jsonb) AS scores
	          FROM notifications n
	          JOIN insight_events e ON e.id = n.insight_event_id
	          WHERE n.user_id = $1
	          GROUP BY e.ticker
	          ORDER BY recent DESC, total DESC, latest_at DESC
	          LIMIT $2`
	if err := r.store.DB.SelectContext(ctx, &daftar, query, userID, batas); err != nil {
		return nil, err
	}
	return daftar, nil
}

func (r *NotificationRepository) Puncak(ctx context.Context, userID string) (*model.NotificationPeak, error) {
	puncak := &model.NotificationPeak{}
	query := `SELECT n.id AS notification_id, e.id AS insight_id, e.ticker, e.score::float8 AS score, n.sent_at
	          FROM notifications n
	          JOIN insight_events e ON e.id = n.insight_event_id
	          WHERE n.user_id = $1 AND n.sent_at >= now() - interval '30 days'
	            AND e.insight_type = 'red_flag' AND e.score IS NOT NULL
	          ORDER BY e.score DESC, n.sent_at DESC
	          LIMIT 1`
	if err := r.store.DB.GetContext(ctx, puncak, query, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return puncak, nil
}

type PushRepository struct {
	store *Store
}

func NewPushRepository(store *Store) *PushRepository {
	return &PushRepository{store: store}
}

func (r *PushRepository) Simpan(ctx context.Context, langganan *model.PushSubscription) error {
	query := `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
	          VALUES ($1, $2, $3, $4)
	          ON CONFLICT (user_id, endpoint)
	          DO UPDATE SET p256dh_key = EXCLUDED.p256dh_key, auth_key = EXCLUDED.auth_key
	          RETURNING id, user_id, endpoint, p256dh_key, auth_key, created_at`
	return r.store.DB.GetContext(ctx, langganan, query,
		langganan.UserID, langganan.Endpoint, langganan.P256dhKey, langganan.AuthKey)
}

func (r *PushRepository) UntukUser(ctx context.Context, userID string) ([]model.PushSubscription, error) {
	daftar := []model.PushSubscription{}
	query := `SELECT id, user_id, endpoint, p256dh_key, auth_key, created_at
	          FROM push_subscriptions
	          WHERE user_id = $1
	          ORDER BY created_at`
	if err := r.store.DB.SelectContext(ctx, &daftar, query, userID); err != nil {
		return nil, err
	}
	return daftar, nil
}

func (r *PushRepository) Hapus(ctx context.Context, userID, endpoint string) error {
	query := `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`
	hasil, err := r.store.DB.ExecContext(ctx, query, userID, endpoint)
	if err != nil {
		return err
	}

	terhapus, err := hasil.RowsAffected()
	if err != nil {
		return err
	}
	if terhapus == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PushRepository) HapusEndpoint(ctx context.Context, endpoint string) error {
	_, err := r.store.DB.ExecContext(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}
