package crypto

import (
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestSignedURL(t *testing.T) {
	signer, err := NewURLSigner(strings.Repeat("k", 32))
	if err != nil {
		t.Fatalf("NewURLSigner: %v", err)
	}

	sekarang := time.Now()
	kedaluwarsa := sekarang.Add(10 * time.Minute)
	id := "01a08600-0000-7000-8000-000000000001"
	sig := signer.Sign(id, kedaluwarsa)

	if err := signer.Verify(id, formatUnix(kedaluwarsa), sig, sekarang); err != nil {
		t.Fatalf("signature yang sah harusnya diterima: %v", err)
	}

	rusak := []byte(sig)
	rusak[0] ^= 0x01
	if err := signer.Verify(id, formatUnix(kedaluwarsa), string(rusak), sekarang); err == nil {
		t.Fatal("signature yang diubah harusnya ditolak")
	}

	if err := signer.Verify("id-lain", formatUnix(kedaluwarsa), sig, sekarang); err == nil {
		t.Fatal("signature milik resource lain harusnya ditolak")
	}

	lewat := sekarang.Add(-time.Minute)
	sigLewat := signer.Sign(id, lewat)
	if err := signer.Verify(id, formatUnix(lewat), sigLewat, sekarang); err != ErrSignedURLKedaluwarsa {
		t.Fatalf("tautan kedaluwarsa harusnya ditolak, dapat %v", err)
	}

	if _, err := NewURLSigner("pendek"); err == nil {
		t.Fatal("secret pendek harusnya ditolak")
	}
}

func formatUnix(t time.Time) string {
	return strconv.FormatInt(t.Unix(), 10)
}
