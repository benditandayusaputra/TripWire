package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	ErrWebAuthnNonaktif = errors.New("service: WebAuthn dimatikan lewat feature flag")
	ErrChallengeHabis   = errors.New("service: challenge WebAuthn tidak ditemukan atau sudah kedaluwarsa")
)

const challengeTTL = 5 * time.Minute

type WebAuthnService struct {
	cfg    *config.Config
	repo   *repository.TwoFactorRepository
	users  *repository.UserRepository
	audit  *repository.AuditRepository
	redis  *redis.Client
	engine *webauthn.WebAuthn
}

func NewWebAuthnService(
	cfg *config.Config,
	repo *repository.TwoFactorRepository,
	users *repository.UserRepository,
	audit *repository.AuditRepository,
	client *redis.Client,
) (*WebAuthnService, error) {
	s := &WebAuthnService{cfg: cfg, repo: repo, users: users, audit: audit, redis: client}

	if !cfg.EnableWebAuthn {
		return s, nil
	}

	engine, err := webauthn.New(&webauthn.Config{
		RPDisplayName: cfg.TOTPIssuer,
		RPID:          cfg.WebAuthnRPID,
		RPOrigins:     []string{strings.TrimSuffix(cfg.FrontendURL, "/")},
	})
	if err != nil {
		return nil, err
	}

	s.engine = engine
	return s, nil
}

func (s *WebAuthnService) Aktif() bool {
	return s.cfg.EnableWebAuthn && s.engine != nil
}

func (s *WebAuthnService) RegisterOptions(ctx context.Context, userID string) (any, error) {
	if !s.Aktif() {
		return nil, ErrWebAuthnNonaktif
	}

	pengguna, err := s.muat(ctx, userID)
	if err != nil {
		return nil, err
	}

	opsi, sesi, err := s.engine.BeginRegistration(pengguna)
	if err != nil {
		return nil, err
	}

	if err := s.simpanSesi(ctx, "register", userID, sesi); err != nil {
		return nil, err
	}

	return opsi, nil
}

func (s *WebAuthnService) RegisterVerify(ctx context.Context, userID, label string, badan []byte, rc RequestContext) error {
	if !s.Aktif() {
		return ErrWebAuthnNonaktif
	}

	pengguna, err := s.muat(ctx, userID)
	if err != nil {
		return err
	}

	sesi, err := s.ambilSesi(ctx, "register", userID)
	if err != nil {
		return err
	}

	parsed, err := protocol.ParseCredentialCreationResponseBytes(badan)
	if err != nil {
		return ErrChallengeHabis
	}

	kredensial, err := s.engine.CreateCredential(pengguna, *sesi, parsed)
	if err != nil {
		return ErrChallengeHabis
	}

	simpan := &model.WebAuthnCredential{
		UserID:       userID,
		CredentialID: base64.RawURLEncoding.EncodeToString(kredensial.ID),
		PublicKey:    kredensial.PublicKey,
		SignCount:    int64(kredensial.Authenticator.SignCount),
		Transports:   transportsKe(kredensial.Transport),
	}
	if label != "" {
		simpan.DeviceLabel = &label
	}

	if err := s.repo.SimpanCredential(ctx, simpan); err != nil {
		return err
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditWebAuthnAdded, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return nil
}

func (s *WebAuthnService) LoginOptions(ctx context.Context, email string) (any, error) {
	if !s.Aktif() {
		return nil, ErrWebAuthnNonaktif
	}

	user, err := s.users.ByEmail(ctx, normalizeEmail(email))
	if err != nil {
		return nil, ErrTidakDitemukan
	}

	pengguna, err := s.muat(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	if len(pengguna.WebAuthnCredentials()) == 0 {
		return nil, ErrTidakDitemukan
	}

	opsi, sesi, err := s.engine.BeginLogin(pengguna)
	if err != nil {
		return nil, err
	}

	if err := s.simpanSesi(ctx, "login", user.ID, sesi); err != nil {
		return nil, err
	}

	return opsi, nil
}

func (s *WebAuthnService) Credentials(ctx context.Context, userID string) ([]model.WebAuthnCredential, error) {
	if !s.Aktif() {
		return nil, ErrWebAuthnNonaktif
	}
	return s.repo.DaftarCredential(ctx, userID)
}

func (s *WebAuthnService) HapusCredential(ctx context.Context, userID, id string, rc RequestContext) error {
	if !s.Aktif() {
		return ErrWebAuthnNonaktif
	}

	if err := s.repo.HapusCredential(ctx, userID, id); err != nil {
		return translate(err)
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditWebAuthnRemoved, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return nil
}

type penggunaWebAuthn struct {
	id         string
	email      string
	nama       string
	kredensial []webauthn.Credential
}

func (p *penggunaWebAuthn) WebAuthnID() []byte                         { return []byte(p.id) }
func (p *penggunaWebAuthn) WebAuthnName() string                       { return p.email }
func (p *penggunaWebAuthn) WebAuthnDisplayName() string                { return p.nama }
func (p *penggunaWebAuthn) WebAuthnCredentials() []webauthn.Credential { return p.kredensial }

func (s *WebAuthnService) muat(ctx context.Context, userID string) (*penggunaWebAuthn, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}

	tersimpan, err := s.repo.DaftarCredential(ctx, userID)
	if err != nil {
		return nil, err
	}

	kredensial := make([]webauthn.Credential, 0, len(tersimpan))
	for _, baris := range tersimpan {
		id, err := base64.RawURLEncoding.DecodeString(baris.CredentialID)
		if err != nil {
			continue
		}
		kredensial = append(kredensial, webauthn.Credential{
			ID:        id,
			PublicKey: baris.PublicKey,
			Authenticator: webauthn.Authenticator{
				SignCount: uint32(baris.SignCount),
			},
		})
	}

	return &penggunaWebAuthn{id: user.ID, email: user.Email, nama: user.FullName, kredensial: kredensial}, nil
}

func (s *WebAuthnService) simpanSesi(ctx context.Context, jenis, userID string, sesi *webauthn.SessionData) error {
	mentah, err := json.Marshal(sesi)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, kunciSesi(jenis, userID), mentah, challengeTTL).Err()
}

func (s *WebAuthnService) ambilSesi(ctx context.Context, jenis, userID string) (*webauthn.SessionData, error) {
	mentah, err := s.redis.Get(ctx, kunciSesi(jenis, userID)).Bytes()
	if err != nil {
		return nil, ErrChallengeHabis
	}
	s.redis.Del(ctx, kunciSesi(jenis, userID))

	var sesi webauthn.SessionData
	if err := json.Unmarshal(mentah, &sesi); err != nil {
		return nil, ErrChallengeHabis
	}

	return &sesi, nil
}

func kunciSesi(jenis, userID string) string {
	return fmt.Sprintf("webauthn:%s:%s", jenis, userID)
}

func transportsKe(daftar []protocol.AuthenticatorTransport) []string {
	hasil := make([]string, 0, len(daftar))
	for _, t := range daftar {
		hasil = append(hasil, string(t))
	}
	return hasil
}

func (s *WebAuthnService) catat(ctx context.Context, event model.AuditEvent) {
	if err := s.audit.Record(ctx, event); err != nil {
		fmt.Printf("audit: gagal mencatat %s: %v\n", event.EventType, err)
	}
}
