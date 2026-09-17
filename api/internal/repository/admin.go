package repository

import (
	"context"
	"time"
)

type AdminUser struct {
	ID              string     `db:"id" json:"id"`
	Email           string     `db:"email" json:"email"`
	FullName        string     `db:"full_name" json:"full_name"`
	Role            string     `db:"role_name" json:"role"`
	Tier            string     `db:"tier" json:"tier"`
	IsActive        bool       `db:"is_active" json:"is_active"`
	TOTPEnabled     bool       `db:"totp_enabled" json:"totp_enabled"`
	EmailVerifiedAt *time.Time `db:"email_verified_at" json:"email_verified_at"`
	WatchlistCount  int        `db:"watchlist_count" json:"watchlist_count"`
	LastLoginAt     *time.Time `db:"last_login_at" json:"last_login_at"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}

type AdminRepository struct {
	store *Store
}

func NewAdminRepository(store *Store) *AdminRepository {
	return &AdminRepository{store: store}
}

func (r *AdminRepository) ListUsers(ctx context.Context, limit int) ([]AdminUser, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	baris := []AdminUser{}
	query := `SELECT u.id, u.email, u.full_name, r.name AS role_name, u.tier, u.is_active,
	                 u.totp_enabled, u.email_verified_at, u.last_login_at, u.created_at,
	                 (SELECT count(*) FROM watchlist_items w WHERE w.user_id = u.id) AS watchlist_count
	          FROM users u
	          JOIN roles r ON r.id = u.role_id
	          ORDER BY u.created_at DESC
	          LIMIT $1`
	if err := r.store.DB.SelectContext(ctx, &baris, query, limit); err != nil {
		return nil, err
	}
	return baris, nil
}

type Statistik struct {
	TotalUsers     int `db:"total_users" json:"total_users"`
	TotalWatchlist int `db:"total_watchlist" json:"total_watchlist"`
	TotalInsight   int `db:"total_insight" json:"total_insight"`
	KondisiAktif   int `db:"kondisi_aktif" json:"kondisi_aktif"`
}

func (r *AdminRepository) Statistik(ctx context.Context) (*Statistik, error) {
	stat := &Statistik{}
	query := `SELECT
	              (SELECT count(*) FROM users) AS total_users,
	              (SELECT count(*) FROM watchlist_items) AS total_watchlist,
	              (SELECT count(*) FROM insight_events) AS total_insight,
	              (SELECT count(*) FROM watch_conditions WHERE is_active) AS kondisi_aktif`
	if err := r.store.DB.GetContext(ctx, stat, query); err != nil {
		return nil, err
	}
	return stat, nil
}
