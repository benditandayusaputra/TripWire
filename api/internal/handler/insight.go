package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type InsightHandler struct {
	insight *service.InsightService
}

func NewInsightHandler(insight *service.InsightService) *InsightHandler {
	return &InsightHandler{insight: insight}
}

func (h *InsightHandler) RedFlag(c *fiber.Ctx) error {
	hasil, err := h.insight.RedFlag(c.Context(), c.Params("ticker"))
	if err != nil {
		return sectorsError(c, err)
	}
	return c.JSON(hasil)
}

func (h *InsightHandler) MarketIntelligence(c *fiber.Ctx) error {
	hasil, err := h.insight.MarketIntelligence(c.Context(), c.Params("ticker"))
	if err != nil {
		return sectorsError(c, err)
	}
	return c.JSON(hasil)
}
