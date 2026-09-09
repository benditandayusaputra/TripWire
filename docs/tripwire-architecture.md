# TripWire: Arsitektur FE & BE

## Backend (Go + Fiber)

```
tripwire-backend/
├── cmd/
│   ├── api/                 # entry point HTTP server
│   └── scheduler/           # entry point terpisah buat background worker
├── internal/
│   ├── handler/              # Fiber routes, parse request → panggil service → format response
│   ├── service/               # business logic: scoring engine, evaluasi kondisi, dispatch notifikasi
│   ├── repository/             # akses DB via sqlx, Safe Query Builder (whitelist-only)
│   ├── middleware/              # RequireAuth, RequireAdmin, RateLimit, CSRF, XSSSanitize, SecurityHeaders
│   ├── model/                    # struct yang map ke tabel (User, WatchlistItem, InsightEvent, dst)
│   ├── crypto/                    # Ed25519 signing, HMAC signed URL, hash chain
│   └── scheduler/                  # definisi cron job (robfig/cron)
├── pkg/
│   ├── sectorsclient/                # HTTP client Sectors API, terintegrasi sama Redis cache
│   └── webpush/                       # wrapper VAPID + Web Push
├── migrations/                          # file SQL yang sudah dibuat (schema, alter avatar_file_id, dst)
└── config/                                # env loading, feature flags (termasuk toggle WebAuthn)
```

Layering mengikuti pola handler → service → repository, dengan ownership check sebagai model kontrol akses utama (bukan RBAC granular), sesuai kebutuhan TripWire.

## Alur Data End-to-End

```
[Scheduler/Cron]
      │  per watch_condition yang is_active dan jadwalnya jatuh tempo
      ▼
[Redis: cek credit budget] ──(credit gak cukup)──> skip, log, coba lagi siklus berikutnya
      │  credit cukup
      ▼
[Redis: cek cache] ──(cache hit, masih fresh)──> langsung lanjut ke Insight Engine
      │  cache miss
      ▼
[Sectors REST API] ──> simpan ke Redis cache
      │
      ▼
[Insight Engine]  (red flag score / market intelligence score)
      │
      ▼
[crypto: Ed25519 sign + hitung hash chain] ──> INSERT ke insight_events
      │
      ▼
[Notification Dispatcher]
      │
      ├─ user online (cek Redis presence:{userID}) ──> push ke SSE stream, browser update langsung
      │
      └─ user offline ──> Web Push (VAPID + AES128GCM) ──> INSERT ke notifications
```

## Frontend (SvelteKit PWA)

```
tripwire-frontend/
├── src/
│   ├── routes/
│   │   ├── (public)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── verify-insight/
│   │   ├── (app)/                  # dijaga hooks.server, redirect ke /login kalau belum auth
│   │   │   ├── dashboard/
│   │   │   ├── watchlist/
│   │   │   ├── insights/[id]/
│   │   │   ├── notifications/
│   │   │   └── account/
│   │   │       └── sessions/        # list & revoke device
│   │   └── (admin)/
│   │       └── admin/
│   ├── stores/
│   │   ├── authStore.ts             # auth state, dual-mode Cookie/Bearer
│   │   ├── watchlistStore.ts
│   │   ├── insightStore.ts
│   │   └── presenceStore.ts         # baru, konek ke SSE /stream
│   ├── api/                          # client fetch wrapper (unwrap, HttpError, auto 401→refresh→retry)
│   ├── components/
│   │   ├── Map/                      # render peta situs tambang
│   │   ├── Chart/                     # render tren skor & harga komoditas
│   │   └── DataTable/                  # tabel screener watchlist
│   └── service-worker.ts                # baru, tangani push event + asset caching PWA
├── static/
│   └── manifest.json                      # baru, PWA manifest (ikon, nama, theme_color)
```

Route group `(app)` dan `(admin)` masing masing dijaga di `hooks.server`, redirect ke `/login` kalau belum ada sesi valid, dengan pengecekan tambahan `role` khusus buat grup admin.

## Kenapa dua duanya begini
Backend-nya clean architecture dengan ownership check sebagai model akses utama, bukan RBAC granular yang lebih berat. Frontend-nya pakai komponen Map/Chart/DataTable buat visualisasi utama (peta tambang, tren skor, screener watchlist). Bagian yang genuinely baru dan belum ada polanya sebelumnya: `presenceStore`, `service-worker.ts`, dan `manifest.json` di sisi frontend, plus `scheduler`, `crypto`, dan `sectorsclient` di sisi backend.
