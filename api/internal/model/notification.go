package model

import "time"

type Notification struct {
	ID             string     `db:"id" json:"id"`
	UserID         string     `db:"user_id" json:"-"`
	InsightEventID string     `db:"insight_event_id" json:"insight_event_id"`
	SentAt         time.Time  `db:"sent_at" json:"sent_at"`
	ReadAt         *time.Time `db:"read_at" json:"read_at"`
	Ticker         string     `db:"ticker" json:"ticker,omitempty"`
	InsightType    string     `db:"insight_type" json:"insight_type,omitempty"`
	Subtype        string     `db:"subtype" json:"subtype,omitempty"`
	Score          *float64   `db:"score" json:"score,omitempty"`
	GeneratedAt    *time.Time `db:"generated_at" json:"generated_at,omitempty"`
	Channel        string     `db:"-" json:"channel,omitempty"`
}

type PushSubscription struct {
	ID        string    `db:"id" json:"id"`
	UserID    string    `db:"user_id" json:"-"`
	Endpoint  string    `db:"endpoint" json:"endpoint"`
	P256dhKey string    `db:"p256dh_key" json:"-"`
	AuthKey   string    `db:"auth_key" json:"-"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

const (
	KanalStream    = "sse"
	KanalWebPush   = "web_push"
	KanalTersimpan = "stored"
)
