Kamu akan membangun TripWire, aplikasi red flag detector dan market intelligence untuk saham IDX, submission untuk Sectors Hackathon 2026.

Sebelum mulai, baca semua dokumen ini di folder `docs/` (harus ada di root proyek):
- `prd.md`, gambaran produk, tujuan, dan batasan
- `menu-fitur.md`, peta halaman dan fitur lengkap
- `schema.sql`, skema database final
- `api-routes.md`, kontrak endpoint
- `security-design.md`, seluruh lapisan keamanan yang wajib diterapkan
- `architecture.md`, struktur folder backend dan frontend
- `red-flag-formula.md`, formula skoring Red Flag Detector

Stack: backend Go dengan Fiber (clean architecture: handler, service, repository), PostgreSQL 18 ke atas, Redis. Frontend SvelteKit sebagai PWA.

## Aturan Kerja
1. Kerjakan bertahap sesuai fase di bawah, urut, jangan loncat.
2. Tiap fase wajib ditutup dengan test Playwright yang membuktikan fase itu benar benar jalan, bukan cuma "kode ke-compile". Untuk fase backend murni tanpa UI, pakai Playwright request context (API testing, bukan browser) langsung ke endpoint-nya. Untuk fase yang punya tampilan, pakai Playwright browser test menyusuri alurnya dari sisi pengguna.
3. Jangan lanjut ke fase berikutnya sebelum test fase saat ini lulus. Kalau gagal, debug dan perbaiki dulu.
4. Ikuti `security-design.md` secara ketat di fase yang relevan, bukan ditunda ke akhir. Ownership check, rate limiting, dan validasi input dibangun bersamaan dengan fitur yang bersangkutan, bukan ditempel belakangan.
5. Semua secret lewat env var, gak ada yang di-hardcode. Buat `.env.example` di fase pertama.
6. Kalau ada detail kecil yang gak dijelasin persis di dokumen, ambil keputusan yang paling konsisten sama pola yang sudah ada di dokumen dan tulis alasannya di komentar kode, jangan berhenti buat nanya kalau keputusannya kecil dan reversibel.
7. Commit setelah tiap fase lulus test-nya, dengan pesan commit yang nyebut fase dan apa yang diverifikasi.

## Fase 1: Setup Proyek
Scaffold folder backend dan frontend persis sesuai struktur di `architecture.md`. Setup Playwright (`@playwright/test`) di root proyek. Buat endpoint `GET /health` yang query `SELECT 1` ke Postgres dan cek koneksi Redis.
Test: Playwright request test memanggil `/health`, pastikan status 200 dan body menunjukkan Postgres dan Redis sama sama terkoneksi.

## Fase 2: Migrasi Database
Jalankan `schema.sql` sebagai migrasi awal. Setup tooling migrasi (golang-migrate atau setara).
Test: Playwright request test lewat endpoint sementara yang list nama semua tabel, pastikan ke 14 tabel dari schema.sql ada semua.

## Fase 3: Autentikasi Inti
Register, login, logout, refresh token, password reset, verifikasi email, account lockout setelah beberapa kali gagal login. Terapkan `bcrypt(salt + password)`, JWT dual-token, dan whitelist `refresh_tokens` sesuai `security-design.md`.
Test: Playwright browser test, alur register sampai login, verifikasi cookie ter-set dengan flag yang benar (httpOnly, Secure, SameSite), coba login gagal berkali kali sampai lockout aktif, verifikasi pesan lockout muncul.

## Fase 4: Watchlist & Kondisi
CRUD watchlist dan watch_conditions. Terapkan ownership check (`WHERE user_id = ?`, balas 404 bukan 403) di semua endpoint ini.
Test: Playwright browser test, tambah saham ke watchlist, atur kondisi, verifikasi muncul di list. Playwright request test terpisah, coba akses watchlist item milik user lain pakai token user A, pastikan hasilnya 404.

## Fase 5: Sectors API Client & Cache
HTTP client ke Sectors REST API, cache Redis, circuit breaker credit budget sesuai `security-design.md`.
Test: Playwright request test, hit endpoint yang manggil Sectors buat satu ticker, verifikasi response benar, panggil lagi dengan ticker yang sama, verifikasi lebih cepat atau ada penanda cache hit.

## Fase 6: Insight Engine
Implementasikan `red-flag-formula.md` persis (tiga sub-skor, deteksi pola silang, formula gabungan) dan Market Intelligence (termasuk mode mendalam saham tambang).
Test: Playwright request test dengan data fixture yang nilainya sudah dihitung manual dulu, verifikasi skor yang keluar dari sistem cocok sama hasil hitungan manual itu, termasuk kasus cross_multiplier aktif dan gak aktif.

## Fase 7: Integritas Data
Ed25519 signing tiap insight, hash chain (`prev_hash`/`current_hash`).
Test: Playwright request test, generate satu insight, panggil `/insights/verify/:id`, pastikan valid. Ubah manual satu field di payload lewat query langsung ke DB, panggil verify lagi, pastikan sistem mendeteksi tidak valid.

## Fase 8: Notifikasi & Realtime
Web Push (VAPID + AES128GCM), endpoint SSE `/stream`, presence di Redis.
Test: Playwright browser test, subscribe push notification, buka koneksi SSE, picu satu insight baru dari sisi server, verifikasi update muncul di layar tanpa refresh.

## Fase 9: Dua Faktor
TOTP (setup, verifikasi, backup codes) dan WebAuthn (feature-flagged).
Test: Playwright browser test buat alur TOTP penuh. WebAuthn sulit diotomasi penuh tanpa virtual authenticator, cukup verifikasi endpoint generate challenge merespons dengan format yang benar lewat Playwright request test.

## Fase 10: File & Avatar
Upload dengan validasi MIME/ukuran, signed URL ber-TTL.
Test: Playwright browser test, upload avatar, verifikasi tampil. Playwright request test, coba akses signed URL dengan signature yang sengaja diubah, pastikan ditolak.

## Fase 11: Halaman Frontend
Semua halaman dari `menu-fitur.md` yang belum ke-cover fase sebelumnya (Landing, Dashboard, Detail Insight, Akun & Pengaturan).
Test: Playwright browser test navigasi ke tiap halaman utama, pastikan tidak ada error console dan elemen kunci tiap halaman muncul.

## Fase 12: PWA
Manifest dan service worker.
Test: Playwright browser test, verifikasi manifest ter-load dan service worker ter-registrasi lewat `navigator.serviceWorker`.

## Fase 13: Admin Panel
Test: Playwright browser test dengan akun biasa, pastikan akses ke rute admin ditolak. Ulangi dengan akun admin, pastikan berhasil.

## Fase 14: Audit Keamanan Akhir
Tinjau ulang seluruh `security-design.md` sebagai checklist, bukan bikin fitur baru, cuma verifikasi semua yang disebutkan benar benar aktif.
Test: Playwright request test khusus, cek header keamanan (CSP, X-Content-Type-Options, dst) muncul di response, cek request tanpa CSRF token ditolak di endpoint yang mengubah data, cek rate limit aktif di endpoint login setelah beberapa kali percobaan cepat.
