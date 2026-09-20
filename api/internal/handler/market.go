package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/service"
	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

type MarketHandler struct {
	market *service.MarketService
}

func NewMarketHandler(market *service.MarketService) *MarketHandler {
	return &MarketHandler{market: market}
}

func (h *MarketHandler) CompanyReport(c *fiber.Ctx) error {
	report, err := h.market.CompanyReport(c.Context(), c.Params("ticker"))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(report)
}

func (h *MarketHandler) Credits(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"meta": h.market.Credits(c.Context())})
}

func (h *MarketHandler) error(c *fiber.Ctx, err error) error {
	var validationErr *service.ValidationError
	if errors.As(err, &validationErr) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Data yang dikirim belum benar",
			"fields": validationErr.Fields,
		})
	}

	switch {
	case errors.Is(err, sectorsclient.ErrTidakDitemukan):
		return notFound(c)
	case errors.Is(err, sectorsclient.ErrCreditHabis):
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":  "Sisa credit Sectors API di bawah ambang batas, penyegaran data ditunda",
			"reason": "credit_budget",
		})
	case errors.Is(err, sectorsclient.ErrCircuitTerbuka):
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":  "Sectors API sedang bermasalah, permintaan dijeda sementara",
			"reason": "circuit_open",
		})
	case errors.Is(err, sectorsclient.ErrKunciBelumDiisi):
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":  "Kunci Sectors API belum dikonfigurasi",
			"reason": "missing_api_key",
		})
	case errors.Is(err, sectorsclient.ErrUpstreamGagal):
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error":  "Sectors API tidak membalas dengan benar",
			"reason": "upstream_error",
		})
	default:
		return serverError(c)
	}
}
