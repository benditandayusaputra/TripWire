package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
)

var (
	ErrKunciEnkripsiInvalid = errors.New("crypto: kunci enkripsi harus 32 byte setelah didekode")
	ErrCiphertextRusak      = errors.New("crypto: ciphertext tidak bisa didekripsi")
)

type Cipher struct {
	aead cipher.AEAD
}

func NewCipher(kunci string) (*Cipher, error) {
	mentah, err := decodeKunci(kunci)
	if err != nil {
		return nil, err
	}
	if len(mentah) != 32 {
		return nil, fmt.Errorf("%w, dapat %d byte", ErrKunciEnkripsiInvalid, len(mentah))
	}

	blok, err := aes.NewCipher(mentah)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(blok)
	if err != nil {
		return nil, err
	}

	return &Cipher{aead: aead}, nil
}

func (c *Cipher) Encrypt(plain string) (string, error) {
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	terenkripsi := c.aead.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(terenkripsi), nil
}

func (c *Cipher) Decrypt(terenkripsi string) (string, error) {
	mentah, err := base64.StdEncoding.DecodeString(terenkripsi)
	if err != nil {
		return "", ErrCiphertextRusak
	}

	ukuranNonce := c.aead.NonceSize()
	if len(mentah) < ukuranNonce {
		return "", ErrCiphertextRusak
	}

	plain, err := c.aead.Open(nil, mentah[:ukuranNonce], mentah[ukuranNonce:], nil)
	if err != nil {
		return "", ErrCiphertextRusak
	}

	return string(plain), nil
}
