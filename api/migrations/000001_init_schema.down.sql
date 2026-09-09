DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS insight_events;
DROP TABLE IF EXISTS watch_conditions;
DROP TABLE IF EXISTS watchlist_items;
DROP TABLE IF EXISTS webauthn_credentials;
DROP TABLE IF EXISTS auth_audit_log;
DROP TABLE IF EXISTS totp_backup_codes;
DROP TABLE IF EXISTS email_verification_tokens;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS refresh_tokens;

ALTER TABLE users DROP COLUMN IF EXISTS avatar_file_id;

DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

DROP FUNCTION IF EXISTS set_updated_at();
