# TripWire

Red flag detector dan market intelligence untuk saham IDX. Submission Sectors Hackathon 2026,
Track 03 Market Intelligence.

## Coba Langsung

| | |
|---|---|
| Situs live | https://trip-wire-site.vercel.app |
| Akun juri | `investor@tripwire.demo`, password `TripWireDemo123` |
| Verifikasi publik tanpa akun | https://trip-wire-site.vercel.app/verify-insight |

Akun juri sudah memantau ANTM, MDKA, INCO, dan BBRI dengan data asli dari Sectors. Buka halaman saham
lewat Ctrl/Cmd+K, misalnya `/stocks/ANTM`, untuk melihat skor, siapa di balik saham, dan jual beli
orang dalam. Akun baru juga bisa didaftarkan dari halaman Daftar. Untuk menghemat jatah data Sectors,
satu akun bisa membuka 30 saham berbeda per hari, saham yang sudah dibuka tetap bisa dilihat lagi.

> Investor ritel IDX sulit menangkap risiko tata kelola karena histori suspensi, transaksi orang
> dalam, dan perubahan kepemilikan tersebar di banyak tempat, maka TripWire memantau ketiganya
> otomatis dari data Sectors, menjelaskan skornya, dan mengabari begitu sinyal itu muncul berdekatan.

## Masalah yang Diselesaikan

Investor ritel IDX harus mengecek sendiri histori suspend, transaksi orang dalam, dan perubahan
kepemilikan di tempat yang terpisah pisah, padahal risiko tata kelola justru terlihat saat ketiga
sinyal itu muncul berdekatan. TripWire memantau pola silang itu otomatis dari data Sectors untuk
setiap saham di watchlist, menjelaskan skornya, dan mengabari begitu kondisi yang dipilih pengguna
terpenuhi.

TripWire menyajikan informasi dan analisis, bukan rekomendasi beli atau jual, dan tidak pernah
mengeksekusi order.

## Yang Bisa Dilakukan

| Fitur | Isi |
|---|---|
| Langkah awal | Pengguna baru memilih sampai lima saham, cara dikabari (harian, mingguan, atau hanya saat skor tinggi), dan izin notifikasi. Saham pilihan langsung dipindai, tidak menunggu jadwal. |
| Dashboard pasar | Grafik IHSG, LQ45, IDX30, denyut pasar, penggerak pasar, arus dana asing, kinerja sektor, peta pasar 40 saham terbesar, dan kinerja watchlist dibanding IHSG. |
| Halaman saham | `/stocks/[ticker]` untuk emiten mana pun: grafik harga harian dengan penanda peristiwa red flag, Red Flag Score beserta pemicu terakhirnya, ringkasan Market Intelligence, serta siapa di balik saham (pemilik terbesar, direksi, grup usaha, investor kakap, komposisi investor, gerak institusi). |
| Red Flag Detector | Skor 0 sampai 100 dari tiga sinyal: suspend, klaster transaksi orang dalam, dan perubahan kepemilikan. Skor dikali 1,3 atau 1,6 saat dua atau tiga sinyal jatuh di jendela 30 hari yang sama. Formula di `docs/tripwire-red-flag-formula.md`. |
| Detail insight | Rumus skor yang bisa dihitung ulang (sub skor, bobot, skor dasar, pengali), grafik harga dengan penanda peristiwa, bukti dari Sectors yang ditandai bila jatuh di jendela 30 hari, dan data mentah yang disegel. |
| Market Intelligence | Fundamental dibanding rata rata subsektor, dengan mode mendalam untuk emiten tambang: skor eksposur komoditas, harga komoditas, produksi dan umur cadangan, radar izin tambang, dan peta situs. Formula di `docs/tripwire-market-intelligence.md`. |
| Watchlist | Lima jenis kondisi pemicu per saham, scheduler terpisah, grafik candle 90 hari, dan tur pemakaian. |
| Notifikasi | SSE saat pengguna online dan Web Push terenkripsi saat offline, dengan riwayat dan ringkasan per tingkat skor. |
| Cari saham | Ctrl/Cmd+K dari halaman mana pun membuka pencarian seluruh emiten BEI tanpa memakai credit Sectors. |
| Verifikasi publik | Setiap insight ditandatangani Ed25519 dan tersambung dalam rantai hash. Halaman `/verify-insight` memeriksanya tanpa login, dan tanda tangan serta hash rantainya dihitung ulang langsung di browser pengunjung. |
| Kenyamanan | Bahasa Indonesia dan Inggris, tema gelap dan terang, PWA yang bisa dipasang di ponsel. |

