package service

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	localeDiizinkan = []string{"id", "en"}
	temaDiizinkan   = []string{"dark", "light", "system"}
)

type ProfileUpdate struct {
	FullName        *string `json:"full_name"`
	PhoneNumber     *string `json:"phone_number"`
	Bio             *string `json:"bio"`
	Locale          *string `json:"locale"`
	ThemePreference *string `json:"theme_preference"`
	Timezone        *string `json:"timezone"`
}

type Session struct {
	model.RefreshToken
	Current bool `json:"current"`
}

type AccountService struct {
	users  *repository.UserRepository
	tokens *repository.TokenRepository
	audit  *repository.AuditRepository
	files  *FileService
}

func NewAccountService(
	users *repository.UserRepository,
	tokens *repository.TokenRepository,
	audit *repository.AuditRepository,
	files *FileService,
) *AccountService {
	return &AccountService{users: users, tokens: tokens, audit: audit, files: files}
}

func (s *AccountService) Profile(ctx context.Context, userID string) (*model.User, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}
	return s.lengkapi(user), nil
}

func (s *AccountService) UpdateProfile(ctx context.Context, userID string, input ProfileUpdate) (*model.User, error) {
	v := newValidationError()

	if input.FullName != nil {
		validateFullName(v, *input.FullName)
		dirapikan := strings.TrimSpace(*input.FullName)
		input.FullName = &dirapikan
	}

	if input.Locale != nil && !slices.Contains(localeDiizinkan, *input.Locale) {
		v.add("locale", "Bahasa yang tersedia hanya id atau en")
	}

	if input.ThemePreference != nil && !slices.Contains(temaDiizinkan, *input.ThemePreference) {
		v.add("theme_preference", "Tema yang tersedia hanya dark, light, atau system")
	}

	if input.PhoneNumber != nil {
		nomor := strings.TrimSpace(*input.PhoneNumber)
		if nomor != "" && (len(nomor) < 8 || len(nomor) > 20) {
			v.add("phone_number", "Nomor telepon antara 8 sampai 20 karakter")
		}
		input.PhoneNumber = &nomor
	}

	if input.Bio != nil {
		bio := strings.TrimSpace(*input.Bio)
		if len(bio) > 400 {
			v.add("bio", "Bio maksimal 400 karakter")
		}
		input.Bio = &bio
	}

	if input.Timezone != nil {
		zona := strings.TrimSpace(*input.Timezone)
		if zona == "" || len(zona) > 64 {
			v.add("timezone", "Zona waktu tidak valid")
		}
		input.Timezone = &zona
	}

	if err := v.orNil(); err != nil {
		return nil, err
	}

	user, err := s.users.UpdateProfile(ctx, userID, repository.ProfileInput{
		FullName:        input.FullName,
		PhoneNumber:     input.PhoneNumber,
		Bio:             input.Bio,
		Locale:          input.Locale,
		ThemePreference: input.ThemePreference,
		Timezone:        input.Timezone,
	})
	if err != nil {
		return nil, translate(err)
	}

	return s.lengkapi(user), nil
}

func (s *AccountService) Sessions(ctx context.Context, userID, refreshToken string) ([]Session, error) {
	baris, err := s.tokens.ActiveSessions(ctx, userID)
	if err != nil {
		return nil, err
	}

	hashSaatIni := ""
	if refreshToken != "" {
		hashSaatIni = crypto.HashToken(refreshToken)
	}

	sesi := make([]Session, 0, len(baris))
	for _, item := range baris {
		sesi = append(sesi, Session{RefreshToken: item, Current: item.TokenHash != "" && item.TokenHash == hashSaatIni})
	}

	return sesi, nil
}

func (s *AccountService) RevokeSession(ctx context.Context, userID, sessionID string, rc RequestContext) error {
	if err := s.tokens.RevokeSessionByID(ctx, userID, sessionID); err != nil {
		return translate(err)
	}

	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditSessionRevoked,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
		Metadata:  map[string]any{"session_id": sessionID},
	})

	return nil
}

func (s *AccountService) RevokeOtherSessions(ctx context.Context, userID, refreshToken string, rc RequestContext) (int64, error) {
	hash := ""
	if refreshToken != "" {
		hash = crypto.HashToken(refreshToken)
	}

	jumlah, err := s.tokens.RevokeOtherSessions(ctx, userID, hash)
	if err != nil {
		return 0, err
	}

	s.catat(ctx, model.AuditEvent{
		UserID:    &userID,
		EventType: model.AuditSessionRevokedAll,
		IPAddress: rc.IPAddress,
		UserAgent: rc.UserAgent,
		Metadata:  map[string]any{"dicabut": jumlah},
	})

	return jumlah, nil
}

func (s *AccountService) lengkapi(user *model.User) *model.User {
	if user != nil && s.files != nil && user.AvatarFileID != nil {
		user.AvatarURL = s.files.SignedURL(*user.AvatarFileID)
	}
	return user
}

func (s *AccountService) catat(ctx context.Context, event model.AuditEvent) {
	if err := s.audit.Record(ctx, event); err != nil {
		fmt.Printf("audit: gagal mencatat %s: %v\n", event.EventType, err)
	}
}
