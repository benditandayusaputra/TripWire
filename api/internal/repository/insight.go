package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

const insightColumns = `id, ticker, insight_type, subtype, score, payload,
	signature, prev_hash, current_hash, generated_at`

type InsightRepository struct {
	store *Store
}

func NewInsightRepository(store *Store) *InsightRepository {
	return &InsightRepository{store: store}
}

func (r *InsightRepository) ByID(ctx context.Context, id string) (*model.InsightEvent, error) {
	event := &model.InsightEvent{}
	query := `SELECT ` + insightColumns + ` FROM insight_events WHERE id = $1`
	if err := r.store.DB.GetContext(ctx, event, query, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return event, nil
}

func (r *InsightRepository) Latest(ctx context.Context, ticker, insightType string) (*model.InsightEvent, error) {
	event := &model.InsightEvent{}
	query := `SELECT ` + insightColumns + `
	          FROM insight_events
	          WHERE ticker = $1 AND insight_type = $2
	          ORDER BY generated_at DESC, id DESC
	          LIMIT 1`
	if err := r.store.DB.GetContext(ctx, event, query, ticker, insightType); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return event, nil
}

func (r *InsightRepository) Feed(ctx context.Context, tickers []string, insightType string, limit int) ([]model.InsightEvent, error) {
	events := []model.InsightEvent{}
	if len(tickers) == 0 {
		return events, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	query := `SELECT ` + insightColumns + `
	          FROM insight_events
	          WHERE ticker = ANY($1)
	            AND ($2 = '' OR insight_type = $2)
	          ORDER BY generated_at DESC, id DESC
	          LIMIT $3`
	if err := r.store.DB.SelectContext(ctx, &events, query, tickers, insightType, limit); err != nil {
		return nil, err
	}
	return events, nil
}

type PendingInsight struct {
	Ticker      string
	InsightType string
	Subtype     string
	Score       *float64
	Payload     json.RawMessage
}

type ChainWriter func(id, prevHash string, generatedAt time.Time, payload json.RawMessage) (signature, currentHash string, err error)

func (r *InsightRepository) Append(ctx context.Context, id string, generatedAt time.Time, pending PendingInsight, sign ChainWriter) (*model.InsightEvent, error) {
	tx, err := r.store.DB.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, chainLockID); err != nil {
		return nil, err
	}

	var prevHash sql.NullString
	err = tx.GetContext(ctx, &prevHash,
		`SELECT current_hash FROM insight_events ORDER BY generated_at DESC, id DESC LIMIT 1`)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	signature, currentHash, err := sign(id, prevHash.String, generatedAt, pending.Payload)
	if err != nil {
		return nil, err
	}

	var prevArg any
	if prevHash.Valid && prevHash.String != "" {
		prevArg = prevHash.String
	}

	insert := `INSERT INTO insight_events
	           (id, ticker, insight_type, subtype, score, payload, signature, prev_hash, current_hash, generated_at)
	           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err = tx.ExecContext(ctx, insert,
		id, pending.Ticker, pending.InsightType, pending.Subtype, pending.Score,
		[]byte(pending.Payload), signature, prevArg, currentHash, generatedAt,
	)
	if err != nil {
		return nil, err
	}

	event := &model.InsightEvent{}
	if err := tx.GetContext(ctx, event, `SELECT `+insightColumns+` FROM insight_events WHERE id = $1`, id); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return event, nil
}

const chainLockID = 7213045

func (r *InsightRepository) ByCurrentHash(ctx context.Context, hash string) (*model.InsightEvent, error) {
	event := &model.InsightEvent{}
	query := `SELECT ` + insightColumns + ` FROM insight_events WHERE current_hash = $1 LIMIT 1`
	if err := r.store.DB.GetContext(ctx, event, query, hash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return event, nil
}
