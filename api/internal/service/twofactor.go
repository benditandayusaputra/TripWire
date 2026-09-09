package service

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	qrcode "github.com/skip2/go-qrcode"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var (
	ErrTOTPBelumDisiapkan = errors.New("service: TOTP belum disiapkan untuk akun ini")
	ErrTOTPSudahAktif     = errors.New("service: TOTP sudah aktif")
	ErrTOTPBelumAktif     = errors.New("service: TOTP belum aktif")
	ErrKodeTOTPSalah      = errors.New("service: kode verifikasi salah")
	ErrPasswordSalah      = errors.New("service: password salah")
)

const (
	jumlahBackupCode  = 10
	panjangBackupHalf = 5
	abjadBackupCode   = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
)

type TwoFactorService struct {
	cfg    *config.Config
	repo   *repository.TwoFactorRepository
	users  *repository.UserRepository
	audit  *repository.AuditRepository
	cipher *crypto.Cipher
}

func NewTwoFactorService(
	cfg *config.Config,
	repo *repository.TwoFactorRepository,
	users *repository.UserRepository,
	audit *repository.AuditRepository,
	cipher *crypto.Cipher,
) *TwoFactorService {
	return &TwoFactorService{cfg: cfg, repo: repo, users: users, audit: audit, cipher: cipher}
}

func (s *TwoFactorService) Status(ctx context.Context, userID string) (*model.TOTPStatus, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}

	sisa, err := s.repo.SisaBackupCode(ctx, userID)
	if err != nil {
		return nil, err
	}

	jumlahCredential := 0
	if s.cfg.EnableWebAuthn {
		if jumlah, err := s.repo.JumlahCredential(ctx, userID); err == nil {
			jumlahCredential = jumlah
		}
	}

	return &model.TOTPStatus{
		Enabled:            user.TOTPEnabled,
		PendingSetup:       user.TOTPSecret != nil && !user.TOTPEnabled,
		BackupCodesLeft:    sisa,
		WebAuthnEnabled:    s.cfg.EnableWebAuthn,
		WebAuthnCredential: jumlahCredential,
	}, nil
}

func (s *TwoFactorService) Setup(ctx context.Context, userID string, rc RequestContext) (*model.TOTPSetup, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}
	if user.TOTPEnabled {
		return nil, ErrTOTPSudahAktif
	}

	kunci, err := totp.Generate(totp.GenerateOpts{
		Issuer:      s.cfg.TOTPIssuer,
		AccountName: user.Email,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
	if err != nil {
		return nil, err
	}

	terenkripsi, err := s.cipher.Encrypt(kunci.Secret())
	if err != nil {
		return nil, err
	}
	if err := s.repo.SimpanRahasia(ctx, userID, terenkripsi); err != nil {
		return nil, err
	}

	png, err := qrcode.Encode(kunci.URL(), qrcode.Medium, 320)
	if err != nil {
		return nil, err
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditTOTPSetup, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return &model.TOTPSetup{
		Secret:     kunci.Secret(),
		OTPAuthURL: kunci.URL(),
		QRCode:     "data:image/png;base64," + base64.StdEncoding.EncodeToString(png),
		Issuer:     s.cfg.TOTPIssuer,
		Account:    user.Email,
	}, nil
}

func (s *TwoFactorService) Verify(ctx context.Context, userID, kode string, rc RequestContext) ([]string, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}
	if user.TOTPEnabled {
		return nil, ErrTOTPSudahAktif
	}
	if user.TOTPSecret == nil {
		return nil, ErrTOTPBelumDisiapkan
	}

	rahasia, err := s.cipher.Decrypt(*user.TOTPSecret)
	if err != nil {
		return nil, err
	}

	if !totp.Validate(bersihkanKode(kode), rahasia) {
		s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditTOTPFailed, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})
		return nil, ErrKodeTOTPSalah
	}

	if err := s.repo.AktifkanTOTP(ctx, userID); err != nil {
		return nil, translate(err)
	}

	kodeCadangan, err := s.regenerateBackupCodes(ctx, userID)
	if err != nil {
		return nil, err
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditTOTPEnabled, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return kodeCadangan, nil
}

