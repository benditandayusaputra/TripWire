package service

import (
	"fmt"
	"log"
)

type Mailer struct {
	frontendURL string
	apiURL      string
}

func NewMailer(frontendURL, apiURL string) *Mailer {
	return &Mailer{frontendURL: frontendURL, apiURL: apiURL}
}

func (m *Mailer) SendEmailVerification(email, token string) {
	link := fmt.Sprintf("%s/auth/verify-email/%s", m.apiURL, token)
	log.Printf("mailer: verifikasi email untuk %s, tautan %s", email, link)
}

func (m *Mailer) SendPasswordReset(email, token string) {
	link := fmt.Sprintf("%s/reset-password?token=%s", m.frontendURL, token)
	log.Printf("mailer: reset password untuk %s, tautan %s", email, link)
}
