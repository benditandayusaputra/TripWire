package middleware

import (
	"bytes"
	"encoding/json"
	"slices"

	"github.com/gofiber/fiber/v2"
)

const LanguageCookieName = "tw_bahasa"

var kunciPesan = [][]byte{[]byte(`"error"`), []byte(`"message"`), []byte(`"fields"`)}

func Language() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if c.Cookies(LanguageCookieName) != "en" {
			return c.Next()
		}

		if err := c.Next(); err != nil {
			if err := c.App().ErrorHandler(c, err); err != nil {
				return err
			}
		}

		respons := c.Response()
		if respons.IsBodyStream() || !bytes.HasPrefix(respons.Header.ContentType(), []byte(fiber.MIMEApplicationJSON)) {
			return nil
		}

		body := respons.Body()
		if !slices.ContainsFunc(kunciPesan, func(kunci []byte) bool { return bytes.Contains(body, kunci) }) {
			return nil
		}

		if hasil, diubah := terjemahkan(body, false); diubah {
			return c.Send(hasil)
		}
		return nil
	}
}

func terjemahkan(mentah []byte, semuaKunci bool) ([]byte, bool) {
	var isi map[string]json.RawMessage
	if json.Unmarshal(mentah, &isi) != nil {
		return nil, false
	}

	diubah := false
	for kunci, nilai := range isi {
		switch {
		case !semuaKunci && kunci == "fields":
			if baru, ok := terjemahkan(nilai, true); ok {
				isi[kunci], diubah = baru, true
			}
		case semuaKunci || kunci == "error" || kunci == "message":
			var teks string
			if json.Unmarshal(nilai, &teks) == nil && kamusInggris[teks] != "" {
				isi[kunci], _ = json.Marshal(kamusInggris[teks])
				diubah = true
			}
		}
	}

	if !diubah {
		return nil, false
	}
	hasil, err := json.Marshal(isi)
	return hasil, err == nil
}

