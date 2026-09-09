package crypto

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

const AlgoritmaInsight = "Ed25519"

var (
	ErrKunciInsightInvalid = errors.New("crypto: kunci penanda tangan insight tidak valid")
	ErrSignatureInvalid    = errors.New("crypto: signature insight tidak cocok")
)

type InsightRecord struct {
	ID          string
	Ticker      string
	InsightType string
	Subtype     string
	Score       *float64
	Payload     []byte
	GeneratedAt time.Time
	PrevHash    string
}

type InsightSigner struct {
	privat ed25519.PrivateKey
	publik ed25519.PublicKey
}

func NewInsightSigner(kunci string) (*InsightSigner, error) {
	mentah, err := decodeKunci(strings.TrimSpace(kunci))
	if err != nil {
		return nil, err
	}

	switch len(mentah) {
	case ed25519.SeedSize:
		privat := ed25519.NewKeyFromSeed(mentah)
		return &InsightSigner{privat: privat, publik: privat.Public().(ed25519.PublicKey)}, nil
	case ed25519.PrivateKeySize:
		privat := ed25519.PrivateKey(mentah)
		return &InsightSigner{privat: privat, publik: privat.Public().(ed25519.PublicKey)}, nil
	default:
		return nil, fmt.Errorf("%w: panjang kunci %d byte", ErrKunciInsightInvalid, len(mentah))
	}
}

func decodeKunci(kunci string) ([]byte, error) {
	if kunci == "" {
		return nil, fmt.Errorf("%w: kunci kosong", ErrKunciInsightInvalid)
	}

	encodings := []*base64.Encoding{
		base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding,
	}
	for _, encoding := range encodings {
		if mentah, err := encoding.DecodeString(kunci); err == nil {
			return mentah, nil
		}
	}

	if mentah, err := hex.DecodeString(kunci); err == nil {
		return mentah, nil
	}

	return nil, fmt.Errorf("%w: bukan base64 maupun hex", ErrKunciInsightInvalid)
}

func (s *InsightSigner) PublicKey() string {
	return base64.StdEncoding.EncodeToString(s.publik)
}

func (s *InsightSigner) Algorithm() string {
	return AlgoritmaInsight
}

func (s *InsightSigner) Digest(record InsightRecord) (string, error) {
	kanonik, err := CanonicalJSON(record.Payload)
	if err != nil {
		return "", err
	}

	baris := []string{
		record.ID,
		record.Ticker,
		record.InsightType,
		record.Subtype,
		formatSkor(record.Score),
		record.GeneratedAt.UTC().Truncate(time.Microsecond).Format(time.RFC3339Nano),
		record.PrevHash,
		string(kanonik),
	}

	sum := sha256.Sum256([]byte(strings.Join(baris, "\n")))
	return hex.EncodeToString(sum[:]), nil
}

func (s *InsightSigner) Sign(record InsightRecord) (digest, signature string, err error) {
	digest, err = s.Digest(record)
	if err != nil {
		return "", "", err
	}

	mentah, err := hex.DecodeString(digest)
	if err != nil {
		return "", "", err
	}

	return digest, base64.StdEncoding.EncodeToString(ed25519.Sign(s.privat, mentah)), nil
}

func (s *InsightSigner) VerifySignature(digest, signature string) error {
	mentahDigest, err := hex.DecodeString(digest)
	if err != nil {
		return ErrSignatureInvalid
	}

	mentahSignature, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return ErrSignatureInvalid
	}

	if !ed25519.Verify(s.publik, mentahDigest, mentahSignature) {
		return ErrSignatureInvalid
	}

	return nil
}

func ChainHash(prevHash, digest, signature string) string {
	sum := sha256.Sum256([]byte(prevHash + "\n" + digest + "\n" + signature))
	return hex.EncodeToString(sum[:])
}

var kunciVolatil = []string{"computed_at"}

func ContentHash(ticker, insightType, subtype string, score *float64, payload []byte) (string, error) {
	kanonik, err := CanonicalJSON(tanpaKunciVolatil(payload))
	if err != nil {
		return "", err
	}

	baris := []string{ticker, insightType, subtype, formatSkor(score), string(kanonik)}
	sum := sha256.Sum256([]byte(strings.Join(baris, "\n")))
	return hex.EncodeToString(sum[:]), nil
}

func tanpaKunciVolatil(payload []byte) []byte {
	var node map[string]any
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()
	if err := decoder.Decode(&node); err != nil {
		return payload
	}

	for _, kunci := range kunciVolatil {
		delete(node, kunci)
	}

	bersih, err := json.Marshal(node)
	if err != nil {
		return payload
	}

	return bersih
}

func formatSkor(score *float64) string {
	if score == nil {
		return "null"
	}
	return strconv.FormatFloat(*score, 'f', 2, 64)
}

func CanonicalJSON(mentah []byte) ([]byte, error) {
	if len(mentah) == 0 {
		return []byte("null"), nil
	}

	decoder := json.NewDecoder(bytes.NewReader(mentah))
	decoder.UseNumber()

	var nilai any
	if err := decoder.Decode(&nilai); err != nil {
		return nil, fmt.Errorf("crypto: payload insight bukan JSON valid: %w", err)
	}

	var buf bytes.Buffer
	if err := tulisKanonik(&buf, nilai); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func tulisKanonik(buf *bytes.Buffer, node any) error {
	switch nilai := node.(type) {
	case map[string]any:
		kunci := make([]string, 0, len(nilai))
		for k := range nilai {
			kunci = append(kunci, k)
		}
		sort.Strings(kunci)

		buf.WriteByte('{')
		for i, k := range kunci {
			if i > 0 {
				buf.WriteByte(',')
			}
			teks, err := json.Marshal(k)
			if err != nil {
				return err
			}
			buf.Write(teks)
			buf.WriteByte(':')
			if err := tulisKanonik(buf, nilai[k]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')

	case []any:
		buf.WriteByte('[')
		for i, anak := range nilai {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := tulisKanonik(buf, anak); err != nil {
				return err
			}
		}
		buf.WriteByte(']')

	case json.Number:
		buf.WriteString(normalkanAngka(nilai.String()))

	default:
		teks, err := json.Marshal(nilai)
		if err != nil {
			return err
		}
		buf.Write(teks)
	}

	return nil
}
