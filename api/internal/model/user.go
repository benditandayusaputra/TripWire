package model

import "time"

type User struct {
	ID                  string     `db:"id" json:"id"`
	Email               string     `db:"email" json:"email"`
	EmailVerifiedAt     *time.Time `db:"email_verified_at" json:"email_verified_at"`
	PasswordHash        string     `db:"password_hash" json:"-"`
	PasswordSalt        string     `db:"password_salt" json:"-"`
	RoleID              int16      `db:"role_id" json:"-"`
	RoleName            string     `db:"role_name" json:"role"`
	Tier                string     `db:"tier" json:"tier"`
	IsActive            bool       `db:"is_active" json:"is_active"`
	TOTPSecret          *string    `db:"totp_secret" json:"-"`
	TOTPEnabled         bool       `db:"totp_enabled" json:"totp_enabled"`
	FailedLoginAttempts int16      `db:"failed_login_attempts" json:"-"`
	LockedUntil         *time.Time `db:"locked_until" json:"-"`
	FullName            string     `db:"full_name" json:"full_name"`
	PhoneNumber         *string    `db:"phone_number" json:"phone_number"`
	Bio                 *string    `db:"bio" json:"bio"`
	Locale              string     `db:"locale" json:"locale"`
	ThemePreference     string     `db:"theme_preference" json:"theme_preference"`
	Timezone            string     `db:"timezone" json:"timezone"`
	AvatarFileID        *string    `db:"avatar_file_id" json:"avatar_file_id"`
	AvatarURL           string     `db:"-" json:"avatar_url,omitempty"`
	LastLoginAt         *time.Time `db:"last_login_at" json:"last_login_at"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
}

func (u *User) IsLocked(now time.Time) bool {
	return u.LockedUntil != nil && u.LockedUntil.After(now)
}

type RefreshToken struct {
	ID          string     `db:"id" json:"id"`
	UserID      string     `db:"user_id" json:"-"`
	TokenHash   string     `db:"token_hash" json:"-"`
	DeviceLabel *string    `db:"device_label" json:"device_label"`
	IPAddress   *string    `db:"ip_address" json:"ip_address"`
	IssuedAt    time.Time  `db:"issued_at" json:"issued_at"`
	ExpiresAt   time.Time  `db:"expires_at" json:"expires_at"`
	RevokedAt   *time.Time `db:"revoked_at" json:"revoked_at"`
	LastUsedAt  *time.Time `db:"last_used_at" json:"last_used_at"`
}

type AuditEvent struct {
	UserID    *string
	EventType string
	IPAddress string
	UserAgent string
	Metadata  map[string]any
}

const (
	AuditRegister          = "auth.register"
	AuditLoginSuccess      = "auth.login.success"
	AuditLoginFailed       = "auth.login.failed"
	AuditLoginLocked       = "auth.login.locked"
	AuditLogout            = "auth.logout"
	AuditTokenRefreshed    = "auth.token.refreshed"
	AuditPasswordForgot    = "auth.password.forgot"
	AuditPasswordReset     = "auth.password.reset"
	AuditEmailVerified     = "auth.email.verified"
	AuditEmailResendToken  = "auth.email.resend"
	AuditSessionRevoked    = "auth.session.revoked"
	AuditSessionRevokedAll = "auth.session.revoked_all"
	AuditProfileUpdated    = "account.profile.updated"
)