var kamusInggris = map[string]string{
	"Akun dibuat, cek email untuk verifikasi":                                  "Account created, check your email to verify it",
	"Akun terkunci sementara karena terlalu banyak percobaan masuk yang gagal": "Your account is temporarily locked after too many failed login attempts",
	"Akun tidak aktif":                                                       "This account is inactive",
	"Authenticator terdaftar":                                                "Authenticator registered",
	"Bahasa yang tersedia hanya id atau en":                                  "Available languages are id or en only",
	"Berhasil keluar":                                                        "You have been logged out",
	"Berkas tidak ditemukan di kolom file":                                   "No file was found in the file field",
	"Bio maksimal 400 karakter":                                              "Bio must be at most 400 characters",
	"Body permintaan bukan JSON yang valid":                                  "The request body is not valid JSON",
	"Challenge WebAuthn tidak valid atau sudah kedaluwarsa":                  "The WebAuthn challenge is invalid or has expired",
	"Config harus berupa objek JSON":                                         "Config must be a JSON object",
	"Data langganan push belum benar":                                        "Please check the push subscription details",
	"Data tidak ditemukan":                                                   "Data not found",
	"Data yang dikirim belum benar":                                          "Please check the details you entered",
	"Dua faktor aktif, simpan kode cadangan ini di tempat aman":              "Two-factor authentication is on, keep these backup codes somewhere safe",
	"Dua faktor belum aktif":                                                 "Two-factor authentication is not on yet",
	"Dua faktor dimatikan":                                                   "Two-factor authentication is turned off",
	"Dua faktor sudah aktif":                                                 "Two-factor authentication is already on",
	"Email atau password salah":                                              "Incorrect email or password",
	"Email berhasil diverifikasi":                                            "Your email has been verified",
	"Email sudah terdaftar":                                                  "This email is already registered",
	"Email terlalu panjang":                                                  "Email is too long",
	"Email wajib diisi":                                                      "Email is required",
	"Endpoint langganan bukan URL yang valid":                                "Subscription endpoint is not a valid URL",
	"Endpoint langganan terlalu panjang":                                     "Subscription endpoint is too long",
	"Endpoint langganan tidak terbaca":                                       "The subscription endpoint could not be read",
	"Endpoint langganan wajib diisi":                                         "Subscription endpoint is required",
	"Endpoint langganan wajib memakai HTTPS":                                 "Subscription endpoint must use HTTPS",
	"Filter notifikasi belum benar":                                          "Please check the notification filters",
	"Format email tidak valid":                                               "Email format is invalid",
	"Format permintaan tidak valid":                                          "The request format is invalid",
	"Halaman tidak ditemukan":                                                "Page not found",
	"Indeks tidak tersedia, pilih IHSG, LQ45, atau IDX30":                    "Index not available, choose IHSG, LQ45, or IDX30",
	"Isi berkas tidak cocok dengan tipe yang diklaim":                        "The file content does not match its stated type",
	"Isi permintaan memuat markup yang tidak diizinkan":                      "The request contains markup that is not allowed",
	"Jenis insight tidak dikenal":                                            "Unknown insight type",
	"Jenis kondisi tidak dikenal":                                            "Unknown condition type",
	"Kalau email belum terverifikasi, tautan baru sudah dikirim":             "If your email is not verified yet, a new link has been sent",
	"Kalau email terdaftar, tautan reset sudah dikirim":                      "If that email is registered, a reset link has been sent",
	"Ketik 6 angka pada gambar yang baru":                                    "Type the 6 digits shown in the new image",
	"Kode captcha salah atau sudah kedaluwarsa":                              "The captcha code is wrong or has expired",
	"Kode captcha sudah kedaluwarsa, muat kode baru":                         "This captcha code has expired, please load a new one",
	"Kode verifikasi salah":                                                  "The verification code is incorrect",
	"Kode verifikasi salah atau sudah kedaluwarsa":                           "The verification code is incorrect or has expired",
	"Kunci Sectors API belum dikonfigurasi":                                  "The Sectors API key has not been configured",
	"Kunci auth tidak valid":                                                 "Invalid auth key",
	"Kunci p256dh tidak valid":                                               "Invalid p256dh key",
	"Masukkan kode verifikasi dua faktor":                                    "Enter your two-factor verification code",
	"Mulai dari langkah setup dulu":                                          "Please start from the setup step first",
	"Nama lengkap maksimal 120 karakter":                                     "Full name must be at most 120 characters",
	"Nama lengkap minimal 2 karakter":                                        "Full name must be at least 2 characters",
	"Nomor telepon antara 8 sampai 20 karakter":                              "Phone number must be 8 to 20 characters",
	"Password berhasil diganti, silakan masuk lagi":                          "Password changed, please log in again",
	"Password maksimal 128 karakter":                                         "Password must be at most 128 characters",
	"Password minimal 10 karakter":                                           "Password must be at least 10 characters",
	"Password salah":                                                         "Incorrect password",
	"Password wajib memuat huruf dan angka":                                  "Password must contain both letters and numbers",
	"Penanda halaman tidak valid":                                            "Invalid page cursor",
	"Peruntukan berkas tidak dikenal":                                        "Unknown file purpose",
	"Preferensi tampilan tidak dikenal":                                      "Unknown display preference",
	"Sectors API sedang bermasalah, permintaan dijeda sementara":             "Sectors API is having trouble, requests are paused for a moment",
	"Sectors API tidak membalas dengan benar":                                "Sectors API did not respond correctly",
	"Sesi tidak valid":                                                       "Invalid session",
	"Sesi tidak valid, silakan masuk lagi":                                   "Your session is no longer valid, please log in again",
	"Sisa credit Sectors API di bawah ambang batas, penyegaran data ditunda": "Sectors API credit is below the safety threshold, data refresh is on hold",
	"Status notifikasi tidak dikenal":                                        "Unknown notification status",
	"Tanda tangan tautan tidak cocok":                                        "The link signature does not match",
	"Tautan berkas sudah kedaluwarsa":                                        "This file link has expired",
	"Tema yang tersedia hanya dark, light, atau system":                      "Available themes are dark, light, or system only",
	"Terjadi kesalahan di server":                                            "Something went wrong on our server",
	"Terlalu banyak permintaan, coba lagi sebentar lagi":                     "Too many requests, please try again in a moment",
	"Ticker sudah ada di watchlist":                                          "This ticker is already in your watchlist",
	"Ticker tidak terdaftar di IDX":                                          "This ticker is not listed on the IDX",
	"Tingkat risiko tidak dikenal":                                           "Unknown risk tier",
	"Tipe berkas tidak diizinkan, avatar hanya menerima JPEG atau PNG":       "This file type is not allowed, avatars accept JPEG or PNG only",
	"Token CSRF tidak valid":                                                 "Invalid CSRF token",
	"Token tidak valid atau sudah kedaluwarsa":                               "The token is invalid or has expired",
	"Ukuran berkas melebihi batas yang diizinkan":                            "The file is larger than the allowed size",
	"Watchlist sudah mencapai batas maksimum":                                "Your watchlist has reached the maximum number of stocks",
	"Web push belum dikonfigurasi di server ini":                             "Web push is not set up on this server",
	"Zona waktu tidak valid":                                                 "Invalid time zone",
	"gagal membaca daftar kolom":                                             "failed to read the column list",
	"gagal membaca daftar tabel":                                             "failed to read the table list",
	"hour_of_day wajib antara 0 sampai 23":                                   "hour_of_day must be between 0 and 23",
	"interval_hours wajib diisi antara 1 sampai 720":                         "interval_hours is required and must be between 1 and 720",
	"min_score wajib antara 0 sampai 100":                                    "min_score must be between 0 and 100",
	"tabel tidak ditemukan":                                                  "table not found",
	"weekday wajib antara 1 sampai 7":                                        "weekday must be between 1 and 7",
}
