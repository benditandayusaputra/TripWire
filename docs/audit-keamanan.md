# TripWire: Hasil Audit Keamanan Fase 14

Audit ini menelusuri tiap butir di `tripwire-security-design.md` terhadap kode yang benar benar
berjalan, bukan terhadap niat. Kolom bukti menunjuk berkas implementasi atau test yang
membuktikannya.

## 1. Autentikasi

| Butir | Status | Bukti |
|---|---|---|
| `bcrypt(salt + password)`, salt disimpan terpisah | Aktif | `internal/crypto/password.go`, kolom `password_salt` |
| Account lockout di database, bukan cuma rate limit Redis | Aktif | `UserRepository.RegisterFailedLogin`, test lockout fase 14 |
| JWT access stateless, tanpa roundtrip DB tiap request | Aktif | `internal/crypto/jwt.go`, `middleware.RequireAuth` |
| Refresh token whitelist, yang tersimpan `token_hash` | Aktif | `TokenRepository`, rotasi diuji di fase 3 |
| Revoke per device dan revoke semua device | Aktif | `/account/sessions`, halaman perangkat |
| Blocklist access token di Redis | Tidak dibuat | Ditandai opsional di dokumen, TTL access token 15 menit |

## 2. Verifikasi Dua Faktor dan Device

| Butir | Status | Bukti |
|---|---|---|
| `totp_secret` dienkripsi AES-GCM, kunci terpisah dari database | Aktif | `internal/crypto/aesgcm.go`, `TOTP_ENCRYPTION_KEY` |
| `totp_enabled` terpisah dari keberadaan secret | Aktif | `TwoFactorService.Status` |
| Backup codes ter-hash, bukan dienkripsi | Aktif | `crypto.HashToken` di `regenerateBackupCodes` |
| WebAuthn di balik feature flag config, bukan kolom DB | Aktif | `FEATURE_WEBAUTHN`, `WebAuthnService.Aktif` |
| Satu baris `refresh_tokens` sama dengan satu device | Aktif | `/account/sessions` |

## 3. Kontrol Akses

| Butir | Status | Bukti |
|---|---|---|
| Ownership check `WHERE user_id` di tiap query | Aktif | Seluruh repository watchlist, file, notifikasi |
| Balas 404, bukan 403, untuk resource milik orang lain | Aktif | Test ownership fase 4, test admin fase 13 |
| Middleware `RequireAuth` dan `RequireAdmin` di router | Aktif | `internal/handler/router.go` |
| Tabel `roles` dengan kolom `permissions` JSONB | Sebagian | Tabel dan seed ada, pengecekan masih memakai nama role |

## 4. Integritas Data

| Butir | Status | Bukti |
|---|---|---|
| Ed25519 menandatangani tiap insight | Aktif | `internal/crypto/insight.go` |
| Hash chain `prev_hash` ke `current_hash` | Aktif | `InsightRepository.Append` dengan advisory lock |
| Public key dipublish di endpoint verifikasi publik | Aktif | `GET /insights/verify/:id` |
| Checksum SHA-256 tiap baris `files` | Aktif | Dihitung ulang saat berkas dibaca |

## 5. Transport dan Notifikasi

| Butir | Status | Bukti |
|---|---|---|
| HSTS untuk memaksa HTTPS | Aktif di production | `middleware.SecurityHeaders`, sengaja mati di dev http |
| VAPID ECDSA P-256 | Aktif | `pkg/webpush` |
| Payload push dienkripsi AES128GCM lewat ECDH | Aktif | `pkg/webpush` |
| Signed URL HMAC-SHA256 dengan `exp` dan `sig` | Aktif | `internal/crypto/signedurl.go` |
| Perbandingan signature pakai `hmac.Equal` | Aktif | `URLSigner.Verify` |

## 6. Perlindungan Endpoint

