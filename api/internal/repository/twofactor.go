package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type TwoFactorRepository struct {
	store *Store
}

func NewTwoFactorRepository(store *Store) *TwoFactorRepository {
	return &TwoFactorRepository{store: store}
}

func (r *TwoFactorRepository) SimpanRahasia(ctx context.Context, userID, terenkripsi string) error {
	query := `UPDATE users SET totp_secret = $2, totp_enabled = false WHERE id = $1`
	_, err := r.store.DB.ExecContext(ctx, query, userID, terenkripsi)
	return err
}

func (r *TwoFactorRepository) AktifkanTOTP(ctx context.Context, userID string) error {
	query := `UPDATE users SET totp_enabled = true WHERE id = $1 AND totp_secret IS NOT NULL`
	hasil, err := r.store.DB.ExecContext(ctx, query, userID)
	if err != nil {
		return err
	}
	if terpengaruh, _ := hasil.RowsAffected(); terpengaruh == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TwoFactorRepository) MatikanTOTP(ctx context.Context, userID string) error {
	tx, err := r.store.DB.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx,
		`UPDATE users SET totp_secret = NULL, totp_enabled = false WHERE id = $1`, userID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`DELETE FROM totp_backup_codes WHERE user_id = $1`, userID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *TwoFactorRepository) GantiBackupCodes(ctx context.Context, userID string, hashes []string) error {
	tx, err := r.store.DB.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM totp_backup_codes WHERE user_id = $1`, userID); err != nil {
		return err
	}

	for _, hash := range hashes {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO totp_backup_codes (user_id, code_hash) VALUES ($1, $2)`, userID, hash); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *TwoFactorRepository) PakaiBackupCode(ctx context.Context, userID, hash string) error {
	query := `UPDATE totp_backup_codes
	          SET used_at = now()
	          WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL`
	hasil, err := r.store.DB.ExecContext(ctx, query, userID, hash)
	if err != nil {
		return err
	}
	if terpengaruh, _ := hasil.RowsAffected(); terpengaruh == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TwoFactorRepository) SisaBackupCode(ctx context.Context, userID string) (int, error) {
	var sisa int
	query := `SELECT count(*) FROM totp_backup_codes WHERE user_id = $1 AND used_at IS NULL`
	err := r.store.DB.GetContext(ctx, &sisa, query, userID)
	return sisa, err
}

func (r *TwoFactorRepository) SimpanCredential(ctx context.Context, cred *model.WebAuthnCredential) error {
	query := `INSERT INTO webauthn_credentials
	          (user_id, credential_id, public_key, sign_count, transports, device_label)
	          VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''))`
	label := ""
	if cred.DeviceLabel != nil {
		label = *cred.DeviceLabel
	}
	_, err := r.store.DB.ExecContext(ctx, query,
		cred.UserID, cred.CredentialID, cred.PublicKey, cred.SignCount, pq.Array(cred.Transports), label)
	return err
}

func (r *TwoFactorRepository) DaftarCredential(ctx context.Context, userID string) ([]model.WebAuthnCredential, error) {
	baris := []model.WebAuthnCredential{}
	query := `SELECT id, user_id, credential_id, public_key, sign_count,
	                 coalesce(transports, '{}') AS transports, device_label, created_at, last_used_at
	          FROM webauthn_credentials
	          WHERE user_id = $1
	          ORDER BY created_at DESC`

	rows, err := r.store.DB.QueryxContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var cred model.WebAuthnCredential
		var transports pq.StringArray
		if err := rows.Scan(&cred.ID, &cred.UserID, &cred.CredentialID, &cred.PublicKey,
			&cred.SignCount, &transports, &cred.DeviceLabel, &cred.CreatedAt, &cred.LastUsedAt); err != nil {
			return nil, err
		}
		cred.Transports = transports
		baris = append(baris, cred)
	}

	return baris, rows.Err()
}

func (r *TwoFactorRepository) HapusCredential(ctx context.Context, userID, id string) error {
	query := `DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2`
	hasil, err := r.store.DB.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}
	if terpengaruh, _ := hasil.RowsAffected(); terpengaruh == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TwoFactorRepository) JumlahCredential(ctx context.Context, userID string) (int, error) {
	var jumlah int
	query := `SELECT count(*) FROM webauthn_credentials WHERE user_id = $1`
	err := r.store.DB.GetContext(ctx, &jumlah, query, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return jumlah, err
}
