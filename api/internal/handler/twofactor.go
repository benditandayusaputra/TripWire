package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type TwoFactorHandler struct {
	twoFactor *service.TwoFactorService
	webauthn  *service.WebAuthnService
}

func NewTwoFactorHandler(twoFactor *service.TwoFactorService, webauthn *service.WebAuthnService) *TwoFactorHandler {
	return &TwoFactorHandler{twoFactor: twoFactor, webauthn: webauthn}
}

func (h *TwoFactorHandler) Status(c *fiber.Ctx) error {
	status, err := h.twoFactor.Status(c.Context(), middleware.UserID(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"two_factor": status})
}

func (h *TwoFactorHandler) Setup(c *fiber.Ctx) error {
	setup, err := h.twoFactor.Setup(c.Context(), middleware.UserID(c), requestContext(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"setup": setup})
}

func (h *TwoFactorHandler) Verify(c *fiber.Ctx) error {
	var input struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	kode, err := h.twoFactor.Verify(c.Context(), middleware.UserID(c), input.Code, requestContext(c))
	if err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{
		"message":      "Dua faktor aktif, simpan kode cadangan ini di tempat aman",
		"backup_codes": kode,
	})
}

func (h *TwoFactorHandler) Disable(c *fiber.Ctx) error {
	var input struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	if err := h.twoFactor.Disable(c.Context(), middleware.UserID(c), input.Password, requestContext(c)); err != nil {
		return h.error(c, err)
	}

	return c.JSON(fiber.Map{"message": "Dua faktor dimatikan"})
}

func (h *TwoFactorHandler) BackupCodes(c *fiber.Ctx) error {
	kode, err := h.twoFactor.RegenerateBackupCodes(c.Context(), middleware.UserID(c), requestContext(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"backup_codes": kode})
}

func (h *TwoFactorHandler) RegisterOptions(c *fiber.Ctx) error {
	opsi, err := h.webauthn.RegisterOptions(c.Context(), middleware.UserID(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(opsi)
}

func (h *TwoFactorHandler) RegisterVerify(c *fiber.Ctx) error {
	label := c.Query("device_label")
	if err := h.webauthn.RegisterVerify(c.Context(), middleware.UserID(c), label, c.Body(), requestContext(c)); err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"message": "Authenticator terdaftar"})
}

func (h *TwoFactorHandler) LoginOptions(c *fiber.Ctx) error {
	var input struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	opsi, err := h.webauthn.LoginOptions(c.Context(), input.Email)
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(opsi)
}

func (h *TwoFactorHandler) Credentials(c *fiber.Ctx) error {
	daftar, err := h.webauthn.Credentials(c.Context(), middleware.UserID(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.JSON(fiber.Map{"credentials": daftar})
}

func (h *TwoFactorHandler) HapusCredential(c *fiber.Ctx) error {
	err := h.webauthn.HapusCredential(c.Context(), middleware.UserID(c), c.Params("id"), requestContext(c))
	if err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TwoFactorHandler) error(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, service.ErrWebAuthnNonaktif):
		return notFound(c)
	case errors.Is(err, service.ErrTidakDitemukan):
		return notFound(c)
	case errors.Is(err, service.ErrTOTPSudahAktif):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Dua faktor sudah aktif"})
	case errors.Is(err, service.ErrTOTPBelumAktif):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Dua faktor belum aktif"})
	case errors.Is(err, service.ErrTOTPBelumDisiapkan):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Mulai dari langkah setup dulu"})
	case errors.Is(err, service.ErrKodeTOTPSalah):
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Kode verifikasi salah",
			"fields": fiber.Map{"code": "Kode verifikasi salah atau sudah kedaluwarsa"},
		})
	case errors.Is(err, service.ErrPasswordSalah):
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Password salah",
			"fields": fiber.Map{"password": "Password salah"},
		})
	case errors.Is(err, service.ErrChallengeHabis):
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error": "Challenge WebAuthn tidak valid atau sudah kedaluwarsa",
		})
	default:
		return serverError(c)
	}
}
