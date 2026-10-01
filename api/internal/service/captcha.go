package service

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"github.com/dchest/captcha"
	"github.com/redis/go-redis/v9"

	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
)

const (
	panjangCaptcha = 6
	umurCaptcha    = 10 * time.Minute
)

var ErrCaptchaTidakDikenal = errors.New("service: captcha tidak dikenal atau kedaluwarsa")

type Captcha struct {
	ID     string `json:"captcha_id"`
	Gambar string `json:"image"`
}

type CaptchaService struct {
	redis *redis.Client
}

func NewCaptchaService(redis *redis.Client) *CaptchaService {
	return &CaptchaService{redis: redis}
}

func (s *CaptchaService) Buat(ctx context.Context) (*Captcha, error) {
	id, err := crypto.NewOpaqueToken()
	if err != nil {
		return nil, err
	}

	angka := captcha.RandomDigits(panjangCaptcha)
	teks := make([]byte, len(angka))
	for i, digit := range angka {
		teks[i] = '0' + digit
	}

	if err := s.redis.Set(ctx, kunciCaptcha(id), teks, umurCaptcha).Err(); err != nil {
		return nil, err
	}

	var png bytes.Buffer
	if _, err := captcha.NewImage(id, angka, captcha.StdWidth, captcha.StdHeight).WriteTo(&png); err != nil {
		return nil, err
	}

	return &Captcha{ID: id, Gambar: "data:image/png;base64," + base64.StdEncoding.EncodeToString(png.Bytes())}, nil
}

func (s *CaptchaService) Audio(ctx context.Context, id string) ([]byte, error) {
	teks, err := s.redis.Get(ctx, kunciCaptcha(id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, ErrCaptchaTidakDikenal
	}
	if err != nil {
		return nil, err
	}

	angka := make([]byte, len(teks))
	for i, huruf := range teks {
		angka[i] = huruf - '0'
	}

	var wav bytes.Buffer
	if _, err := captcha.NewAudio(id, angka, "en").WriteTo(&wav); err != nil {
		return nil, err
	}
	return wav.Bytes(), nil
}

func (s *CaptchaService) Cocok(ctx context.Context, id, jawaban string) (bool, error) {
	if id == "" {
		return false, nil
	}

	simpanan, err := s.redis.GetDel(ctx, kunciCaptcha(id)).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	jawaban = strings.Join(strings.Fields(jawaban), "")
	return subtle.ConstantTimeCompare(simpanan, []byte(jawaban)) == 1, nil
}

func kunciCaptcha(id string) string {
	return "captcha:" + id
}