func (s *TwoFactorService) Disable(ctx context.Context, userID, password string, rc RequestContext) error {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return translate(err)
	}
	if !user.TOTPEnabled {
		return ErrTOTPBelumAktif
	}

	if err := crypto.VerifyPassword(user.PasswordHash, user.PasswordSalt, password); err != nil {
		return ErrPasswordSalah
	}

	if err := s.repo.MatikanTOTP(ctx, userID); err != nil {
		return err
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditTOTPDisabled, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return nil
}

func (s *TwoFactorService) RegenerateBackupCodes(ctx context.Context, userID string, rc RequestContext) ([]string, error) {
	user, err := s.users.ByID(ctx, userID)
	if err != nil {
		return nil, translate(err)
	}
	if !user.TOTPEnabled {
		return nil, ErrTOTPBelumAktif
	}

	kode, err := s.regenerateBackupCodes(ctx, userID)
	if err != nil {
		return nil, err
	}

	s.catat(ctx, model.AuditEvent{UserID: &userID, EventType: model.AuditBackupRegenerate, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})

	return kode, nil
}

func (s *TwoFactorService) PeriksaSaatLogin(ctx context.Context, user *model.User, kode string, rc RequestContext) error {
	if !user.TOTPEnabled {
		return nil
	}

	bersih := bersihkanKode(kode)
	if bersih == "" {
		return ErrKodeTOTPSalah
	}

	if user.TOTPSecret != nil && len(bersih) == 6 {
		rahasia, err := s.cipher.Decrypt(*user.TOTPSecret)
		if err == nil && totp.Validate(bersih, rahasia) {
			return nil
		}
	}

	if err := s.repo.PakaiBackupCode(ctx, user.ID, crypto.HashToken(bersih)); err == nil {
		s.catat(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditBackupCodeUsed, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})
		return nil
	}

	s.catat(ctx, model.AuditEvent{UserID: &user.ID, EventType: model.AuditTOTPFailed, IPAddress: rc.IPAddress, UserAgent: rc.UserAgent})
	return ErrKodeTOTPSalah
}

func (s *TwoFactorService) regenerateBackupCodes(ctx context.Context, userID string) ([]string, error) {
	kode := make([]string, 0, jumlahBackupCode)
	hashes := make([]string, 0, jumlahBackupCode)

	for len(kode) < jumlahBackupCode {
		mentah, err := kodeAcak(panjangBackupHalf * 2)
		if err != nil {
			return nil, err
		}
		tampil := mentah[:panjangBackupHalf] + "-" + mentah[panjangBackupHalf:]
		kode = append(kode, tampil)
		hashes = append(hashes, crypto.HashToken(bersihkanKode(tampil)))
	}

	if err := s.repo.GantiBackupCodes(ctx, userID, hashes); err != nil {
		return nil, err
	}

	return kode, nil
}

func kodeAcak(panjang int) (string, error) {
	buf := make([]byte, panjang)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("service: generate backup code: %w", err)
	}

	var hasil bytes.Buffer
	for _, b := range buf {
		hasil.WriteByte(abjadBackupCode[int(b)%len(abjadBackupCode)])
	}

	return hasil.String(), nil
}

func bersihkanKode(kode string) string {
	pengganti := strings.NewReplacer(" ", "", "-", "", ".", "")
	return strings.ToUpper(pengganti.Replace(strings.TrimSpace(kode)))
}

func (s *TwoFactorService) catat(ctx context.Context, event model.AuditEvent) {
	if err := s.audit.Record(ctx, event); err != nil {
		fmt.Printf("audit: gagal mencatat %s: %v\n", event.EventType, err)
	}
}
