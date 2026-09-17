package handler

import (
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
	hasil, err := h.admin.TriggerScan(c.Context())
	if err != nil {
		return serverError(c)
	}
	return c.JSON(fiber.Map{"run": hasil})
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
