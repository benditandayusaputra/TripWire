package model

import (
	"encoding/json"
	"time"
)

type Notification struct {
	ID             string           `db:"id" json:"id"`
	UserID         string           `db:"user_id" json:"-"`
	InsightEventID string           `db:"insight_event_id" json:"insight_event_id"`
	SentAt         time.Time        `db:"sent_at" json:"sent_at"`
	ReadAt         *time.Time       `db:"read_at" json:"read_at"`
	Ticker         string           `db:"ticker" json:"ticker,omitempty"`
	CompanyName    string           `db:"-" json:"company_name,omitempty"`
	InsightType    string           `db:"insight_type" json:"insight_type,omitempty"`
	Subtype        string           `db:"subtype" json:"subtype,omitempty"`
	Score          *float64         `db:"score" json:"score,omitempty"`
	PrevScore      *float64         `db:"prev_score" json:"prev_score,omitempty"`
	Category       string           `db:"category" json:"category,omitempty"`
	SubScores      *json.RawMessage `db:"sub_scores" json:"sub_scores,omitempty"`
	Signals        *json.RawMessage `db:"signals" json:"signals,omitempty"`
	GeneratedAt    *time.Time       `db:"generated_at" json:"generated_at,omitempty"`
	Channel        string           `db:"-" json:"channel,omitempty"`
}

type NotificationSummary struct {
	Total          int        `db:"total" json:"total"`
	Unread         int        `db:"unread" json:"unread"`
	Last7Days      int        `db:"last_7_days" json:"last_7_days"`
	Critical7Days  int        `db:"critical_7_days" json:"critical_7_days"`
	Last30Days     int        `db:"last_30_days" json:"last_30_days"`
	Previous30Days int        `db:"previous_30_days" json:"previous_30_days"`
	RedFlag        int        `db:"red_flag" json:"red_flag"`
	MarketIntel    int        `db:"market_intelligence" json:"market_intelligence"`
	Critical       int        `db:"critical" json:"critical"`
	High           int        `db:"high" json:"high"`
	Moderate       int        `db:"moderate" json:"moderate"`
	Low            int        `db:"low" json:"low"`
	LastSentAt     *time.Time `db:"last_sent_at" json:"last_sent_at"`
}

type NotificationDay struct {
	Date     string `db:"date" json:"date"`
	Total    int    `db:"total" json:"total"`
	Critical int    `db:"critical" json:"critical"`
	High     int    `db:"high" json:"high"`
	Moderate int    `db:"moderate" json:"moderate"`
	Low      int    `db:"low" json:"low"`
	Market   int    `db:"market" json:"market"`
}

type NotificationTicker struct {
	Ticker      string          `db:"ticker" json:"ticker"`
	CompanyName string          `db:"-" json:"company_name,omitempty"`
	Total       int             `db:"total" json:"total"`
	Recent      int             `db:"recent" json:"recent_30_days"`
	Unread      int             `db:"unread" json:"unread"`
	LatestScore *float64        `db:"latest_score" json:"latest_score"`
	LatestAt    time.Time       `db:"latest_at" json:"latest_at"`
	Scores      json.RawMessage `db:"scores" json:"scores"`
}

type NotificationPeak struct {
	NotificationID string    `db:"notification_id" json:"notification_id"`
	InsightID      string    `db:"insight_id" json:"insight_id"`
	Ticker         string    `db:"ticker" json:"ticker"`
	Score          float64   `db:"score" json:"score"`
	SentAt         time.Time `db:"sent_at" json:"sent_at"`
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
