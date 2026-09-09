package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type TokenRepository struct {
	store *Store
}

func NewTokenRepository(store *Store) *TokenRepository {
	return &TokenRepository{store: store}
}

func (r *TokenRepository) CreateRefreshToken(ctx context.Context, userID, tokenHash, deviceLabel, ipAddress string, expiresAt time.Time) (string, error) {
	var id string
	query := `INSERT INTO refresh_tokens (user_id, token_hash, device_label, ip_address, expires_at)
	          VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, '')::inet, $5)
	          RETURNING id`
	err := r.store.DB.GetContext(ctx, &id, query, userID, tokenHash, deviceLabel, ipAddress, expiresAt)
	return id, err
}

func (r *TokenRepository) ActiveRefreshToken(ctx context.Context, tokenHash string) (*model.RefreshToken, error) {
	token := &model.RefreshToken{}
	query := `SELECT id, user_id, token_hash, device_label, host(ip_address) AS ip_address,
	                 issued_at, expires_at, revoked_at, last_used_at
	          FROM refresh_tokens
	          WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`
	if err := r.store.DB.GetContext(ctx, token, query, tokenHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return token, nil
}

func (r *TokenRepository) TouchRefreshToken(ctx context.Context, id string) error {
	_, err := r.store.DB.ExecContext(ctx, `UPDATE refresh_tokens SET last_used_at = now() WHERE id = $1`, id)
	return err
}

func (r *TokenRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	query := `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`
	_, err := r.store.DB.ExecContext(ctx, query, tokenHash)
	return err
}

func (r *TokenRepository) RevokeAllRefreshTokens(ctx context.Context, userID string) error {
	query := `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`
	_, err := r.store.DB.ExecContext(ctx, query, userID)
	return err
}

func (r *TokenRepository) CreateEmailVerificationToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	query := `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := r.store.DB.ExecContext(ctx, query, userID, tokenHash, expiresAt)
	return err
}

func (r *TokenRepository) ConsumeEmailVerificationToken(ctx context.Context, tokenHash string) (string, error) {
	var userID string
	query := `UPDATE email_verification_tokens
	          SET used_at = now()
	          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
	          RETURNING user_id`
	if err := r.store.DB.GetContext(ctx, &userID, query, tokenHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return userID, nil
}

func (r *TokenRepository) CreatePasswordResetToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {
	query := `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`
	_, err := r.store.DB.ExecContext(ctx, query, userID, tokenHash, expiresAt)
	return err
}

func (r *TokenRepository) ConsumePasswordResetToken(ctx context.Context, tokenHash string) (string, error) {
	var userID string
	query := `UPDATE password_reset_tokens
	          SET used_at = now()
	          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
	          RETURNING user_id`
	if err := r.store.DB.GetContext(ctx, &userID, query, tokenHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return userID, nil
}

func (r *TokenRepository) ActiveSessions(ctx context.Context, userID string) ([]model.RefreshToken, error) {
	sesi := []model.RefreshToken{}
	query := `SELECT id, user_id, token_hash, device_label, host(ip_address) AS ip_address,
	                 issued_at, expires_at, revoked_at, last_used_at
	          FROM refresh_tokens
	          WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
	          ORDER BY coalesce(last_used_at, issued_at) DESC`
	if err := r.store.DB.SelectContext(ctx, &sesi, query, userID); err != nil {
		return nil, err
	}
	return sesi, nil
}

func (r *TokenRepository) RevokeSessionByID(ctx context.Context, userID, id string) error {
	query := `UPDATE refresh_tokens SET revoked_at = now()
	          WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`
	hasil, err := r.store.DB.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}
	if terpengaruh, _ := hasil.RowsAffected(); terpengaruh == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TokenRepository) RevokeOtherSessions(ctx context.Context, userID, tokenHash string) (int64, error) {
	query := `UPDATE refresh_tokens SET revoked_at = now()
	          WHERE user_id = $1 AND revoked_at IS NULL AND token_hash <> $2`
	hasil, err := r.store.DB.ExecContext(ctx, query, userID, tokenHash)
	if err != nil {
		return 0, err
	}
	terpengaruh, _ := hasil.RowsAffected()
	return terpengaruh, nil
}
