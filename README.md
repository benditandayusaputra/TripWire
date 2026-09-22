# TripWire

Red flag detector dan market intelligence untuk saham IDX. Submission Sectors Hackathon 2026,
Track 03 Market Intelligence.

Investor ritel IDX harus mengecek sendiri histori suspend, transaksi insider, dan perubahan
kepemilikan di tempat yang terpisah pisah, padahal risiko tata kelola justru terlihat saat ketiga
sinyal itu muncul berdekatan. TripWire memantau pola silang itu otomatis untuk setiap emiten di
watchlist dan mengabari begitu kondisi yang dipilih pengguna terpenuhi.

TripWire menyajikan informasi dan analisis, bukan rekomendasi beli atau jual, dan tidak pernah
mengeksekusi order.

## Fitur Inti

- Red Flag Score 0 sampai 100 dari tiga sinyal Sectors: suspend, klaster insider, perubahan
  kepemilikan. Skor dikali 1,3 atau 1,6 saat dua atau tiga sinyal muncul dalam jendela 30 hari
  yang sama. Formula lengkap di `docs/tripwire-red-flag-formula.md`.
- Market Intelligence: fundamental dibanding rata rata sektor, dengan mode mendalam untuk emiten
  tambang (eksposur komoditas, radar lisensi).
- Watchlist dengan lima jenis kondisi pemicu, dijalankan scheduler terpisah.
- Notifikasi lewat SSE saat pengguna online dan Web Push saat offline.
- Setiap insight ditandatangani Ed25519 dan tersusun dalam rantai hash. Siapa pun bisa memeriksanya
  di halaman `/verify-insight` tanpa login.
- Cache Redis dan circuit breaker menjaga jatah 1.000 credit Sectors API.
- 2FA TOTP dan WebAuthn, lockout akun, JWT dua token, CSRF, signed URL ber-TTL. Hasil audit ada di
  `docs/audit-keamanan.md`.

## Struktur

| Path | Isi |
|---|---|
| `api/` | Backend Go 1.25 + Fiber, clean architecture |
| `app/` | Frontend SvelteKit 2 PWA |
| `tests/` | Playwright test per fase |
| `docs/` | Spesifikasi produk, schema database, kontrak API, security design |

## Prasyarat

- Go 1.25 atau lebih baru
- Node.js 22 atau lebih baru
- PostgreSQL 18 atau lebih baru, `uuidv7()` dipakai sebagai default primary key
- Redis 7 atau lebih baru

## Menjalankan

```bash
cp api/.env.example api/.env
cp app/.env.example app/.env
createdb tripwire

cd api && go run ./cmd/migrate up
cd api && go run ./cmd/api

cd app && npm install && npm run dev
```

Backend jalan di `http://localhost:8080`, frontend di `http://localhost:5173`. Env backend ada di
`api/.env`, env frontend di `app/.env`, karena keduanya di-deploy ke server berbeda. Panduan deploy
ada di `docs/deploy.md`.

## Akun Demo

```bash
cd api && go run ./cmd/seed
```

Daftar akun, password, dan cara mengisi feed insight ada di `docs/akun-demo.md`. Naskah video
demo ada di `docs/demo-video.md`.

## Test

```bash
npm install
npx playwright install chromium
npm test
```

Playwright menyalakan backend dan frontend sendiri lewat konfigurasi `webServer`.
