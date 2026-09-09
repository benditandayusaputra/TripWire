package repository

import (
	"context"
	"encoding/json"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
)

type AuditRepository struct {
	store *Store
}

func NewAuditRepository(store *Store) *AuditRepository {
	return &AuditRepository{store: store}
}

func (r *AuditRepository) Record(ctx context.Context, event model.AuditEvent) error {
	metadata, err := json.Marshal(event.Metadata)
	if err != nil {
		metadata = []byte("{}")
	}

	query := `INSERT INTO auth_audit_log (user_id, event_type, ip_address, user_agent, metadata)
	          VALUES ($1, $2, NULLIF($3, '')::inet, NULLIF($4, ''), $5)`
	_, err = r.store.DB.ExecContext(ctx, query, event.UserID, event.EventType, event.IPAddress, event.UserAgent, metadata)
	return err
}

func (r *AuditRepository) CountByType(ctx context.Context, userID, eventType string) (int, error) {
	var total int
	query := `SELECT count(*) FROM auth_audit_log WHERE user_id = $1 AND event_type = $2`
	err := r.store.DB.GetContext(ctx, &total, query, userID, eventType)
	return total, err
}
