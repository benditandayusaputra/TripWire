package handler

import (
	"encoding/base64"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type NotificationHandler struct {
	notifikasi *service.NotificationService
}

func NewNotificationHandler(notifikasi *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifikasi: notifikasi}
}

func (h *NotificationHandler) List(c *fiber.Ctx) error {
	userID := middleware.UserID(c)

	daftar, belum, err := h.notifikasi.Riwayat(c.Context(), userID, c.QueryInt("limit", 30))
	if err != nil {
		return serverError(c)
	}

	return c.JSON(fiber.Map{
		"notifications": daftar,
		"unread":        belum,
		"online":        h.notifikasi.Online(userID),
	})
}

func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	notifikasi, err := h.notifikasi.TandaiDibaca(c.Context(), middleware.UserID(c), c.Params("id"))
	if err != nil {
		if errors.Is(err, service.ErrTidakDitemukan) {
			return notFound(c)
		}
		return serverError(c)
	}

	return c.JSON(fiber.Map{"notification": notifikasi})
}

func (h *NotificationHandler) VapidPublicKey(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"public_key": h.notifikasi.PublicKeyVAPID(),
		"enabled":    h.notifikasi.PushAktif(),
	})
}

func (h *NotificationHandler) Subscribe(c *fiber.Ctx) error {
	var masukan service.LanggananPush
	if err := c.BodyParser(&masukan); err != nil {
		return badRequest(c, "Body permintaan bukan JSON yang valid")
	}

	langganan, err := h.notifikasi.Berlangganan(c.Context(), middleware.UserID(c), masukan)
	if err != nil {
		var validationErr *service.ValidationError
		if errors.As(err, &validationErr) {
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":  "Data langganan push belum benar",
				"fields": validationErr.Fields,
			})
		}
		return serverError(c)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"subscription": langganan})
}

func (h *NotificationHandler) Unsubscribe(c *fiber.Ctx) error {
	endpoint, err := decodeEndpoint(c.Params("endpoint"))
	if err != nil {
		return badRequest(c, "Endpoint langganan tidak terbaca")
	}

	if err := h.notifikasi.BerhentiBerlangganan(c.Context(), middleware.UserID(c), endpoint); err != nil {
		if errors.Is(err, service.ErrTidakDitemukan) {
			return notFound(c)
		}
		return serverError(c)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func decodeEndpoint(param string) (string, error) {
	param = strings.TrimSpace(param)
	if param == "" {
		return "", errors.New("handler: endpoint kosong")
	}

	for _, encoding := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding} {
		if mentah, err := encoding.DecodeString(param); err == nil && strings.Contains(string(mentah), "://") {
			return string(mentah), nil
		}
	}

	return "", errors.New("handler: endpoint bukan base64url yang valid")
}
