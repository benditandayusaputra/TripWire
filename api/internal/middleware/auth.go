package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
)

const (
	AccessCookieName  = "tw_access"
	RefreshCookieName = "tw_refresh"
	CSRFCookieName    = "tw_csrf"
	CSRFHeaderName    = "X-CSRF-Token"

	LocalUserID = "user_id"
	LocalRole   = "user_role"
	LocalTier   = "user_tier"
)

func RequireAuth(signer *crypto.TokenSigner) fiber.Handler {
	return func(c *fiber.Ctx) error {
		token := accessTokenFrom(c)
		if token == "" {
			return unauthorized(c)
		}

		claims, err := signer.ParseAccess(token)
		if err != nil {
			return unauthorized(c)
		}

		c.Locals(LocalUserID, claims.UserID)
		c.Locals(LocalRole, claims.Role)
		c.Locals(LocalTier, claims.Tier)

		return c.Next()
	}
}

func RequireAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if role, _ := c.Locals(LocalRole).(string); role != "admin" {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Halaman tidak ditemukan"})
		}
		return c.Next()
	}
}

func UserID(c *fiber.Ctx) string {
	id, _ := c.Locals(LocalUserID).(string)
	return id
}

func accessTokenFrom(c *fiber.Ctx) string {
	header := c.Get(fiber.HeaderAuthorization)
	if after, found := strings.CutPrefix(header, "Bearer "); found {
		return strings.TrimSpace(after)
	}
	return c.Cookies(AccessCookieName)
}

func unauthorized(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid, silakan masuk lagi"})
}
