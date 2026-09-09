# TripWire: Security Design

## 1. Autentikasi
- Password: `bcrypt(salt + password)`, `password_salt` disimpan terpisah dari `password_hash`
- Account lockout: `failed_login_attempts` + `locked_until` di tabel users, lapisan pertahanan yang tetap ada di database, gak cuma ngandelin rate limit Redis yang bisa reset kalau Redis restart
- JWT dual-token: access token stateless (~15 menit, validasi cukup dari signature, gak nyentuh DB tiap request), refresh token stateful (whitelist di `refresh_tokens`, yang tersimpan `token_hash`, bukan token mentah)
- Revoke per device lewat `refresh_tokens.revoked_at`, atau revoke semua device sekaligus
- Opsional buat kasus darurat: blocklist access token di Redis dengan TTL yang disamain sisa umur tokennya, buat instant-kill akun yang kebobol tanpa nunggu access token expired natural

## 2. Verifikasi Dua Faktor & Device
- TOTP: `totp_secret` dienkripsi (bukan sekadar di-hash) pakai AES-GCM dengan key terpisah dari database itu sendiri, karena beda sama password yang cukup dibandingin lewat hash, TOTP secret harus bisa didekripsi lagi buat generate kode verifikasi. `totp_enabled` statusnya terpisah, karena generate secret belum tentu berarti udah aktif. Backup codes tersimpan ter-hash (bukan dienkripsi) di `totp_backup_codes`, karena itu cuma perlu dicocokin sekali pakai, gak perlu dibalikin ke bentuk asli
- WebAuthn: fingerprint/Face ID/security key, credential tersimpan di `webauthn_credentials` (public key COSE, sign_count buat deteksi kloning), toggle nyala matinya lewat feature flag config, bukan kolom database
- Session/device management: satu baris `refresh_tokens` = satu device yang login, bisa dicabut individual atau semua sekaligus dari halaman Akun

## 3. Kontrol Akses
- Role sebagai tabel (`roles`) dengan kolom `permissions` JSONB, bukan string hardcoded, biar nambah role atau ubah hak akses gak perlu migrasi
- Model utamanya ownership-based, bukan RBAC granular: tiap query nempel `WHERE user_id = ?`, karena bentuk data TripWire itu privat per akun, bukan multi-role atas resource bersama
- Response 404 (bukan 403) kalau resource ada tapi bukan milik pemanggil, biar ID yang valid tapi bukan hak akses gak kebocor keberadaannya
- Middleware `RequireAuth` dan `RequireAdmin` bertingkat, dipasang di router, bukan pengecekan manual di tiap handler

## 4. Integritas Data
- Tiap `insight_events` ditandatangani Ed25519 begitu dibuat, public key dipublish di endpoint publik (`/insights/verify/:id`) buat verifikasi independen oleh siapa pun termasuk juri
- Hash chain: `prev_hash` → `current_hash` (SHA-256) antar insight, kalau ada satu record yang diubah di tengah, semua hash sesudahnya bakal mismatch pas diverifikasi ulang
- Checksum SHA-256 di tiap baris `files`, buat deteksi kalau file di storage korup atau berubah dari yang aslinya diupload

## 5. Transport & Notifikasi
- Semua traffic wajib HTTPS, ini juga prasyarat PWA buat service worker
- VAPID (ECDSA P-256): membuktikan identitas pengirim push notification ke browser
- Payload push dienkripsi AES128GCM lewat ECDH (`p256dh` + `auth` key dari subscription), ini lapisan terpisah dari signature VAPID, satu buat identitas pengirim, satu buat kerahasiaan isi pesan
- Akses ke `files` lewat signed URL ber-TTL (HMAC-SHA256, `exp` + `sig` di query param, dibandingkan pakai `hmac.Equal` buat cegah timing attack), bukan URL publik permanen

## 6. Perlindungan Endpoint
- Security headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Cookie httpOnly, Secure, SameSite=Strict; CSRF token di tiap request yang mengubah data
- Rate limiting via Redis (INCR + EXPIRE) di endpoint login, register, dan tambah watchlist
- XSS: CSP di atas jadi lapisan browser-side; middleware sanitize/block dipasang buat validasi request body sebelum data disimpan atau diproses; Svelte sendiri auto-escape tiap binding `{value}`, satu satunya titik rawan kalau nanti ada pemakaian `{@html}` buat nampilin teks dari payload insight (misalnya alasan suspend), itu wajib disanitize dulu sebelum dirender
- Parameterized query di semua akses database, gak ada raw SQL yang di-concat manual
- Validasi ticker terhadap daftar resmi IDX sebelum dipakai di request manapun ke Sectors API atau disimpan ke watchlist, cegah input sembarangan nyasar ke path request eksternal atau nyampah di data
- Upload file dibatasi MIME type allowlist (image/jpeg, image/png buat avatar) dan ukuran maksimum, ditolak di validasi sebelum nyampe ke storage
- CORS dibatasi cuma origin frontend TripWire sendiri, gak wildcard

## 7. Privasi Identifier
- ID pakai UUIDv7 buat performa index, tapi `users.id` gak pernah di-expose di endpoint publik manapun (login lewat email/password, bukan lewat ID di URL), jadi risiko kebocoran waktu signup lewat timestamp yang ketanam di ID-nya rendah
- Satu satunya ID yang sengaja publik cuma `insight_events.id` lewat endpoint verify, dan itu aman karena waktu generate insight memang udah ditampilkan terbuka di Detail Insight juga

## 8. Operasional
- Circuit breaker credit Sectors API: cek sisa credit di Redis dulu sebelum manggil, skip refresh non-kritis kalau di bawah ambang batas
- `govulncheck` jalan di CI (GitHub Actions) tiap push, cek kerentanan dependency Go
- `auth_audit_log` mencatat semua kejadian sensitif akun (login gagal, ganti password, revoke token, dst), `ON DELETE SET NULL` biar jejaknya tetap ada meski akunnya dihapus
- Semua secret (DB password, JWT signing key, VAPID key, HMAC signed-URL secret, key enkripsi TOTP, Sectors API key) lewat env var atau secret manager, `.env` di-gitignore, cuma `.env.example` yang masuk repo

## Field yang tidak boleh pernah ikut ke-serialize
`password_hash`, `password_salt`, `totp_secret`: tag `json:"-"` di struct Go, di semua endpoint termasuk admin.
