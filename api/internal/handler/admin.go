package handler

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type AdminHandler struct {
	admin *service.AdminService
}

func NewAdminHandler(admin *service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

func (h *AdminHandler) Credits(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"credits": h.admin.Credits(c.Context())})
}

func (h *AdminHandler) SchedulerStatus(c *fiber.Ctx) error {
	status, err := h.admin.SchedulerStatus(c.Context())
	if err != nil {
		return serverError(c)
	}
	return c.JSON(fiber.Map{"scheduler": status})
}

func (h *AdminHandler) TriggerScan(c *fiber.Ctx) error {
	if err := h.admin.TriggerScan(c.Context()); err != nil {
		if errors.Is(err, service.ErrScanBerjalan) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Pemindaian lain masih berjalan, tunggu sampai selesai"})
		}
		return serverError(c)
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"status": "berjalan"})
}

func (h *AdminHandler) Users(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit"))

	daftar, err := h.admin.Users(c.Context(), limit)
	if err != nil {
		return serverError(c)
	}

	return c.JSON(fiber.Map{"users": daftar})
}

func (h *AdminHandler) Statistik(c *fiber.Ctx) error {
	stat, err := h.admin.Statistik(c.Context())
	if err != nil {
		return serverError(c)
	}
	return c.JSON(fiber.Map{"stats": stat})
}
