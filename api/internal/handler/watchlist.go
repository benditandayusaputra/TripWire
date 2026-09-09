package handler

import (
	"encoding/json"
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type WatchlistHandler struct {
	watchlist *service.WatchlistService
}

func NewWatchlistHandler(watchlist *service.WatchlistService) *WatchlistHandler {
	return &WatchlistHandler{watchlist: watchlist}
}

func (h *WatchlistHandler) List(c *fiber.Ctx) error {
	items, err := h.watchlist.List(c.Context(), middleware.UserID(c))
	if err != nil {
		return serverError(c)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *WatchlistHandler) Add(c *fiber.Ctx) error {
	var input struct {
		Ticker          string `json:"ticker"`
		DataDisplayPref string `json:"data_display_pref"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	item, err := h.watchlist.Add(c.Context(), middleware.UserID(c), input.Ticker, input.DataDisplayPref)
	if err != nil {
		return h.error(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"item": item})
}

func (h *WatchlistHandler) Update(c *fiber.Ctx) error {
	var input struct {
		DataDisplayPref string `json:"data_display_pref"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	item, err := h.watchlist.UpdateDisplayPref(c.Context(), middleware.UserID(c), c.Params("id"), input.DataDisplayPref)
	if err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{"item": item})
}

func (h *WatchlistHandler) Remove(c *fiber.Ctx) error {
	if err := h.watchlist.Remove(c.Context(), middleware.UserID(c), c.Params("id")); err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *WatchlistHandler) ListConditions(c *fiber.Ctx) error {
	conditions, err := h.watchlist.Conditions(c.Context(), middleware.UserID(c), c.Params("id"))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"conditions": conditions})
}

func (h *WatchlistHandler) AddCondition(c *fiber.Ctx) error {
	var input struct {
		ConditionType string          `json:"condition_type"`
		Config        json.RawMessage `json:"config"`
		IsActive      *bool           `json:"is_active"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}

	condition, err := h.watchlist.AddCondition(
		c.Context(), middleware.UserID(c), c.Params("id"), input.ConditionType, input.Config, isActive,
	)
	if err != nil {
		return h.error(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"condition": condition})
}

func (h *WatchlistHandler) UpdateCondition(c *fiber.Ctx) error {
	var input struct {
		Config   json.RawMessage `json:"config"`
		IsActive *bool           `json:"is_active"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	condition, err := h.watchlist.UpdateCondition(
		c.Context(), middleware.UserID(c), c.Params("id"), c.Params("cid"), input.Config, input.IsActive,
	)
	if err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{"condition": condition})
}

func (h *WatchlistHandler) RemoveCondition(c *fiber.Ctx) error {
	err := h.watchlist.RemoveCondition(c.Context(), middleware.UserID(c), c.Params("id"), c.Params("cid"))
	if err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *WatchlistHandler) SearchTickers(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit"))
	tickers := h.watchlist.SearchTickers(c.Query("q"), limit)
	return c.JSON(fiber.Map{"tickers": tickers})
}

func (h *WatchlistHandler) error(c *fiber.Ctx, err error) error {
	var validationErr *service.ValidationError
	if errors.As(err, &validationErr) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Data yang dikirim belum benar",
			"fields": validationErr.Fields,
		})
	}

	switch {
	case errors.Is(err, service.ErrTidakDitemukan):
		return notFound(c)
	case errors.Is(err, service.ErrTickerSudahAda):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Ticker sudah ada di watchlist"})
	default:
		return serverError(c)
	}
}

func notFound(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Data tidak ditemukan"})
}
