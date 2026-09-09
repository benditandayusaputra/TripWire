package middleware

import (
	"crypto/subtle"

	"github.com/gofiber/fiber/v2"
)

var safeMethods = map[string]bool{
	fiber.MethodGet:     true,
	fiber.MethodHead:    true,
	fiber.MethodOptions: true,
}

func CSRF() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if safeMethods[c.Method()] {
			return c.Next()
		}

		cookie := c.Cookies(CSRFCookieName)
		header := c.Get(CSRFHeaderName)

		if cookie == "" || header == "" || subtle.ConstantTimeCompare([]byte(cookie), []byte(header)) != 1 {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Token CSRF tidak valid",
			})
		}

		return c.Next()
	}
}
