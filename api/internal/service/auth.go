package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	ErrInvalidCredentials = errors.New("service: email atau password salah")
	ErrEmailTaken         = errors.New("service: email sudah terdaftar")
	ErrAccountInactive    = errors.New("service: akun tidak aktif")
	ErrInvalidToken       = errors.New("service: token tidak valid atau sudah kedaluwarsa")
)

type AccountLockedError struct {
	Until time.Time
}

func (e *AccountLockedError) Error() string {
	return fmt.Sprintf("service: akun terkunci sampai %s", e.Until.Format(time.RFC3339))
}

type RequestContext struct {
	IPAddress string
	UserAgent string
}

type TokenPair struct {
	AccessToken     string
	AccessExpiresAt time.Time
	RefreshToken    string
	RefreshExpires  time.Time
}

type AuthResult struct {
	User   *model.User
	Tokens TokenPair
}

type RegisterInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type AuthService struct {
	cfg    *config.Config
	users  *repository.UserRepository
	tokens *repository.TokenRepository
	audit  *repository.AuditRepository
	signer *crypto.TokenSigner
	mailer *Mailer
}

func NewAuthService(
	cfg *config.Config,
	users *repository.UserRepository,
	tokens *repository.TokenRepository,
	audit *repository.AuditRepository,
	signer *crypto.TokenSigner,
	mailer *Mailer,
) *AuthService {
	return &AuthService{cfg: cfg, users: users, tokens: tokens, audit: audit, signer: signer, mailer: mailer}
}

func (s *AuthService) Register(ctx context.Context, input RegisterInput, rc RequestContext) (*model.User, string, error) {
	email := normalizeEmail(input.Email)

	v := newValidationError()
	validateEmail(v, email)
	validatePassword(v, input.Password)
	validateFullName(v, input.FullName)
	if err := v.orNil(); err != nil {
		return nil, "", err
	}

	taken, err := s.users.EmailExists(ctx, email)
	if err != nil {
		return nil, "", err
	}
	if taken {
		return nil, "", ErrEmailTaken
	}

	salt, err := crypto.NewPasswordSalt()
	if err != nil {
		return nil, "", err
	}
	hash, err := crypto.HashPassword(salt, input.Password, s.cfg.BcryptCost)
	if err != nil {
		return nil, "", err
	}

	user, err := s.users.Create(ctx, email, strings.TrimSpace(input.FullName), hash, salt)
	if err != nil {
		return nil, "", err
	}

	verificationToken, err := s.issueEmailVerification(ctx, user)
	if err != nil {
		return nil, "", err
	}

	s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditRegister, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return user, verificationToken, nil
}

func (s *AuthService) Login(ctx context.Context, email, password string, rc RequestContext) (*AuthResult, error) {
	email = normalizeEmail(email)

	user, err := s.users.ByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			s.record(ctx, model.AuditEvent{
				EventType: model.AuditLoginFailed,
				IPAddress: rc.IPAddress,
				UserAgent: rc.UserAgent,
				Metadata:  map[string]any{"email": email, "reason": "user_not_found"},
			})
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if user.IsLocked(time.Now()) {
		s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditLoginLocked, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})
		return nil, &AccountLockedError{Until: *user.LockedUntil}
	}

	if !user.IsActive {
		return nil, ErrAccountInactive
	}

	if err := crypto.VerifyPassword(user.PasswordHash, user.PasswordSalt, password); err != nil {
		attempts, lockedUntil, updateErr := s.users.RegisterFailedLogin(ctx, user.ID, s.cfg.MaxFailedLogins, s.cfg.LockoutDuration)
		if updateErr != nil {
			return nil, updateErr
		}

		s.record(ctx, model.AuditEvent{
			UserID:    &user.ID,
			EventType: model.AuditLoginFailed,
			IPAddress: rc.IPAddress,
			UserAgent: rc.UserAgent,
			Metadata:  map[string]any{"failed_attempts": attempts},
		})

		if lockedUntil != nil && lockedUntil.After(time.Now()) {
			return nil, &AccountLockedError{Until: *lockedUntil}
		}
		return nil, ErrInvalidCredentials
	}

	if err := s.users.RegisterSuccessfulLogin(ctx, user.ID); err != nil {
		return nil, err
	}

	pair, err := s.issueTokenPair(ctx, user, rc)
	if err != nil {
		return nil, err
	}

	s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditLoginSuccess, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	user.FailedLoginAttempts = 0
	user.LockedUntil = nil

	return &AuthResult{User: user, Tokens: pair}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string, rc RequestContext, userID *string) error {
	if refreshToken != "" {
		if err := s.tokens.RevokeRefreshToken(ctx, crypto.HashToken(refreshToken)); err != nil {
			return err
		}
	}
	s.record(ctx, model.AuditEvent{UserID: userID, EventType: model.AuditLogout, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})
	return nil
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string, rc RequestContext) (*AuthResult, error) {
	if refreshToken == "" {
		return nil, ErrInvalidToken
	}

	stored, err := s.tokens.ActiveRefreshToken(ctx, crypto.HashToken(refreshToken))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}

	user, err := s.users.ByID(ctx, stored.UserID)
	if err != nil {
		return nil, ErrInvalidToken
	}
	if !user.IsActive {
		return nil, ErrAccountInactive
	}

	if err := s.tokens.RevokeRefreshToken(ctx, stored.TokenHash); err != nil {
		return nil, err
	}

	pair, err := s.issueTokenPair(ctx, user, rc)
	if err != nil {
		return nil, err
	}

	s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditTokenRefreshed, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return &AuthResult{User: user, Tokens: pair}, nil
}

