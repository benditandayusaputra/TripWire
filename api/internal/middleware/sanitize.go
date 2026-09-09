package middleware

import (
	"encoding/json"
	"regexp"

	"github.com/gofiber/fiber/v2"
)

var polaBerbahaya = regexp.MustCompile(`(?i)<\s*/?\s*(script|iframe|object|embed|style|link)\b|javascript:|on[a-z]+\s*=`)

func XSSSanitize() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if safeMethods[c.Method()] {
			return c.Next()
		}

		body := c.Body()
		if len(body) == 0 {
			return c.Next()
		}

		var payload any
		if err := json.Unmarshal(body, &payload); err != nil {
			return c.Next()
		}

		if mengandungMarkup(payload) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error": "Isi permintaan memuat markup yang tidak diizinkan",
			})
		}

		return c.Next()
	}
}

func mengandungMarkup(node any) bool {
	switch nilai := node.(type) {
	case string:
		return polaBerbahaya.MatchString(nilai)
	case []any:
		for _, anak := range nilai {
			if mengandungMarkup(anak) {
				return true
			}
		}
	case map[string]any:
		for kunci, anak := range nilai {
			if polaBerbahaya.MatchString(kunci) || mengandungMarkup(anak) {
				return true
			}
		}
	}
	return false
}