| Butir | Status | Bukti |
|---|---|---|
| Security headers di API | Aktif | CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| CSP di halaman frontend | Aktif | `app/vite.config.ts`, diuji tanpa pelanggaran di lima halaman |
| Cookie httpOnly, Secure, SameSite Strict | Aktif | Diuji lewat header `Set-Cookie` mentah |
| CSRF token di tiap permintaan yang mengubah data | Aktif | Diuji di lima endpoint berbeda, termasuk token milik sesi lain |
| Rate limiting login, register, tambah watchlist | Aktif | Diuji sampai menerima 429 dan header `Retry-After` |
| Middleware sanitize body sebelum data disimpan | Aktif | Watchlist, profil, dan langganan push |
| Parameterized query di semua akses database | Aktif | Tidak ada SQL yang dirakit dari input |
| Validasi ticker terhadap daftar resmi IDX | Aktif | Ticker asing tidak pernah diteruskan ke Sectors |
| Upload dibatasi MIME allowlist dan ukuran | Aktif | Tipe disimpulkan dari isi berkas, bukan dari klaim klien |
| CORS dibatasi origin frontend, bukan wildcard | Aktif | Diuji dengan origin penyerang |

## 7. Privasi Identifier

| Butir | Status | Bukti |
|---|---|---|
| UUIDv7 sebagai primary key | Aktif | Default `uuidv7()` di skema |
| `users.id` tidak pernah muncul di endpoint publik | Aktif | Endpoint publik hanya landing, login, register, verifikasi insight |
| Hanya `insight_events.id` yang sengaja publik | Aktif | Dipakai halaman verifikasi mandiri |

## 8. Operasional

| Butir | Status | Bukti |
|---|---|---|
| Circuit breaker credit Sectors | Aktif | `pkg/sectorsclient`, diuji di fase 5 |
| `govulncheck` jalan di CI tiap push | Aktif | `.github/workflows/ci.yml` |
| `auth_audit_log` mencatat kejadian sensitif | Aktif | Register, login, lockout, reset, 2FA, sesi, berkas |
| Semua secret lewat env var, `.env` di-gitignore | Aktif | Hanya `.env.example` yang masuk repo |

## Field yang tidak boleh ikut ter-serialize

`password_hash`, `password_salt`, `totp_secret`, dan `token_hash` ditandai `json:"-"`. Diuji dengan
menembak empat endpoint akun sekaligus dan memastikan tidak satu pun namanya muncul di respons.

## Temuan yang diperbaiki di fase ini

1. `govulncheck` belum pernah dijalankan sama sekali. Setelah dijalankan, ditemukan 20 kerentanan
   standard library yang terjangkau kode. Toolchain Go dinaikkan sampai hasil pemindaian nol
   kerentanan terjangkau, dan pemindaian itu sekarang jalan tiap push lewat CI.
2. Halaman frontend belum punya CSP sama sekali. Dokumen menyebut CSP sebagai lapisan XSS di sisi
   browser, jadi CSP dipasang di SvelteKit dan diuji tidak menimbulkan pelanggaran.
3. HSTS belum ada padahal dokumen mewajibkan seluruh trafik lewat HTTPS. Dipasang khusus di
   production supaya pengembangan lokal lewat http tetap jalan.
4. CSP di API masih `default-src 'self'` padahal API tidak pernah melayani halaman. Diperketat jadi
   `default-src 'none'` dan ditambah Permissions-Policy.
5. Endpoint ubah profil belum melewati middleware sanitize, padahal menerima teks bebas yang
   disimpan. Sekarang ikut dikawal.

## Yang sengaja tidak dikerjakan

- Blocklist access token di Redis. Dokumen menandainya opsional, dan umur access token 15 menit
  membuat jendela penyalahgunaannya sempit.
- Pengecekan izin granular dari kolom `permissions` JSONB. Model akses TripWire ownership based,
  dan satu satunya pembeda role saat ini adalah admin. Kolomnya sudah ada sehingga penambahan izin
  nanti tidak perlu migrasi.
- CSRF pada `POST /auth/refresh` dan `POST /auth/password/reset`. Yang pertama dijaga cookie
  SameSite Strict, yang kedua dijaga token reset sekali pakai yang tidak pernah dikirim otomatis
  oleh browser.
