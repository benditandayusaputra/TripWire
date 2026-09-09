-- ============================================================
-- TripWire: Skema Database Lengkap (PostgreSQL 18+)
-- ID pakai UUIDv7 (time-ordered, index-friendly), profil user
-- lengkap, sistem file dengan signed TTL access
-- ============================================================
-- PRASYARAT: PostgreSQL 18 atau lebih baru (uuidv7() built-in
-- sejak versi ini, cek dulu versi image Postgres yang dipakai)

-- Trigger reusable buat auto-update kolom updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1. ROLES
-- ------------------------------------------------------------
CREATE TABLE roles (
    id SMALLSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (name, permissions) VALUES
    ('user', '{"watchlist:manage_own": true}'),
    ('admin', '{"watchlist:manage_own": true, "system:view_health": true, "system:trigger_manual_scan": true, "users:view_all": true}');

-- ------------------------------------------------------------
-- 2. USERS
-- avatar_file_id ditambah belakangan (bagian 4), karena files
-- butuh users lebih dulu ada buat FK owner_user_id
-- ------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    email TEXT UNIQUE NOT NULL,
    email_verified_at TIMESTAMPTZ,
    password_hash TEXT NOT NULL,          -- bcrypt(salt + plainPassword)
    password_salt TEXT NOT NULL,          -- application-level salt, terpisah dari hash
    role_id SMALLINT NOT NULL REFERENCES roles(id) DEFAULT 1,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'premium')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    totp_secret TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    -- profil lengkap
    full_name TEXT NOT NULL,
    phone_number TEXT,
    bio TEXT,
    locale TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id', 'en')),
    theme_preference TEXT NOT NULL DEFAULT 'dark' CHECK (theme_preference IN ('dark', 'light', 'system')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 3. FILES
-- Metadata file/dokumen (termasuk foto profil). Yang disimpan
-- cuma metadata dan lokasi di storage, BUKAN url publik. Akses
-- ke isi file lewat signed URL ber-TTL yang di-generate saat
-- diminta (lihat kode Go di percakapan), bukan disimpan di sini.
-- ------------------------------------------------------------
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('avatar', 'attachment', 'export', 'other')),
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL,        -- path/key di object storage (S3/R2/dst)
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 TEXT NOT NULL,    -- integritas file, konsisten sama pola hash di insight_events
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ             -- soft delete, biar link lama yang expired gak nge-crash
);
CREATE INDEX idx_files_owner_user_id ON files(owner_user_id);

-- ------------------------------------------------------------
-- 4. Nyambungin avatar ke users, sekarang files udah ada
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN avatar_file_id UUID REFERENCES files(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 5. REFRESH TOKENS: whitelist token aktif, revoke per device
-- ------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    device_label TEXT,
    ip_address INET,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ------------------------------------------------------------
-- 6. PASSWORD RESET TOKENS
-- ------------------------------------------------------------
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

-- ------------------------------------------------------------
-- 7. EMAIL VERIFICATION TOKENS
-- ------------------------------------------------------------
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);

-- ------------------------------------------------------------
-- 8. TOTP BACKUP CODES: scaffolding 2FA
-- ------------------------------------------------------------
CREATE TABLE totp_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_totp_backup_codes_user_id ON totp_backup_codes(user_id);

-- ------------------------------------------------------------
-- 9. AUTH AUDIT LOG
-- ------------------------------------------------------------
CREATE TABLE auth_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at DESC);

-- ------------------------------------------------------------
-- 10. WEBAUTHN CREDENTIALS: fingerprint/Face ID/security key,
-- toggle nyala/matinya lewat feature flag config, bukan di sini
-- ------------------------------------------------------------
CREATE TABLE webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,   -- base64url dari authenticator
    public_key BYTEA NOT NULL,            -- COSE public key
    sign_count BIGINT NOT NULL DEFAULT 0, -- gak naik semestinya = indikasi kloning
    transports TEXT[],                    -- hint browser: 'usb', 'nfc', 'ble', 'internal'
    device_label TEXT,                    -- "iPhone Bendi", "YubiKey 5"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);
CREATE INDEX idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);

-- ============================================================
-- TABEL FITUR PRODUK
-- ============================================================

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    data_display_pref TEXT NOT NULL DEFAULT 'insight_only'
        CHECK (data_display_pref IN ('insight_only', 'insight_plus_data')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, ticker)
);
CREATE INDEX idx_watchlist_items_user_id ON watchlist_items(user_id);

CREATE TABLE watch_conditions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    watchlist_item_id UUID NOT NULL REFERENCES watchlist_items(id) ON DELETE CASCADE,
    condition_type TEXT NOT NULL
        CHECK (condition_type IN ('recent_event', 'geopolitical', 'daily', 'weekly', 'periodic_custom')),
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_watch_conditions_watchlist_item_id ON watch_conditions(watchlist_item_id);

CREATE TABLE insight_events (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    ticker TEXT NOT NULL,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('red_flag', 'market_intelligence')),
    subtype TEXT NOT NULL,
    score NUMERIC(5,2),
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    prev_hash TEXT,
    current_hash TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_insight_events_ticker ON insight_events(ticker);
CREATE INDEX idx_insight_events_generated_at ON insight_events(generated_at DESC);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    insight_event_id UUID NOT NULL REFERENCES insight_events(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, endpoint)
);
