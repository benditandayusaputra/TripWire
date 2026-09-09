package crypto

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"
)

var (
	ErrSignedURLInvalid     = errors.New("crypto: signature URL tidak cocok")
	ErrSignedURLKedaluwarsa = errors.New("crypto: tautan sudah kedaluwarsa")
)

type URLSigner struct {
	secret []byte
}

func NewURLSigner(secret string) (*URLSigner, error) {
	if len(secret) < 32 {
		return nil, fmt.Errorf("crypto: SIGNED_URL_SECRET wajib minimal 32 karakter")
	}
	return &URLSigner{secret: []byte(secret)}, nil
}

func (s *URLSigner) Sign(resourceID string, expiresAt time.Time) string {
	return s.hitung(resourceID, expiresAt.Unix())
}

func (s *URLSigner) Verify(resourceID, expiresRaw, signature string, sekarang time.Time) error {
	expires, err := strconv.ParseInt(expiresRaw, 10, 64)
	if err != nil {
		return ErrSignedURLInvalid
	}

	diharapkan := s.hitung(resourceID, expires)
	diterima, err := base64.RawURLEncoding.DecodeString(signature)
	if err != nil {
		return ErrSignedURLInvalid
	}

	dibandingkan, err := base64.RawURLEncoding.DecodeString(diharapkan)
	if err != nil {
		return ErrSignedURLInvalid
	}

	if !hmac.Equal(dibandingkan, diterima) {
		return ErrSignedURLInvalid
	}

	if sekarang.Unix() > expires {
		return ErrSignedURLKedaluwarsa
	}

	return nil
}

func (s *URLSigner) Path(resourceID string, ttl time.Duration) string {
	expiresAt := time.Now().Add(ttl)
	return fmt.Sprintf("/files/%s?exp=%d&sig=%s", resourceID, expiresAt.Unix(), s.Sign(resourceID, expiresAt))
}

func (s *URLSigner) hitung(resourceID string, expires int64) string {
	mac := hmac.New(sha256.New, s.secret)
	fmt.Fprintf(mac, "%s\n%d", resourceID, expires)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func ChecksumSHA256(isi []byte) string {
	sum := sha256.Sum256(isi)
	return hex.EncodeToString(sum[:])
}
