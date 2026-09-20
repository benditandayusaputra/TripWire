package handler

import (
	"slices"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type HealthHandler struct {
	health *service.HealthService
}

func NewHealthHandler(health *service.HealthService) *HealthHandler {
	return &HealthHandler{health: health}
}

func (h *HealthHandler) Health(c *fiber.Ctx) error {
	status := h.health.Check(c.Context())
	if status.Status != "ok" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(status)
	}
	return c.JSON(status)
}

func (h *HealthHandler) Tables(c *fiber.Ctx) error {
	names, err := h.health.TableNames(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "gagal membaca daftar tabel",
		})
	}

	body := fiber.Map{"count": len(names), "tables": names}

	if table := c.Query("columns"); table != "" {
		if !slices.Contains(names, table) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "tabel tidak ditemukan",
			})
		}
		columns, err := h.health.ColumnNames(c.Context(), table)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "gagal membaca daftar kolom",
			})
		}
		body["columns"] = columns
	}

	return c.JSON(body)
}
