package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

const fileColumns = `id, owner_user_id, purpose, original_filename, storage_key,
	mime_type, size_bytes, checksum_sha256, created_at, deleted_at`

type FileRepository struct {
	store *Store
}

func NewFileRepository(store *Store) *FileRepository {
	return &FileRepository{store: store}
}

func (r *FileRepository) Create(ctx context.Context, berkas *model.File) (*model.File, error) {
	var id string
	query := `INSERT INTO files
	          (owner_user_id, purpose, original_filename, storage_key, mime_type, size_bytes, checksum_sha256)
	          VALUES ($1, $2, $3, $4, $5, $6, $7)
	          RETURNING id`
	err := r.store.DB.GetContext(ctx, &id, query,
		berkas.OwnerUserID, berkas.Purpose, berkas.OriginalFilename,
		berkas.StorageKey, berkas.MimeType, berkas.SizeBytes, berkas.ChecksumSHA256)
	if err != nil {
		return nil, err
	}
	return r.ByID(ctx, id)
}

func (r *FileRepository) ByID(ctx context.Context, id string) (*model.File, error) {
	berkas := &model.File{}
	query := `SELECT ` + fileColumns + ` FROM files WHERE id = $1 AND deleted_at IS NULL`
	if err := r.store.DB.GetContext(ctx, berkas, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return berkas, nil
}

func (r *FileRepository) ByIDForOwner(ctx context.Context, ownerID, id string) (*model.File, error) {
	berkas := &model.File{}
	query := `SELECT ` + fileColumns + `
	          FROM files
	          WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`
	if err := r.store.DB.GetContext(ctx, berkas, query, id, ownerID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return berkas, nil
}

func (r *FileRepository) SoftDelete(ctx context.Context, ownerID, id string) error {
	query := `UPDATE files SET deleted_at = now()
	          WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`
	hasil, err := r.store.DB.ExecContext(ctx, query, id, ownerID)
	if err != nil {
		return err
	}
	if terpengaruh, _ := hasil.RowsAffected(); terpengaruh == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *FileRepository) SetAvatar(ctx context.Context, userID string, fileID *string) (*string, error) {
	var sebelumnya *string

	tx, err := r.store.DB.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := tx.GetContext(ctx, &sebelumnya,
		`SELECT avatar_file_id FROM users WHERE id = $1 FOR UPDATE`, userID); err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `UPDATE users SET avatar_file_id = $2 WHERE id = $1`, userID, fileID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return sebelumnya, nil
}
