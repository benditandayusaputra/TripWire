# TripWire

Red flag detector dan market intelligence untuk saham IDX. Submission Sectors Hackathon 2026.

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
cp .env.example .env
createdb tripwire

cd api && go run ./cmd/migrate up
cd api && go run ./cmd/api

cd app && npm install && npm run dev
```

Backend jalan di `http://localhost:8080`, frontend di `http://localhost:5173`.

## Akun Demo

```bash
cd api && go run ./cmd/seed
```

Daftar akun, password, dan cara mengisi feed insight ada di `docs/akun-demo.md`.

## Test

```bash
npm install
npx playwright install chromium
npm test
```

Playwright menyalakan backend dan frontend sendiri lewat konfigurasi `webServer`.
