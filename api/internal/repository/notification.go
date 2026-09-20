package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type NotificationRepository struct {
	store *Store
}

func NewNotificationRepository(store *Store) *NotificationRepository {
	return &NotificationRepository{store: store}
}

func (r *NotificationRepository) PenerimaTicker(ctx context.Context, ticker string) ([]string, error) {
	penerima := []string{}
	query := `SELECT DISTINCT user_id::text
	          FROM watchlist_items
	          WHERE ticker = $1`
	if err := r.store.DB.SelectContext(ctx, &penerima, query, ticker); err != nil {
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

func (r *NotificationRepository) Riwayat(ctx context.Context, userID string, limit int) ([]model.Notification, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	daftar := []model.Notification{}
	query := `SELECT n.id, n.user_id, n.insight_event_id, n.sent_at, n.read_at,
	                 e.ticker, e.insight_type, e.subtype, e.score::float8 AS score, e.generated_at
	          FROM notifications n
	          JOIN insight_events e ON e.id = n.insight_event_id
	          WHERE n.user_id = $1
	          ORDER BY n.sent_at DESC, n.id DESC
	          LIMIT $2`
	if err := r.store.DB.SelectContext(ctx, &daftar, query, userID, limit); err != nil {
		return nil, err
	}
	return daftar, nil
}

func (r *NotificationRepository) TandaiDibaca(ctx context.Context, userID, id string) (*model.Notification, error) {
	notifikasi := &model.Notification{}
	query := `UPDATE notifications
	          SET read_at = COALESCE(read_at, now())
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

func (r *NotificationRepository) BelumDibaca(ctx context.Context, userID string) (int, error) {
	var jumlah int
	query := `SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`
	if err := r.store.DB.GetContext(ctx, &jumlah, query, userID); err != nil {
		return 0, err
	}
	return jumlah, nil
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
