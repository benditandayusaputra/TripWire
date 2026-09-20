package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	ErrBerkasTerlaluBesar = errors.New("service: ukuran berkas melebihi batas")
	ErrTipeTidakDiizinkan = errors.New("service: tipe berkas tidak diizinkan")
	ErrBerkasRusak        = errors.New("service: isi berkas tidak cocok dengan tipe yang diklaim")
	ErrTautanTidakValid   = errors.New("service: tautan berkas tidak valid")
	ErrTautanKedaluwarsa  = errors.New("service: tautan berkas sudah kedaluwarsa")
)

var mimeAvatar = []string{"image/jpeg", "image/png"}

var mimeLampiran = []string{"image/jpeg", "image/png", "image/webp", "application/pdf", "text/csv"}

type FileService struct {
	cfg    *config.Config
	repo   *repository.FileRepository
	audit  *repository.AuditRepository
	signer *crypto.URLSigner
}

func NewFileService(
	cfg *config.Config,
	repo *repository.FileRepository,
	audit *repository.AuditRepository,
	signer *crypto.URLSigner,
) *FileService {
	return &FileService{cfg: cfg, repo: repo, audit: audit, signer: signer}
}

func (s *FileService) SignedURL(fileID string) string {
	if fileID == "" {
		return ""
	}
	return s.cfg.APIPublicURL + s.signer.Path(fileID, s.cfg.SignedURLTTL)
}

func (s *FileService) Upload(
	ctx context.Context,
	userID, purpose string,
	header *multipart.FileHeader,
	rc RequestContext,
) (*model.File, error) {
	if !slices.Contains(model.Purposes, purpose) {
		v := newValidationError()
		v.add("purpose", "Peruntukan berkas tidak dikenal")
		return nil, v
	}

	batas := s.cfg.MaxUploadBytes
	if purpose == model.PurposeAvatar {
		batas = s.cfg.MaxAvatarBytes
	}

	if header.Size <= 0 || header.Size > batas {
		return nil, ErrBerkasTerlaluBesar
	}

	sumber, err := header.Open()
	if err != nil {
		return nil, err
	}
	defer sumber.Close()

	isi, err := io.ReadAll(io.LimitReader(sumber, batas+1))
	if err != nil {
		return nil, err
	}
	if int64(len(isi)) > batas {
		return nil, ErrBerkasTerlaluBesar
	}

	terdeteksi := jenisTerdeteksi(isi)
	diizinkan := mimeLampiran
	if purpose == model.PurposeAvatar {
		diizinkan = mimeAvatar
	}

	if !slices.Contains(diizinkan, terdeteksi) {
		return nil, ErrTipeTidakDiizinkan
	}

	diklaim := normalkanMime(header.Header.Get("Content-Type"))
	if diklaim != "" && diklaim != terdeteksi {
		return nil, ErrBerkasRusak
	}

	storageKey, err := s.simpanKeStorage(userID, terdeteksi, isi)
	if err != nil {
		return nil, err
	}

	berkas, err := s.repo.Create(ctx, &model.File{
		OwnerUserID:      userID,
		Purpose:          purpose,
		OriginalFilename: namaAman(header.Filename),
		StorageKey:       storageKey,
		MimeType:         terdeteksi,
		SizeBytes:        int64(len(isi)),
		ChecksumSHA256:   crypto.ChecksumSHA256(isi),
	})
	if err != nil {
		os.Remove(filepath.Join(s.cfg.StorageDir, storageKey))
		return nil, err
	}

	berkas.URL = s.SignedURL(berkas.ID)
	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditFileUploaded,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
		Metadata:  map[string]any{"file_id": berkas.ID, "purpose": purpose, "size_bytes": berkas.SizeBytes},
	})

	return berkas, nil
}

func (s *FileService) SetAvatar(ctx context.Context, userID string, header *multipart.FileHeader, rc RequestContext) (*model.File, error) {
	berkas, err := s.Upload(ctx, userID, model.PurposeAvatar, header, rc)
	if err != nil {
		return nil, err
	}

	sebelumnya, err := s.repo.SetAvatar(ctx, userID, &berkas.ID)
	if err != nil {
		return nil, err
	}

	if sebelumnya != nil && *sebelumnya != "" {
		_ = s.repo.SoftDelete(ctx, userID, *sebelumnya)
	}

	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditAvatarSet,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
		Metadata:  map[string]any{"file_id": berkas.ID},
	})

	return berkas, nil
}

func (s *FileService) HapusAvatar(ctx context.Context, userID string, rc RequestContext) error {
	sebelumnya, err := s.repo.SetAvatar(ctx, userID, nil)
	if err != nil {
		return err
	}
	if sebelumnya == nil || *sebelumnya == "" {
		return ErrTidakDitemukan
	}

	if err := s.repo.SoftDelete(ctx, userID, *sebelumnya); err != nil {
		return translate(err)
	}

	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditAvatarClear,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
	})

	return nil
}

func (s *FileService) Hapus(ctx context.Context, userID, fileID string, rc RequestContext) error {
	if err := s.repo.SoftDelete(ctx, userID, fileID); err != nil {
		return translate(err)
	}

	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditFileDeleted,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
		Metadata:  map[string]any{"file_id": fileID},
	})

	return nil
}

func (s *FileService) Ambil(ctx context.Context, fileID, expires, signature string) (*model.File, []byte, error) {
	if err := s.signer.Verify(fileID, expires, signature, time.Now()); err != nil {
		if errors.Is(err, crypto.ErrSignedURLKedaluwarsa) {
			return nil, nil, ErrTautanKedaluwarsa
		}
		return nil, nil, ErrTautanTidakValid
	}

	berkas, err := s.repo.ByID(ctx, fileID)
	if err != nil {
		return nil, nil, translate(err)
	}

	isi, err := os.ReadFile(filepath.Join(s.cfg.StorageDir, berkas.StorageKey))
	if err != nil {
		return nil, nil, ErrTidakDitemukan
	}

	if crypto.ChecksumSHA256(isi) != berkas.ChecksumSHA256 {
		return nil, nil, ErrBerkasRusak
	}

	return berkas, isi, nil
}

func (s *FileService) simpanKeStorage(userID, mime string, isi []byte) (string, error) {
	id, err := uuid.NewV7()
	if err != nil {
		return "", err
	}

	storageKey := filepath.Join(userID, id.String()+ekstensi(mime))
	tujuan := filepath.Join(s.cfg.StorageDir, storageKey)

	if err := os.MkdirAll(filepath.Dir(tujuan), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(tujuan, isi, 0o600); err != nil {
		return "", err
	}

	return storageKey, nil
}

func jenisTerdeteksi(isi []byte) string {
	batas := min(len(isi), 512)
	return normalkanMime(http.DetectContentType(isi[:batas]))
}

func normalkanMime(nilai string) string {
	tipe, _, _ := strings.Cut(nilai, ";")
	return strings.ToLower(strings.TrimSpace(tipe))
}

func ekstensi(mime string) string {
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "application/pdf":
		return ".pdf"
	case "text/csv":
		return ".csv"
	default:
		return ".bin"
	}
}

func namaAman(nama string) string {
	bersih := filepath.Base(strings.TrimSpace(nama))
	if bersih == "." || bersih == string(filepath.Separator) || bersih == "" {
		return "berkas"
	}
	if len(bersih) > 120 {
		bersih = bersih[:120]
	}
	return bersih
}

func (s *FileService) catat(ctx context.Context, event model.AuditEvent) {
	if err := s.audit.Record(ctx, event); err != nil {
		fmt.Printf("audit: gagal mencatat %s: %v\n", event.EventType, err)
	}
}
