package crypto

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestCipherBolakBalik(t *testing.T) {
	kunci := base64.StdEncoding.EncodeToString(make([]byte, 32))

	c, err := NewCipher(kunci)
	if err != nil {
		t.Fatalf("NewCipher: %v", err)
	}

	rahasia := "JBSWY3DPEHPK3PXP"

	terenkripsi, err := c.Encrypt(rahasia)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if strings.Contains(terenkripsi, rahasia) {
		t.Fatal("ciphertext masih memuat plaintext")
	}

	lagi, err := c.Encrypt(rahasia)
	if err != nil {
		t.Fatalf("Encrypt kedua: %v", err)
	}
	if lagi == terenkripsi {
		t.Fatal("dua enkripsi menghasilkan ciphertext identik, nonce tidak acak")
	}

	kembali, err := c.Decrypt(terenkripsi)
	if err != nil || kembali != rahasia {
		t.Fatalf("Decrypt = %q, %v", kembali, err)
	}

	rusak := []byte(terenkripsi)
	rusak[len(rusak)-2] ^= 0x01
	if _, err := c.Decrypt(string(rusak)); err == nil {
		t.Fatal("ciphertext yang diubah harusnya ditolak")
	}

	if _, err := NewCipher(base64.StdEncoding.EncodeToString(make([]byte, 16))); err == nil {
		t.Fatal("kunci 16 byte harusnya ditolak")
	}
}
