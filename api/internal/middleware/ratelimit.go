package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
)

type KeyFunc func(*fiber.Ctx) string

func ClientIP(c *fiber.Ctx) string {
	return digest(c.IP())
}

func ClientIPAndEmail(c *fiber.Ctx) string {
	var payload struct {
		Email string `json:"email"`
	}
	_ = json.Unmarshal(c.Body(), &payload)

	return digest(c.IP() + "|" + strings.ToLower(strings.TrimSpace(payload.Email)))
}

func RateLimit(client *redis.Client, scope string, limit int, window time.Duration, key KeyFunc) fiber.Handler {
	return func(c *fiber.Ctx) error {
		redisKey := fmt.Sprintf("ratelimit:%s:%s", scope, key(c))

		count, err := client.Incr(c.Context(), redisKey).Result()
		if err != nil {
			return c.Next()
		}
		if count == 1 {
			client.Expire(c.Context(), redisKey, window)
		}

		remaining := limit - int(count)
		if remaining < 0 {
			remaining = 0
		}
		c.Set("X-RateLimit-Limit", strconv.Itoa(limit))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))

		if int(count) > limit {
			ttl, _ := client.TTL(c.Context(), redisKey).Result()
			c.Set("Retry-After", strconv.Itoa(int(ttl.Seconds())))
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Terlalu banyak permintaan, coba lagi sebentar lagi",
			})
		}

		return c.Next()
	}
}

func digest(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:8])
}
