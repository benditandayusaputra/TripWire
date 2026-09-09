package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type IntegrityHandler struct {
	integrity *service.IntegrityService
}

func NewIntegrityHandler(integrity *service.IntegrityService) *IntegrityHandler {
	return &IntegrityHandler{integrity: integrity}
}

func (h *IntegrityHandler) Verify(c *fiber.Ctx) error {
	hasil, err := h.integrity.Verify(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, service.ErrTidakDitemukan) {
			return notFound(c)
		}
		return serverError(c)
	}

	if !hasil.Valid {
		return c.Status(fiber.StatusConflict).JSON(hasil)
	}

	return c.JSON(hasil)
}
