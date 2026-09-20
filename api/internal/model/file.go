package model

import "time"

type File struct {
	ID               string     `db:"id" json:"id"`
	OwnerUserID      string     `db:"owner_user_id" json:"-"`
	Purpose          string     `db:"purpose" json:"purpose"`
	OriginalFilename string     `db:"original_filename" json:"original_filename"`
	StorageKey       string     `db:"storage_key" json:"-"`
	MimeType         string     `db:"mime_type" json:"mime_type"`
	SizeBytes        int64      `db:"size_bytes" json:"size_bytes"`
	ChecksumSHA256   string     `db:"checksum_sha256" json:"checksum_sha256"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	DeletedAt        *time.Time `db:"deleted_at" json:"-"`
	URL              string     `db:"-" json:"url,omitempty"`
}

const (
	PurposeAvatar     = "avatar"
	PurposeAttachment = "attachment"
	PurposeExport     = "export"
	PurposeOther      = "other"
)

var Purposes = []string{PurposeAvatar, PurposeAttachment, PurposeExport, PurposeOther}

const (
	AuditFileUploaded = "file.uploaded"
	AuditFileDeleted  = "file.deleted"
	AuditAvatarSet    = "account.avatar.set"
	AuditAvatarClear  = "account.avatar.cleared"
)
