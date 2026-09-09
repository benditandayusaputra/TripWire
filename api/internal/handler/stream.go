package handler

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"

	"github.com/benditandayusaputra/tripwire/api/internal/middleware"
	"github.com/benditandayusaputra/tripwire/api/internal/service"
)

const detakStream = 5 * time.Second

type StreamHandler struct {
	hub *service.StreamHub
}

func NewStreamHandler(hub *service.StreamHub) *StreamHandler {
	return &StreamHandler{hub: hub}
}

func (h *StreamHandler) Stream(c *fiber.Ctx) error {
	userID := middleware.UserID(c)
	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Sesi tidak valid"})
	}

	c.Set(fiber.HeaderContentType, "text/event-stream")
	c.Set(fiber.HeaderCacheControl, "no-cache")
	c.Set(fiber.HeaderConnection, "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	saluran, lepas := h.hub.Daftar(context.WithoutCancel(c.Context()), userID)
	koneksi := c.Context().Conn()

	c.Context().SetBodyStreamWriter(fasthttp.StreamWriter(func(w *bufio.Writer) {
		defer lepas()

		latar := context.Background()
		detak := time.NewTicker(detakStream)
		defer detak.Stop()

		terputus := pantauPutus(koneksi)

		if !tulisEvent(w, service.StreamEvent{
			Type: "presence",
			Data: fiber.Map{"online": true, "user_scope": "self"},
			At:   time.Now().UTC().Format(time.RFC3339Nano),
		}) {
			return
		}

		for {
			select {
			case <-terputus:
				return
			case isi, terbuka := <-saluran:
				if !terbuka {
					return
				}
				if _, err := fmt.Fprintf(w, "data: %s\n\n", isi); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			case <-detak.C:
				h.hub.SegarkanPresence(latar, userID)
				if _, err := fmt.Fprint(w, ": detak\n\n"); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return
				}
			}
		}
	}))

	return nil
}

func pantauPutus(koneksi net.Conn) <-chan struct{} {
	terputus := make(chan struct{})

	if koneksi == nil {
		return terputus
	}

	go func() {
		defer close(terputus)

		buf := make([]byte, 1)
		for {
			if err := koneksi.SetReadDeadline(time.Now().Add(detakStream)); err != nil {
				return
			}

			_, err := koneksi.Read(buf)
			if err == nil {
				continue
			}

			var galatJaringan net.Error
			if errors.As(err, &galatJaringan) && galatJaringan.Timeout() {
				continue
			}

			return
		}
	}()

	return terputus
}

func tulisEvent(w *bufio.Writer, event service.StreamEvent) bool {
	isi, err := event.JSON()
	if err != nil {
		return false
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", isi); err != nil {
		return false
	}
	return w.Flush() == nil
}
