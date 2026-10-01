package repository

import (
	"context"
	"time"
)

type BarisRisiko struct {
	ID          string    `db:"id"`
	Ticker      string    `db:"ticker"`
	InsightType string    `db:"insight_type"`
	Subtype     string    `db:"subtype"`
	Score       *float64  `db:"score"`
	GeneratedAt time.Time `db:"generated_at"`
	SubScores   []byte    `db:"sub_scores"`
	Pengali     *float64  `db:"pengali"`
	Jumlah      int       `db:"jumlah"`
}

func (r *InsightRepository) RiwayatRisiko(ctx context.Context, tickers []string, batas int) ([]BarisRisiko, error) {
	baris := []BarisRisiko{}
	if len(tickers) == 0 {
		return baris, nil
	}

	query := `SELECT id, ticker, insight_type, subtype, score, generated_at, sub_scores, pengali, jumlah
	          FROM (
	              SELECT id, ticker, insight_type, subtype, score, generated_at,
	                     payload->'sub_scores' AS sub_scores,
	                     (payload->'cross_pattern'->>'multiplier_applied')::float8 AS pengali,
	                     ROW_NUMBER() OVER (PARTITION BY ticker, insight_type ORDER BY generated_at DESC, id DESC) AS urutan,
	                     COUNT(*) OVER (PARTITION BY ticker) AS jumlah
	              FROM insight_events
	              WHERE ticker = ANY($1)
	          ) terbaru
	          WHERE urutan <= CASE WHEN insight_type = 'red_flag' THEN $2 ELSE 1 END
	          ORDER BY ticker, generated_at, id`
	if err := r.store.DB.SelectContext(ctx, &baris, query, tickers, batas); err != nil {
		return nil, err
	}
	return baris, nil
}
