package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type FileHandler struct {
	files *service.FileService
}

func NewFileHandler(files *service.FileService) *FileHandler {
	return &FileHandler{files: files}
}

func (h *FileHandler) UploadAvatar(c *fiber.Ctx) error {
	header, err := c.FormFile("file")
	if err != nil {
		return badRequest(c, "Berkas tidak ditemukan di kolom file")
	}

	berkas, err := h.files.SetAvatar(c.Context(), middleware.UserID(c), header, requestContext(c))
	if err != nil {
		return h.error(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"file": berkas})
}

func (h *FileHandler) HapusAvatar(c *fiber.Ctx) error {
	if err := h.files.HapusAvatar(c.Context(), middleware.UserID(c), requestContext(c)); err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *FileHandler) Upload(c *fiber.Ctx) error {
	header, err := c.FormFile("file")
	if err != nil {
		return badRequest(c, "Berkas tidak ditemukan di kolom file")
	}

	purpose := c.FormValue("purpose", model.PurposeAttachment)

	berkas, err := h.files.Upload(c.Context(), middleware.UserID(c), purpose, header, requestContext(c))
	if err != nil {
		return h.error(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"file": berkas})
}

func (h *FileHandler) Hapus(c *fiber.Ctx) error {
	if err := h.files.Hapus(c.Context(), middleware.UserID(c), c.Params("id"), requestContext(c)); err != nil {
		return h.error(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *FileHandler) Ambil(c *fiber.Ctx) error {
	berkas, isi, err := h.files.Ambil(c.Context(), c.Params("id"), c.Query("exp"), c.Query("sig"))
	if err != nil {
		return h.error(c, err)
	}

	c.Set(fiber.HeaderContentType, berkas.MimeType)
	c.Set(fiber.HeaderCacheControl, "private, max-age=60")
	c.Set(fiber.HeaderContentDisposition, `inline; filename="`+berkas.OriginalFilename+`"`)
	c.Set("X-Checksum-SHA256", berkas.ChecksumSHA256)
	c.Set("Cross-Origin-Resource-Policy", "cross-origin")

	return c.Send(isi)
}

func (h *FileHandler) error(c *fiber.Ctx, err error) error {
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
	case errors.Is(err, service.ErrTautanTidakValid):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "Tanda tangan tautan tidak cocok",
			"reason": "signature_invalid",
		})
	case errors.Is(err, service.ErrTautanKedaluwarsa):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "Tautan berkas sudah kedaluwarsa",
			"reason": "expired",
		})
	case errors.Is(err, service.ErrBerkasTerlaluBesar):
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
			"error": "Ukuran berkas melebihi batas yang diizinkan",
		})
	case errors.Is(err, service.ErrTipeTidakDiizinkan):
		return c.Status(fiber.StatusUnsupportedMediaType).JSON(fiber.Map{
			"error": "Tipe berkas tidak diizinkan, avatar hanya menerima JPEG atau PNG",
		})
	case errors.Is(err, service.ErrBerkasRusak):
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error": "Isi berkas tidak cocok dengan tipe yang diklaim",
		})
	default:
		return serverError(c)
	}
}
