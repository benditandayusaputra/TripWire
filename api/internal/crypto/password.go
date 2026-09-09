package crypto

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

var ErrPasswordMismatch = errors.New("crypto: password tidak cocok")

func NewPasswordSalt() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("crypto: generate salt: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func HashPassword(salt, plain string, cost int) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(salt+plain), cost)
	if err != nil {
		return "", fmt.Errorf("crypto: hash password: %w", err)
	}
	return string(hash), nil
}

func VerifyPassword(hash, salt, plain string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(salt+plain)); err != nil {
		return ErrPasswordMismatch
	}
	return nil
}
