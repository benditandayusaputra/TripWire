package handler

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type AccountHandler struct {
	account *service.AccountService
	feed    *service.FeedService
}

func NewAccountHandler(account *service.AccountService, feed *service.FeedService) *AccountHandler {
	return &AccountHandler{account: account, feed: feed}
}

func (h *AccountHandler) Profile(c *fiber.Ctx) error {
	user, err := h.account.Profile(c.Context(), middleware.UserID(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"user": user})
}

func (h *AccountHandler) UpdateProfile(c *fiber.Ctx) error {
	var input service.ProfileUpdate
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	user, err := h.account.UpdateProfile(c.Context(), middleware.UserID(c), input)
	if err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{"user": user})
}

func (h *AccountHandler) Sessions(c *fiber.Ctx) error {
	sesi, err := h.account.Sessions(c.Context(), middleware.UserID(c), c.Cookies(middleware.RefreshCookieName))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"sessions": sesi})
}

func (h *AccountHandler) RevokeSession(c *fiber.Ctx) error {
	err := h.account.RevokeSession(c.Context(), middleware.UserID(c), c.Params("id"), requestContext(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AccountHandler) RevokeOtherSessions(c *fiber.Ctx) error {
	jumlah, err := h.account.RevokeOtherSessions(
		c.Context(), middleware.UserID(c), c.Cookies(middleware.RefreshCookieName), requestContext(c),
	)
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"revoked": jumlah})
}

func (h *AccountHandler) Feed(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit"))

	item, err := h.feed.Feed(c.Context(), middleware.UserID(c), c.Query("type"), c.Query("ticker"), limit)
	if err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{"insights": item})
}

func (h *AccountHandler) InsightDetail(c *fiber.Ctx) error {
	detail, err := h.feed.Detail(c.Context(), middleware.UserID(c), c.Params("id"))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(detail)
}

func (h *AccountHandler) Ringkasan(c *fiber.Ctx) error {
	ringkasan, err := h.feed.Ringkasan(c.Context(), middleware.UserID(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"summary": ringkasan})
}

func (h *AccountHandler) error(c *fiber.Ctx, err error) error {
	var validationErr *service.ValidationError
	if errors.As(err, &validationErr) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Data yang dikirim belum benar",
			"fields": validationErr.Fields,
		})
	}

	if errors.Is(err, service.ErrTidakDitemukan) {
		return notFound(c)
	}

	return serverError(c)
}
