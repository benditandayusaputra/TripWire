package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type PantauanHandler struct {
	pantauan *service.PantauanService
}

func NewPantauanHandler(pantauan *service.PantauanService) *PantauanHandler {
	return &PantauanHandler{pantauan: pantauan}
}

func (h *PantauanHandler) Ringkasan(c *fiber.Ctx) error {
	ringkasan, err := h.pantauan.Ringkasan(c.Context(), middleware.UserID(c))
	if err != nil {
		return serverError(c)
	}
	return c.JSON(ringkasan)
}

func (h *PantauanHandler) Harga(c *fiber.Ctx) error {
	seri, err := h.pantauan.Harga(c.Context(), middleware.UserID(c), c.Params("id"))
	if errors.Is(err, service.ErrTidakDitemukan) {
		return notFound(c)
	}
	if err != nil {
		return sectorsError(c, err)
	}
	return c.JSON(seri)
}
