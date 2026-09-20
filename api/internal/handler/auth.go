package handler

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/benditandayusaputra/tripwire/api/config"
	"github.com/benditandayusaputra/tripwire/api/internal/crypto"
	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

type AuthHandler struct {
	cfg  *config.Config
	auth *service.AuthService
}

func NewAuthHandler(cfg *config.Config, auth *service.AuthService) *AuthHandler {
	return &AuthHandler{cfg: cfg, auth: auth}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var input service.RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	user, verificationToken, err := h.auth.Register(c.Context(), input, requestContext(c))
	if err != nil {
		return h.authError(c, err)
	}

	body := fiber.Map{"user": user, "message": "Akun dibuat, cek email untuk verifikasi"}
	if !h.cfg.IsProduction() {
		body["verification_token"] = verificationToken
	}

	return c.Status(fiber.StatusCreated).JSON(body)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	result, err := h.auth.Login(c.Context(), input.Email, input.Password, requestContext(c))
	if err != nil {
		return h.authError(c, err)
	}

	csrfToken, err := crypto.NewOpaqueToken()
	if err != nil {
		return serverError(c)
	}

	h.setSessionCookies(c, result.Tokens, csrfToken)

	return c.JSON(fiber.Map{
		"user":              result.User,
		"csrf_token":        csrfToken,
		"access_expires_at": result.Tokens.AccessExpiresAt,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	userID := middleware.UserID(c)
	refreshToken := c.Cookies(middleware.RefreshCookieName)

	var owner *string
	if userID != "" {
		owner = &userID
	}

	if err := h.auth.Logout(c.Context(), refreshToken, requestContext(c), owner); err != nil {
		return serverError(c)
	}

	h.clearSessionCookies(c)

	return c.JSON(fiber.Map{"message": "Berhasil keluar"})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	refreshToken := c.Cookies(middleware.RefreshCookieName)

	result, err := h.auth.Refresh(c.Context(), refreshToken, requestContext(c))
	if err != nil {
		h.clearSessionCookies(c)
		return h.authError(c, err)
	}

	csrfToken, err := crypto.NewOpaqueToken()
	if err != nil {
		return serverError(c)
	}

	h.setSessionCookies(c, result.Tokens, csrfToken)

	return c.JSON(fiber.Map{
		"user":              result.User,
		"csrf_token":        csrfToken,
		"access_expires_at": result.Tokens.AccessExpiresAt,
	})
}

func (h *AuthHandler) ForgotPassword(c *fiber.Ctx) error {
	var input struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	token, err := h.auth.ForgotPassword(c.Context(), input.Email, requestContext(c))
	if err != nil {
		return serverError(c)
	}

	body := fiber.Map{"message": "Kalau email terdaftar, tautan reset sudah dikirim"}
	if !h.cfg.IsProduction() && token != "" {
		body["reset_token"] = token
	}

	return c.JSON(body)
}

func (h *AuthHandler) ResetPassword(c *fiber.Ctx) error {
	var input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return badRequest(c, "Format permintaan tidak valid")
	}

	if err := h.auth.ResetPassword(c.Context(), input.Token, input.Password, requestContext(c)); err != nil {
		return h.authError(c, err)
	}

	return c.JSON(fiber.Map{"message": "Password berhasil diganti, silakan masuk lagi"})
}

func (h *AuthHandler) VerifyEmail(c *fiber.Ctx) error {
	token := c.Params("token")

	if err := h.auth.VerifyEmail(c.Context(), token, requestContext(c)); err != nil {
		if c.Accepts("text/html") == "text/html" {
			return c.Redirect(h.cfg.FrontendURL+"/login?verified=0", fiber.StatusSeeOther)
		}
		return h.authError(c, err)
	}

	if c.Accepts("text/html") == "text/html" {
		return c.Redirect(h.cfg.FrontendURL+"/login?verified=1", fiber.StatusSeeOther)
	}

	return c.JSON(fiber.Map{"message": "Email berhasil diverifikasi"})
}

func (h *AuthHandler) ResendVerification(c *fiber.Ctx) error {
	token, err := h.auth.ResendEmailVerification(c.Context(), middleware.UserID(c), requestContext(c))
	if err != nil {
		return serverError(c)
	}

	body := fiber.Map{"message": "Kalau email belum terverifikasi, tautan baru sudah dikirim"}
	if !h.cfg.IsProduction() && token != "" {
		body["verification_token"] = token
	}

	return c.JSON(body)
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user, err := h.auth.CurrentUser(c.Context(), middleware.UserID(c))
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid, silakan masuk lagi"})
	}
	return c.JSON(fiber.Map{"user": user})
}

func (h *AuthHandler) setSessionCookies(c *fiber.Ctx, tokens service.TokenPair, csrfToken string) {
	c.Cookie(h.cookie(middleware.AccessCookieName, tokens.AccessToken, tokens.AccessExpiresAt, true))
	c.Cookie(h.cookie(middleware.RefreshCookieName, tokens.RefreshToken, tokens.RefreshExpires, true))
	c.Cookie(h.cookie(middleware.CSRFCookieName, csrfToken, tokens.RefreshExpires, false))
}

func (h *AuthHandler) clearSessionCookies(c *fiber.Ctx) {
	expired := time.Now().Add(-time.Hour)
	c.Cookie(h.cookie(middleware.AccessCookieName, "", expired, true))
	c.Cookie(h.cookie(middleware.RefreshCookieName, "", expired, true))
	c.Cookie(h.cookie(middleware.CSRFCookieName, "", expired, false))
}

func (h *AuthHandler) cookie(name, value string, expires time.Time, httpOnly bool) *fiber.Cookie {
	return &fiber.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Domain:   h.cfg.CookieDomain,
		Expires:  expires,
		Secure:   h.cfg.CookieSecure,
		HTTPOnly: httpOnly,
		SameSite: fiber.CookieSameSiteStrictMode,
	}
}

func (h *AuthHandler) authError(c *fiber.Ctx, err error) error {
	var validationErr *service.ValidationError
	if errors.As(err, &validationErr) {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
			"error":  "Data yang dikirim belum benar",
			"fields": validationErr.Fields,
		})
	}

	var lockedErr *service.AccountLockedError
	if errors.As(err, &lockedErr) {
		return c.Status(fiber.StatusLocked).JSON(fiber.Map{
			"error":        "Akun terkunci sementara karena terlalu banyak percobaan masuk yang gagal",
			"locked_until": lockedErr.Until,
		})
	}

	switch {
	case errors.Is(err, service.ErrEmailTaken):
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email sudah terdaftar"})
	case errors.Is(err, service.ErrInvalidCredentials):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Email atau password salah"})
	case errors.Is(err, service.ErrAccountInactive):
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Akun tidak aktif"})
	case errors.Is(err, service.ErrInvalidToken):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token tidak valid atau sudah kedaluwarsa"})
	default:
		return serverError(c)
	}
}

func requestContext(c *fiber.Ctx) service.RequestContext {
	return service.RequestContext{IPAddress: c.IP(), UserAgent: c.Get(fiber.HeaderUserAgent)}
}

func badRequest(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": message})
}

func serverError(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Terjadi kesalahan di server"})
}
