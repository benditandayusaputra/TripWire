# TripWire: Rancangan API Endpoint

Akses: **Publik** (gak perlu login) · **User** (butuh access token valid) · **Admin** (User + role admin)

## Auth & Akun

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | /auth/register | Publik | Buat akun baru, kirim email verifikasi |
| POST | /auth/captcha | Publik | Buat captcha 6 angka (gambar PNG base64), jawaban disimpan di Redis 10 menit |
| GET | /auth/captcha/:id/audio | Publik | Versi audio captcha (WAV, bahasa Inggris) untuk pengguna pembaca layar |
| POST | /auth/login | Publik | Wajib `captcha_id` + `captcha_answer` yang cocok (sekali pakai), lalu return access + refresh token, catat ke auth_audit_log |
| POST | /auth/logout | User | Revoke refresh token device ini |
| POST | /auth/refresh | Publik* | Tukar refresh token jadi access token baru (*validasi tetap dari token itu sendiri) |
| POST | /auth/password/forgot | Publik | Generate password_reset_tokens, kirim email |
| POST | /auth/password/reset | Publik | Submit token + password baru |
| GET | /auth/verify-email/:token | Publik | Verifikasi email dari link |
| POST | /auth/verify-email/resend | User | Kirim ulang kalau link kedaluwarsa |

## 2FA & WebAuthn

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | /auth/totp/setup | User | Generate secret + QR code |
| POST | /auth/totp/verify | User | Konfirmasi kode pertama, set totp_enabled |
| POST | /auth/totp/disable | User | Matiin 2FA |
| GET | /auth/totp/backup-codes | User | Generate/tampilkan sekali, langsung di-hash buat disimpan |
| POST | /auth/webauthn/register/options | User | Generate challenge buat registrasi authenticator baru |
| POST | /auth/webauthn/register/verify | User | Verifikasi hasil registrasi, simpan ke webauthn_credentials |
| POST | /auth/webauthn/login/options | Publik | Generate challenge buat login pakai fingerprint/security key |
| POST | /auth/webauthn/login/verify | Publik | Verifikasi assertion, return token kalau valid |
| GET | /auth/webauthn/credentials | User | List authenticator yang terdaftar |
| DELETE | /auth/webauthn/credentials/:id | User | Hapus satu authenticator |

## Sesi & Device

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /account/sessions | User | List refresh_tokens aktif, tampil sebagai "device yang login" |
| DELETE | /account/sessions/:id | User | Revoke satu device |
| DELETE | /account/sessions | User | Revoke semua device ("logout everywhere") |

## Profil

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /account/profile | User | full_name, bio, locale, theme_preference, dst |
| PATCH | /account/profile | User | Update field profil |
| POST | /account/avatar | User | Upload foto, buat baris di files, set avatar_file_id |
| DELETE | /account/avatar | User | Hapus avatar, soft-delete di files |

## Files

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | /files | User | Upload generic (attachment/export) |
| GET | /files/:id | Signed URL | Validasi query param expires + sig sebelum stream isi file |
| DELETE | /files/:id | User (owner) | Soft delete, cek owner_user_id |

## Watchlist & Kondisi

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /watchlist | User | List saham yang dipantau |
| POST | /watchlist | User | Tambah ticker baru |
| PATCH | /watchlist/:id | User (owner) | Ubah data_display_pref |
| DELETE | /watchlist/:id | User (owner) | Hapus dari watchlist |
| GET | /watchlist/:id/conditions | User (owner) | List kondisi trigger buat satu ticker |
| POST | /watchlist/:id/conditions | User (owner) | Tambah kondisi baru |
| PATCH | /watchlist/:id/conditions/:cid | User (owner) | Ubah kondisi (aktif/nonaktif, config) |
| DELETE | /watchlist/:id/conditions/:cid | User (owner) | Hapus kondisi |

Kondisi `recent_event` dan `geopolitical` menyimpan `min_score`. Insight baru hanya dikirim sebagai
notifikasi ke pengguna yang punya minimal satu kondisi aktif yang menerimanya: kondisi berjadwal
(`daily`, `weekly`, `periodic_custom`) selalu menerima, sedangkan kondisi berambang menerima kalau
skor insight mencapai `min_score`. Insight tanpa skor tidak lolos kondisi berambang. Pengguna yang
belum mengatur kondisi apa pun tetap menerima semua insight emiten yang dipantaunya.

## Insight

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /insights | User | Feed insight dari seluruh watchlist, filter ticker/type, paginated |
| GET | /insights/:id | User | Detail satu insight, termasuk payload dan status signature |
| GET | /insights/verify/:id | Publik | Cek validitas signature Ed25519, gak perlu login |

## Notifikasi

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /notifications | User | Riwayat notifikasi, filter `status` (unread, read), `type`, `tier` (critical, high, moderate, low), `ticker`, paginasi `limit` dan `before` (id notifikasi terakhir, balasan memuat `next_cursor`) |
| GET | /notifications/summary | User | KPI kotak masuk, aktivitas 30 hari per tanggal WIB, sebaran tier, emiten yang paling sering memicu, skor tertinggi 30 hari, jumlah perangkat push |
| POST | /notifications/read-all | User | Tandai semua notifikasi dibaca |
| PATCH | /notifications/:id/read | User (owner) | Tandai udah dibuka |
| DELETE | /notifications/:id/read | User (owner) | Kembalikan jadi belum dibaca |
| DELETE | /notifications/:id | User (owner) | Hapus satu notifikasi, insight-nya tetap ada di feed |
| DELETE | /notifications/read | User | Hapus semua notifikasi yang sudah dibaca |
| POST | /push/subscribe | User | Simpan push_subscription (endpoint, p256dh, auth key) |
| DELETE | /push/subscribe/:endpoint | User (owner) | Berhenti langganan push |
| GET | /push/subscriptions | User | Perangkat yang berlangganan push, tanpa kunci enkripsinya |
| POST | /push/test | User | Kirim notifikasi uji ke semua perangkat, maksimal 5 kali per menit per pengguna |

Tier di filter dan ringkasan hanya berlaku untuk insight red flag, memakai batas yang sama dengan
`lib/skor.ts`. Notifikasi market intelligence punya kategori sendiri.

## Realtime

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /stream | User | SSE, insight baru + heartbeat presence |

Insight yang lahir di proses scheduler diteruskan ke proses API lewat Redis pub/sub kanal
`stream:siaran`, lalu dikirim ke koneksi SSE pengguna. Pengguna yang tidak punya presence di Redis
langsung dikirimi web push.

## Admin

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | /admin/system/credits | Admin | Sisa credit Sectors API |
| GET | /admin/system/scheduler-status | Admin | Log run terakhir + status |
| POST | /admin/system/trigger-scan | Admin | Jalanin scheduler manual, buat testing |
| GET | /admin/users | Admin | List user, buat debugging |

## Catatan implementasi
- Endpoint dengan **User (owner)** wajib filter `WHERE user_id = ?` di query, balas 404 (bukan 403) kalau resource ada tapi bukan milik pemanggil.
- Endpoint di grup Admin dipasangin middleware `RequireAdmin` di atas `RequireAuth`, bukan pengecekan manual per handler.
- `/insights/verify/:id` sengaja publik, itu justru fitur (bukti insight gak diubah ubah), bukan celah keamanan.
