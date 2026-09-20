package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

var ErrNotFound = errors.New("repository: data tidak ditemukan")

const userColumns = `u.id, u.email, u.email_verified_at, u.password_hash, u.password_salt,
	u.role_id, r.name AS role_name, u.tier, u.is_active, u.totp_secret, u.totp_enabled,
	u.failed_login_attempts, u.locked_until, u.full_name, u.phone_number, u.bio,
	u.locale, u.theme_preference, u.timezone, u.avatar_file_id, u.last_login_at,
	u.created_at, u.updated_at`

type UserRepository struct {
	store *Store
}

func NewUserRepository(store *Store) *UserRepository {
	return &UserRepository{store: store}
}

func (r *UserRepository) Create(ctx context.Context, email, fullName, passwordHash, passwordSalt string) (*model.User, error) {
	var id string
	query := `INSERT INTO users (email, full_name, password_hash, password_salt)
	          VALUES ($1, $2, $3, $4)
	          RETURNING id`
	if err := r.store.DB.GetContext(ctx, &id, query, email, fullName, passwordHash, passwordSalt); err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *UserRepository) ByID(ctx context.Context, id string) (*model.User, error) {
	return r.one(ctx, `SELECT `+userColumns+` FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, id)
}

func (r *UserRepository) ByEmail(ctx context.Context, email string) (*model.User, error) {
	return r.one(ctx, `SELECT `+userColumns+` FROM users u JOIN roles r ON r.id = u.role_id WHERE lower(u.email) = lower($1)`, email)
}

func (r *UserRepository) one(ctx context.Context, query string, args ...any) (*model.User, error) {
	user := &model.User{}
	if err := r.store.DB.GetContext(ctx, user, query, args...); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS (SELECT 1 FROM users WHERE lower(email) = lower($1))`
	if err := r.store.DB.GetContext(ctx, &exists, query, email); err != nil {
		return false, err
	}
	return exists, nil
}

func (r *UserRepository) RegisterFailedLogin(ctx context.Context, userID string, maxAttempts int, lockFor time.Duration) (int16, *time.Time, error) {
	var attempts int16
	var lockedUntil *time.Time

	query := `UPDATE users
	          SET failed_login_attempts = failed_login_attempts + 1,
	              locked_until = CASE
	                  WHEN failed_login_attempts + 1 >= $2 THEN now() + $3::interval
	                  ELSE locked_until
	              END
	          WHERE id = $1
	          RETURNING failed_login_attempts, locked_until`

	row := r.store.DB.QueryRowxContext(ctx, query, userID, maxAttempts, lockFor.String())
	if err := row.Scan(&attempts, &lockedUntil); err != nil {
		return 0, nil, err
	}

	return attempts, lockedUntil, nil
}

func (r *UserRepository) RegisterSuccessfulLogin(ctx context.Context, userID string) error {
	query := `UPDATE users
	          SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now()
	          WHERE id = $1`
	_, err := r.store.DB.ExecContext(ctx, query, userID)
	return err
}

func (r *UserRepository) MarkEmailVerified(ctx context.Context, userID string) error {
	query := `UPDATE users SET email_verified_at = now() WHERE id = $1 AND email_verified_at IS NULL`
	_, err := r.store.DB.ExecContext(ctx, query, userID)
	return err
}

func (r *UserRepository) UpdatePassword(ctx context.Context, userID, passwordHash, passwordSalt string) error {
	query := `UPDATE users
	          SET password_hash = $2, password_salt = $3, failed_login_attempts = 0, locked_until = NULL
	          WHERE id = $1`
	_, err := r.store.DB.ExecContext(ctx, query, userID, passwordHash, passwordSalt)
	return err
}
