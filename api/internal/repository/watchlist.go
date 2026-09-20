package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type WatchlistRepository struct {
	store *Store
}

func NewWatchlistRepository(store *Store) *WatchlistRepository {
	return &WatchlistRepository{store: store}
}

func (r *WatchlistRepository) List(ctx context.Context, userID string) ([]model.WatchlistItem, error) {
	items := []model.WatchlistItem{}
	query := `SELECT id, user_id, ticker, data_display_pref, created_at
	          FROM watchlist_items
	          WHERE user_id = $1
	          ORDER BY created_at DESC`
	if err := r.store.DB.SelectContext(ctx, &items, query, userID); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *WatchlistRepository) ByID(ctx context.Context, userID, itemID string) (*model.WatchlistItem, error) {
	item := &model.WatchlistItem{}
	query := `SELECT id, user_id, ticker, data_display_pref, created_at
	          FROM watchlist_items
	          WHERE id = $1 AND user_id = $2`
	if err := r.store.DB.GetContext(ctx, item, query, itemID, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return item, nil
}

func (r *WatchlistRepository) Create(ctx context.Context, userID, ticker, displayPref string) (*model.WatchlistItem, error) {
	var id string
	query := `INSERT INTO watchlist_items (user_id, ticker, data_display_pref)
	          VALUES ($1, $2, $3)
	          RETURNING id`
	if err := r.store.DB.GetContext(ctx, &id, query, userID, ticker, displayPref); err != nil {
		return nil, err
	}
	return r.ByID(ctx, userID, id)
}

func (r *WatchlistRepository) UpdateDisplayPref(ctx context.Context, userID, itemID, displayPref string) (*model.WatchlistItem, error) {
	query := `UPDATE watchlist_items
	          SET data_display_pref = $3
	          WHERE id = $1 AND user_id = $2`
	result, err := r.store.DB.ExecContext(ctx, query, itemID, userID, displayPref)
	if err != nil {
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, ErrNotFound
	}
	return r.ByID(ctx, userID, itemID)
}

func (r *WatchlistRepository) Delete(ctx context.Context, userID, itemID string) error {
	query := `DELETE FROM watchlist_items WHERE id = $1 AND user_id = $2`
	result, err := r.store.DB.ExecContext(ctx, query, itemID, userID)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *WatchlistRepository) TickerExists(ctx context.Context, userID, ticker string) (bool, error) {
	var exists bool
	query := `SELECT EXISTS (SELECT 1 FROM watchlist_items WHERE user_id = $1 AND ticker = $2)`
	err := r.store.DB.GetContext(ctx, &exists, query, userID, ticker)
	return exists, err
}

func (r *WatchlistRepository) ListConditions(ctx context.Context, userID, itemID string) ([]model.WatchCondition, error) {
	conditions := []model.WatchCondition{}
	query := `SELECT c.id, c.watchlist_item_id, c.condition_type, c.config, c.is_active, c.created_at
	          FROM watch_conditions c
	          JOIN watchlist_items w ON w.id = c.watchlist_item_id
	          WHERE c.watchlist_item_id = $1 AND w.user_id = $2
	          ORDER BY c.created_at`
	if err := r.store.DB.SelectContext(ctx, &conditions, query, itemID, userID); err != nil {
		return nil, err
	}
	return conditions, nil
}

func (r *WatchlistRepository) ListConditionsForItems(ctx context.Context, userID string) (map[string][]model.WatchCondition, error) {
	conditions := []model.WatchCondition{}
	query := `SELECT c.id, c.watchlist_item_id, c.condition_type, c.config, c.is_active, c.created_at
	          FROM watch_conditions c
	          JOIN watchlist_items w ON w.id = c.watchlist_item_id
	          WHERE w.user_id = $1
	          ORDER BY c.created_at`
	if err := r.store.DB.SelectContext(ctx, &conditions, query, userID); err != nil {
		return nil, err
	}

	grouped := map[string][]model.WatchCondition{}
	for _, condition := range conditions {
		grouped[condition.WatchlistItemID] = append(grouped[condition.WatchlistItemID], condition)
	}
	return grouped, nil
}

func (r *WatchlistRepository) ConditionByID(ctx context.Context, userID, itemID, conditionID string) (*model.WatchCondition, error) {
	condition := &model.WatchCondition{}
	query := `SELECT c.id, c.watchlist_item_id, c.condition_type, c.config, c.is_active, c.created_at
	          FROM watch_conditions c
	          JOIN watchlist_items w ON w.id = c.watchlist_item_id
	          WHERE c.id = $1 AND c.watchlist_item_id = $2 AND w.user_id = $3`
	if err := r.store.DB.GetContext(ctx, condition, query, conditionID, itemID, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return condition, nil
}

func (r *WatchlistRepository) CreateCondition(ctx context.Context, userID, itemID, conditionType string, config json.RawMessage, isActive bool) (*model.WatchCondition, error) {
	var id string
	query := `INSERT INTO watch_conditions (watchlist_item_id, condition_type, config, is_active)
	          SELECT w.id, $2, $3, $4
	          FROM watchlist_items w
	          WHERE w.id = $1 AND w.user_id = $5
	          RETURNING id`
	if err := r.store.DB.GetContext(ctx, &id, query, itemID, conditionType, []byte(config), isActive, userID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r.ConditionByID(ctx, userID, itemID, id)
}

func (r *WatchlistRepository) UpdateCondition(ctx context.Context, userID, itemID, conditionID string, config json.RawMessage, isActive *bool) (*model.WatchCondition, error) {
	query := `UPDATE watch_conditions c
	          SET config = COALESCE($4, c.config),
	              is_active = COALESCE($5, c.is_active)
	          FROM watchlist_items w
	          WHERE c.id = $1
	            AND c.watchlist_item_id = $2
	            AND w.id = c.watchlist_item_id
	            AND w.user_id = $3`

	var configArg any
	if len(config) > 0 {
		configArg = []byte(config)
	}

	result, err := r.store.DB.ExecContext(ctx, query, conditionID, itemID, userID, configArg, isActive)
	if err != nil {
		return nil, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return nil, ErrNotFound
	}
	return r.ConditionByID(ctx, userID, itemID, conditionID)
}

func (r *WatchlistRepository) DeleteCondition(ctx context.Context, userID, itemID, conditionID string) error {
	query := `DELETE FROM watch_conditions c
	          USING watchlist_items w
	          WHERE c.id = $1
	            AND c.watchlist_item_id = $2
	            AND w.id = c.watchlist_item_id
	            AND w.user_id = $3`
	result, err := r.store.DB.ExecContext(ctx, query, conditionID, itemID, userID)
	if err != nil {
		return err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return ErrNotFound
	}
	return nil
}
