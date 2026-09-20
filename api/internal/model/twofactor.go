package model

import "time"

type TOTPStatus struct {
	Enabled            bool       `json:"enabled"`
	PendingSetup       bool       `json:"pending_setup"`
	BackupCodesLeft    int        `json:"backup_codes_left"`
	WebAuthnEnabled    bool       `json:"webauthn_enabled"`
	WebAuthnCredential int        `json:"webauthn_credentials"`
	ConfirmedAt        *time.Time `json:"confirmed_at"`
}

type TOTPSetup struct {
	Secret     string `json:"secret"`
	OTPAuthURL string `json:"otpauth_url"`
	QRCode     string `json:"qr_code"`
	Issuer     string `json:"issuer"`
	Account    string `json:"account"`
}

type WebAuthnCredential struct {
	ID           string     `db:"id" json:"id"`
	UserID       string     `db:"user_id" json:"-"`
	CredentialID string     `db:"credential_id" json:"credential_id"`
	PublicKey    []byte     `db:"public_key" json:"-"`
	SignCount    int64      `db:"sign_count" json:"sign_count"`
	Transports   []string   `db:"transports" json:"transports"`
	DeviceLabel  *string    `db:"device_label" json:"device_label"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	LastUsedAt   *time.Time `db:"last_used_at" json:"last_used_at"`
}

const (
	AuditTOTPSetup        = "auth.totp.setup"
	AuditTOTPEnabled      = "auth.totp.enabled"
	AuditTOTPDisabled     = "auth.totp.disabled"
	AuditTOTPFailed       = "auth.totp.failed"
	AuditBackupCodeUsed   = "auth.totp.backup_code_used"
	AuditBackupRegenerate = "auth.totp.backup_regenerated"
	AuditWebAuthnAdded    = "auth.webauthn.added"
	AuditWebAuthnRemoved  = "auth.webauthn.removed"
)