## Data Sectors sebagai Sumber Utama

Tanpa data Sectors tidak ada skor, tidak ada notifikasi, dan dashboard kosong. Endpoint v2 yang
dipakai beserta biaya dan masa cache-nya ada di `docs/tripwire-sectors-api.md`. Ringkasnya:

| Kebutuhan | Endpoint Sectors |
|---|---|
| Red Flag | `/suspensions/`, `/filings/`, `/company/report/{symbol}/?sections=ownership` |
| Market Intelligence | `/company/report/` (overview, valuation, financials), `/subsector/report/`, endpoint `/mining/` |
| Halaman saham | `/daily/`, `/company/report/` (overview, ownership, management), `/company/shareholders-composition/` |
| Dashboard pasar | `/index-daily/`, `/foreign-flow/`, screener `/companies/` |

Jatah 1.000 credit dijaga dengan cara berikut:

- Laporan emiten diminta per section dengan masa cache sendiri. Ringkasan harga disegarkan harian,
  valuasi, keuangan, dan kepemilikan disimpan 7 hari.
- Semua respons di-cache di Redis, dan respons yang sama dipakai bersama semua pengguna.
- Pemakaian dicatat per hari, dan panel admin menampilkan perkiraan berapa hari lagi jatah cukup.
- Panggilan ditolak sebelum dikirim bila sisa credit di bawah ambang, dan circuit breaker menjeda
  panggilan saat Sectors bermasalah.

## Keamanan

Password ter-hash bcrypt, lockout akun, captcha login, JWT dua token dengan refresh token yang bisa
dicabut, 2FA TOTP dan WebAuthn, CSRF double submit, rate limit, kontrol akses berbasis kepemilikan
data (404, bukan 403), sanitasi markup, CSP ketat, signed URL ber-TTL untuk berkas, dan tanda tangan
Ed25519 untuk setiap insight. Rincian di `docs/tripwire-security-design.md` dan
`docs/audit-keamanan.md`.

## Struktur

| Path | Isi |
|---|---|
| `api/` | Backend Go 1.25 + Fiber, clean architecture (handler, service, repository) |
| `app/` | Frontend SvelteKit 2 PWA |
| `tests/` | Playwright test per fase, dengan stub Sectors di `tests/stub/sectors.mjs` |
| `docs/` | Spesifikasi produk, formula, schema database, kontrak API, security design, deploy |

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
`api/.env`, env frontend di `app/.env`, karena keduanya di-deploy ke server berbeda. Scheduler
pemindaian berjalan terpisah lewat `cd api && go run ./cmd/scheduler`. Panduan deploy ada di
`docs/deploy.md`.

## Akun Demo

```bash
cd api && go run ./cmd/seed
```

Daftar akun, password, dan cara mengisi feed insight ada di `docs/akun-demo.md`. Naskah video demo
ada di `docs/demo-video.md`.

## Test

```bash
npm install
npx playwright install chromium
npm test
```

Playwright menyalakan stub Sectors, backend, dan frontend sendiri lewat konfigurasi `webServer`, jadi
test tidak pernah memakai credit Sectors sungguhan. Unit test backend dijalankan dengan
`cd api && go test ./...`.
