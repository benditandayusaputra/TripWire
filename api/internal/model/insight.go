package model

import (
	"encoding/json"
	"time"
)

type InsightEvent struct {
	ID          string          `db:"id" json:"id"`
	Ticker      string          `db:"ticker" json:"ticker"`
	InsightType string          `db:"insight_type" json:"insight_type"`
	Subtype     string          `db:"subtype" json:"subtype"`
	Score       *float64        `db:"score" json:"score"`
	Payload     json.RawMessage `db:"payload" json:"payload"`
	Signature   string          `db:"signature" json:"signature"`
	PrevHash    *string         `db:"prev_hash" json:"prev_hash"`
	CurrentHash string          `db:"current_hash" json:"current_hash"`
	GeneratedAt time.Time       `db:"generated_at" json:"generated_at"`
}

type InsightVerification struct {
	ID             string    `json:"id"`
	Ticker         string    `json:"ticker"`
	InsightType    string    `json:"insight_type"`
	Subtype        string    `json:"subtype"`
	Score          *float64  `json:"score"`
	GeneratedAt    time.Time `json:"generated_at"`
	Algorithm      string    `json:"algorithm"`
	PublicKey      string    `json:"public_key"`
	Digest         string    `json:"digest"`
	Signature      string    `json:"signature"`
	PrevHash       *string   `json:"prev_hash"`
	CurrentHash    string    `json:"current_hash"`
	Valid          bool      `json:"valid"`
	SignatureValid bool      `json:"signature_valid"`
	HashValid      bool      `json:"hash_valid"`
	ChainValid     bool      `json:"chain_valid"`
	Reason         string    `json:"reason,omitempty"`
}
