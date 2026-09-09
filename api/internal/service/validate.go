package service

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
)

var ErrValidation = errors.New("service: input tidak valid")

type ValidationError struct {
	Fields map[string]string
}

func (e *ValidationError) Error() string {
	return ErrValidation.Error()
}

func (e *ValidationError) Is(target error) bool {
	return target == ErrValidation
}

func newValidationError() *ValidationError {
	return &ValidationError{Fields: map[string]string{}}
}

func (e *ValidationError) add(field, message string) {
	e.Fields[field] = message
}

func (e *ValidationError) orNil() error {
	if len(e.Fields) == 0 {
		return nil
	}
	return e
}

func normalizeEmail(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func validateEmail(v *ValidationError, email string) {
	if email == "" {
		v.add("email", "Email wajib diisi")
		return
	}
	if len(email) > 254 {
		v.add("email", "Email terlalu panjang")
		return
	}
	if _, err := mail.ParseAddress(email); err != nil {
		v.add("email", "Format email tidak valid")
	}
}

func validatePassword(v *ValidationError, password string) {
	if len(password) < 10 {
		v.add("password", "Password minimal 10 karakter")
		return
	}
	if len(password) > 128 {
		v.add("password", "Password maksimal 128 karakter")
		return
	}

	var hasLetter, hasDigit bool
	for _, r := range password {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		v.add("password", "Password wajib memuat huruf dan angka")
	}
}

func validateFullName(v *ValidationError, fullName string) {
	trimmed := strings.TrimSpace(fullName)
	if len(trimmed) < 2 {
		v.add("full_name", "Nama lengkap minimal 2 karakter")
		return
	}
	if len(trimmed) > 120 {
		v.add("full_name", "Nama lengkap maksimal 120 karakter")
	}
}
