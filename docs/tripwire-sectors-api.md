# TripWire: Pemakaian Sectors API v2

Sectors API v1 dihentikan pada 11 Mei 2026 dan seluruh path `/v1/*` sekarang membalas 410 Gone.
TripWire memakai v2 dengan base URL `https://api.sectors.app/v2` dan header `Authorization: <api key>`.

## 1. Endpoint yang Dipakai

| Kebutuhan | Endpoint | Biaya | Cache |
|---|---|---|---|
| Laporan emiten (dipakai Red Flag, Market Intelligence, dan `/market/:ticker`) | `/company/report/{symbol}/?sections=overview,valuation,financials,ownership` | 4 | `SECTORS_CACHE_TTL` |
| Histori suspend | `/suspensions/?symbol={symbol}&limit=30` | 1 | `SECTORS_CACHE_TTL` |
| Filing insider dan pemegang saham mayor | `/filings/?symbol={symbol}&start={90 hari lalu}&limit=30` | 1 | `SECTORS_CACHE_TTL` |
| Pertumbuhan rata rata subsektor | `/subsector/report/{slug}/?sections=growth` | 1 | 7 hari |
| Cari perusahaan tambang | `/mining/companies/?keyword={ticker}&limit=30` | 1 | 7 hari |
| Detail perusahaan tambang dan lisensi | `/mining/companies/{slug}/` | 1 | 7 hari |
| Kinerja tambang tahun terbaru dan tahun sebelumnya | `/mining/companies/performance/{slug}/` dan `?year=` | 1 per tahun | 7 hari |
| Harga komoditas | `/mining/commodities/{nama}/price/` | 1 | 7 hari |
| Daftar situs tambang | `/mining/sites/?company={slug}&limit=30` | 1 | 7 hari |
| Koordinat situs, maksimal tiga | `/mining/sites/{slug}/` | 1 per situs | 7 hari |
| Universe ticker | `/companies/?limit=200&offset=` | 1 per halaman, sekitar 5 | 7 hari |

`SECTORS_CACHE_TTL` bawaannya 24 jam. Data harian Sectors paling cepat berubah sekali sehari, jadi
scheduler yang jalan tiap 6 jam hampir selalu dilayani cache.

Setiap respons yang berhasil juga disalin ke `sectors:salinan:<path>` selama 14 hari. Salinan ini tidak
pernah dipakai untuk menghitung insight, hanya untuk kutipan harga di `GET /watchlist` (field `quotes`),
yang dibaca dari cache laporan emiten atau salinannya tanpa memanggil Sectors dan tanpa memakai credit.
Emiten yang belum pernah dipindai tidak punya kutipan sampai scan pertamanya.

## 2. Aturan Penagihan
Diambil dari dokumentasi Sectors, dan diterapkan di `api/pkg/sectorsclient`:

- 2xx ditagih sesuai biaya endpoint. Laporan emiten ditagih 1 credit per section, sehingga TripWire
  selalu meminta empat section saja, bukan delapan section bawaan.
- 404 tetap ditagih 1 credit. Klien menyimpan penanda 404 di Redis selama masa cache yang sama supaya
  simbol yang memang tidak ada tidak ditagih berulang.
- 400, 401, 403, 429, dan 5xx tidak ditagih. 429 dan 5xx dihitung sebagai kegagalan circuit breaker.
- Panggilan ditolak sebelum dikirim kalau sisa credit dikurangi biaya panggilan itu jatuh di bawah
  `SECTORS_CREDIT_THRESHOLD`.

Sectors tidak mengirim header sisa kuota, jadi penghitung credit ada di Redis masing masing lingkungan.
Kunci API yang sama dipakai di laptop dan server, sehingga sisa credit sebenarnya adalah jatah dikurangi
pemakaian semua lingkungan.

## 3. Perkiraan Biaya
| Kegiatan | Credit |
|---|---|
| Red Flag satu emiten | 6 (laporan 4, suspend 1, filing 1) |
| Market Intelligence emiten non tambang, laporan sudah di cache | 1 (pertumbuhan subsektor, dibagi dengan emiten lain satu subsektor) |
| Market Intelligence emiten tambang pertama kali dalam seminggu | 7 sampai 10 |
| Scan pertama untuk ANTM, MDKA, INCO, PTBA, BBCA | sekitar 70 |
| Scan harian berikutnya untuk lima emiten yang sama | sekitar 30 |

Verifikasi dengan data asli pada 28 September 2026 memakai 59 credit: 14 untuk eksplorasi manual,
5 untuk universe ticker, dan 40 untuk insight ANTM, PTBA, PPGL, dan BBCA.

## 4. Stub untuk Test
`tests/stub/sectors.mjs` meniru path dan bentuk respons v2 di atas, termasuk pagination, filter
`start` pada filing, dan pemotongan `sections` pada laporan emiten. Playwright menjalankan backend
dengan `SECTORS_API_BASE_URL` menunjuk ke stub, jadi test tidak pernah memakai credit sungguhan.