func (s *AuthService) ForgotPassword(ctx context.Context, email string, rc RequestContext) (string, error) {
	email = normalizeEmail(email)

	user, err := s.users.ByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return "", nil
		}
		return "", err
	}

	token, err := crypto.NewOpaqueToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(s.cfg.PasswordResetTTL)
	if err := s.tokens.CreatePasswordResetToken(ctx, user.ID, crypto.HashToken(token), expiresAt); err != nil {
		return "", err
	}

	s.mailer.SendPasswordReset(user.Email, token)
	s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditPasswordForgot, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return token, nil
}

func (s *AuthService) ResetPassword(ctx context.Context, token, newPassword string, rc RequestContext) error {
	v := newValidationError()
	validatePassword(v, newPassword)
	if err := v.orNil(); err != nil {
		return err
	}

	userID, err := s.tokens.ConsumePasswordResetToken(ctx, crypto.HashToken(token))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrInvalidToken
		}
		return err
	}

	salt, err := crypto.NewPasswordSalt()
	if err != nil {
		return err
	}
	hash, err := crypto.HashPassword(salt, newPassword, s.cfg.BcryptCost)
	if err != nil {
		return err
	}

	if err := s.users.UpdatePassword(ctx, userID, hash, salt); err != nil {
		return err
	}
	if err := s.tokens.RevokeAllRefreshTokens(ctx, userID); err != nil {
		return err
	}

	s.record(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditPasswordReset, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return nil
}

func (s *AuthService) VerifyEmail(ctx context.Context, token string, rc RequestContext) error {
	userID, err := s.tokens.ConsumeEmailVerificationToken(ctx, crypto.HashToken(token))
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return ErrInvalidToken
		}
		return err
	}

	if err := s.users.MarkEmailVerified(ctx, userID); err != nil {
		return err
	}

	s.record(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditEmailVerified, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return nil
}

func (s *AuthService) ResendEmailVerification(ctx context.Context, userID string, rc RequestContext) (string, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return "", err
	}
	if user.EmailVerifiedAt != nil {
		return "", nil
	}

	token, err := s.issueEmailVerification(ctx, user)
	if err != nil {
		return "", err
	}

	s.record(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditEmailResendToken, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return token, nil
}

func (s *AuthService) CurrentUser(ctx context.Context, userID string) (*model.User, error) {
	return s.users.ByID(ctx, userID)
}

func (s *AuthService) issueEmailVerification(ctx context.Context, user *model.User) (string, error) {
	token, err := crypto.NewOpaqueToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(s.cfg.EmailTokenTTL)
	if err := s.tokens.CreateEmailVerificationToken(ctx, user.ID, crypto.HashToken(token), expiresAt); err != nil {
		return "", err
	}

	s.mailer.SendEmailVerification(user.Email, token)

	return token, nil
}

func (s *AuthService) issueTokenPair(ctx context.Context, user *model.User, rc RequestContext) (TokenPair, error) {
	accessToken, accessExpiresAt, err := s.signer.SignAccess(user.ID, user.RoleName, user.Tier, s.cfg.AccessTTL)
	if err != nil {
		return TokenPair{}, err
	}

	refreshToken, err := crypto.NewOpaqueToken()
	if err != nil {
		return TokenPair{}, err
	}

	refreshExpiresAt := time.Now().Add(s.cfg.RefreshTTL)
	if _, err := s.tokens.CreateRefreshToken(ctx, user.ID, crypto.HashToken(refreshToken), deviceLabel(rc.UserAgent), rc.IPAddress, refreshExpiresAt); err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:     accessToken,
		AccessExpiresAt: accessExpiresAt,
		RefreshToken:    refreshToken,
		RefreshExpires:  refreshExpiresAt,
	}, nil
}

func (s *AuthService) record(ctx context.Context, event model.AuditEvent) {
	if err := s.audit.Record(ctx, event); err != nil {
		fmt.Printf("audit: gagal mencatat %s: %v\n", event.EventType, err)
	}
}

func deviceLabel(userAgent string) string {
	if userAgent == "" {
		return "Perangkat tidak dikenal"
	}
	if len(userAgent) > 120 {
		return userAgent[:120]
	}
	return userAgent
}
