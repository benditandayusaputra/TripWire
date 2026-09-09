package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

var ErrIntegritasGagal = errors.New("service: insight yang baru ditulis gagal diverifikasi")

type IntegrityService struct {
	repo   *repository.InsightRepository
	signer *crypto.InsightSigner
}

func NewIntegrityService(repo *repository.InsightRepository, signer *crypto.InsightSigner) *IntegrityService {
	return &IntegrityService{repo: repo, signer: signer}
}

func (s *IntegrityService) Record(ctx context.Context, insight *Insight) (*model.InsightEvent, bool, error) {
	payload, err := json.Marshal(insight.Payload)
	if err != nil {
		return nil, false, err
	}

	kontenBaru, err := crypto.ContentHash(insight.Ticker, insight.InsightType, insight.Subtype, insight.Score, payload)
	if err != nil {
		return nil, false, err
	}

	terakhir, err := s.repo.Latest(ctx, insight.Ticker, insight.InsightType)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, false, err
	}
	if terakhir != nil {
		kontenLama, err := crypto.ContentHash(terakhir.Ticker, terakhir.InsightType, terakhir.Subtype, terakhir.Score, terakhir.Payload)
		if err == nil && kontenLama == kontenBaru {
			return terakhir, false, nil
		}
	}

	id, err := uuid.NewV7()
	if err != nil {
		return nil, false, err
	}
	generatedAt := time.Now().UTC().Truncate(time.Microsecond)

	pending := repository.PendingInsight{
		Ticker:      insight.Ticker,
		InsightType: insight.InsightType,
		Subtype:     insight.Subtype,
		Score:       insight.Score,
		Payload:     payload,
	}

	tandaTangan := func(recordID, prevHash string, waktu time.Time, isi json.RawMessage) (string, string, error) {
		digest, signature, err := s.signer.Sign(crypto.InsightRecord{
			ID:          recordID,
			Ticker:      pending.Ticker,
			InsightType: pending.InsightType,
			Subtype:     pending.Subtype,
			Score:       pending.Score,
			Payload:     isi,
			GeneratedAt: waktu,
			PrevHash:    prevHash,
		})
		if err != nil {
			return "", "", err
		}
		return signature, crypto.ChainHash(prevHash, digest, signature), nil
	}

	event, err := s.repo.Append(ctx, id.String(), generatedAt, pending, tandaTangan)
	if err != nil {
		return nil, false, err
	}

	hasil := s.periksa(event, nil)
	if !hasil.SignatureValid || !hasil.HashValid {
		return nil, false, ErrIntegritasGagal
	}

	return event, true, nil
}

func (s *IntegrityService) Verify(ctx context.Context, id string) (*model.InsightVerification, error) {
	event, err := s.repo.ByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, ErrTidakDitemukan
		}
		return nil, err
	}

	var sebelumnya *model.InsightEvent
	if event.PrevHash != nil && *event.PrevHash != "" {
		if kandidat, err := s.repo.ByCurrentHash(ctx, *event.PrevHash); err == nil {
			sebelumnya = kandidat
		}
	}

	return s.periksa(event, sebelumnya), nil
}

func (s *IntegrityService) periksa(event *model.InsightEvent, sebelumnya *model.InsightEvent) *model.InsightVerification {
	prevHash := ""
	if event.PrevHash != nil {
		prevHash = *event.PrevHash
	}

	hasil := &model.InsightVerification{
		ID:          event.ID,
		Ticker:      event.Ticker,
		InsightType: event.InsightType,
		Subtype:     event.Subtype,
		Score:       event.Score,
		GeneratedAt: event.GeneratedAt,
		Algorithm:   s.signer.Algorithm(),
		PublicKey:   s.signer.PublicKey(),
		Signature:   event.Signature,
		PrevHash:    event.PrevHash,
		CurrentHash: event.CurrentHash,
	}

	digest, err := s.signer.Digest(crypto.InsightRecord{
		ID:          event.ID,
		Ticker:      event.Ticker,
		InsightType: event.InsightType,
		Subtype:     event.Subtype,
		Score:       event.Score,
		Payload:     event.Payload,
		GeneratedAt: event.GeneratedAt,
		PrevHash:    prevHash,
	})
	if err != nil {
		hasil.Reason = "Payload insight tidak bisa dibaca ulang sebagai JSON"
		return hasil
	}

	hasil.Digest = digest
	hasil.SignatureValid = s.signer.VerifySignature(digest, event.Signature) == nil
	hasil.HashValid = crypto.ChainHash(prevHash, digest, event.Signature) == event.CurrentHash
	hasil.ChainValid = prevHash == "" || sebelumnya != nil
	hasil.Valid = hasil.SignatureValid && hasil.HashValid && hasil.ChainValid

	switch {
	case !hasil.SignatureValid:
		hasil.Reason = "Signature Ed25519 tidak cocok dengan isi insight, data sudah berubah setelah ditandatangani"
	case !hasil.HashValid:
		hasil.Reason = "current_hash tidak cocok dengan hasil hitung ulang rantai hash"
	case !hasil.ChainValid:
		hasil.Reason = "Insight sebelumnya yang dirujuk prev_hash tidak ditemukan, rantai terputus"
	}

	return hasil
}
