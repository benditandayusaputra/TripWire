package crypto

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("crypto: token tidak valid")

type AccessClaims struct {
	UserID string `json:"sub"`
	Role   string `json:"role"`
	Tier   string `json:"tier"`
	jwt.RegisteredClaims
}

type TokenSigner struct {
	secret []byte
	issuer string
}

func NewTokenSigner(secret, issuer string) *TokenSigner {
	return &TokenSigner{secret: []byte(secret), issuer: issuer}
}

func (s *TokenSigner) SignAccess(userID, role, tier string, ttl time.Duration) (string, time.Time, error) {
	expiresAt := time.Now().Add(ttl)

	jti, err := NewOpaqueToken()
	if err != nil {
		return "", time.Time{}, err
	}

	claims := AccessClaims{
		UserID: userID,
		Role:   role,
		Tier:   tier,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			ID:        jti,
		},
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("crypto: sign access token: %w", err)
	}

	return signed, expiresAt, nil
}

func (s *TokenSigner) ParseAccess(token string) (*AccessClaims, error) {
	claims := &AccessClaims{}

	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return s.secret, nil
	}, jwt.WithIssuer(s.issuer), jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil || !parsed.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
