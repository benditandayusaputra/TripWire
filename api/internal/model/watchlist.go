package model

import (
	"encoding/json"
	"time"
)

type WatchlistItem struct {
	ID              string           `db:"id" json:"id"`
	UserID          string           `db:"user_id" json:"-"`
	Ticker          string           `db:"ticker" json:"ticker"`
	DataDisplayPref string           `db:"data_display_pref" json:"data_display_pref"`
	CreatedAt       time.Time        `db:"created_at" json:"created_at"`
	CompanyName     string           `db:"-" json:"company_name,omitempty"`
	Conditions      []WatchCondition `db:"-" json:"conditions"`
}

type WatchCondition struct {
	ID              string          `db:"id" json:"id"`
	WatchlistItemID string          `db:"watchlist_item_id" json:"watchlist_item_id"`
	ConditionType   string          `db:"condition_type" json:"condition_type"`
	Config          json.RawMessage `db:"config" json:"config"`
	IsActive        bool            `db:"is_active" json:"is_active"`
	CreatedAt       time.Time       `db:"created_at" json:"created_at"`
}

const (
	DisplayInsightOnly = "insight_only"
	DisplayInsightPlus = "insight_plus_data"
)

var DisplayPrefs = []string{DisplayInsightOnly, DisplayInsightPlus}

const (
	ConditionRecentEvent    = "recent_event"
	ConditionGeopolitical   = "geopolitical"
	ConditionDaily          = "daily"
	ConditionWeekly         = "weekly"
	ConditionPeriodicCustom = "periodic_custom"
)

var ConditionTypes = []string{
	ConditionRecentEvent,
	ConditionGeopolitical,
	ConditionDaily,
	ConditionWeekly,
	ConditionPeriodicCustom,
}
