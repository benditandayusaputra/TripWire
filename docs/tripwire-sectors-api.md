# TripWire: Pemakaian Sectors API v2

Sectors API v1 dihentikan pada 11 Mei 2026 dan seluruh path `/v1/*` sekarang membalas 410 Gone.
TripWire memakai v2 dengan base URL `https://api.sectors.app/v2` dan header `Authorization: <api key>`.

## 1. Endpoint yang Dipakai

| Kebutuhan | Endpoint | Biaya | Cache |
|---|---|---|---|
| Ringkasan emiten dan harga terakhir (Market Intelligence, profil saham, kutipan harga) | `/company/report/{symbol}/?sections=overview` | 1 | `SECTORS_CACHE_TTL` |
| Valuasi, keuangan, dan kepemilikan emiten (Red Flag memakai `ownership`, Market Intelligence memakai `valuation` dan `financials`, profil saham memakai `ownership`) | `/company/report/{symbol}/?sections=valuation`, `financials`, `ownership`, masing masing satu panggilan | 1 per bagian | 7 hari |
| Direksi dan saham milik direksi untuk profil saham | `/company/report/{symbol}/?sections=management` | 1 | 7 hari |
| Komposisi investor lokal dan asing per bulan untuk profil saham | `/company/shareholders-composition/{symbol}/` | 1 | 7 hari |
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
| Grafik indeks IHSG, LQ45, IDX30 di dashboard | `/index-daily/{kode}/?start={90 hari lalu}` | 1 per indeks | `SECTORS_CACHE_TTL` |
| Net beli dan net jual asing teratas | `/foreign-flow/?limit=10&order_by=-net_foreign_inflow` dan `order_by=net_foreign_inflow` | 2 | `SECTORS_CACHE_TTL` |
| Harga harian untuk grafik dan garis tren watchlist | `/daily/{symbol}/?start={90 hari lalu}` | 1 | `SECTORS_CACHE_TTL` |
| Daftar saham untuk saran dan modal Tambah saham | `/companies/?where=...&order_by=-market_cap&include_query_values=true&limit=200&offset=` | 1 per halaman, 5 halaman untuk 962 emiten | `SECTORS_CACHE_TTL` |

`SECTORS_CACHE_TTL` bawaannya 24 jam. Data harian Sectors paling cepat berubah sekali sehari, jadi
scheduler yang jalan tiap 6 jam hampir selalu dilayani cache.

Laporan emiten diminta per bagian sejak 2 Oktober 2026. Sectors menagih 1 credit per bagian, jadi
biayanya sama dengan satu panggilan gabungan, tetapi tiap bagian punya kunci cache sendiri. Bagian
`overview` membawa harga terakhir sehingga disegarkan harian, sedangkan valuasi tahunan, laporan
keuangan, dan pemegang saham jarang berubah sehingga disimpan 7 hari. Emiten yang dipindai tiap hari
turun dari 4 credit laporan per hari menjadi sekitar 1,4. `GET /market/:ticker` tetap mengembalikan
empat bagian yang digabung. Mengubah jadwal scheduler tidak menghemat credit, karena tiap kunci
paling banyak diambil ulang sekali dalam masa cache-nya berapa kali pun scan berjalan.

Setiap credit yang terpakai juga dicatat per tanggal WIB di `sectors:credit:harian:<tanggal>` selama
40 hari. Panel admin membaca tujuh hari terakhir untuk menampilkan rata rata harian dan perkiraan
berapa hari lagi jatah cukup sebelum menyentuh `SECTORS_CREDIT_THRESHOLD`.

Setiap respons yang berhasil juga disalin ke `sectors:salinan:<path>` selama 14 hari. Salinan ini tidak
pernah dipakai untuk menghitung insight, hanya untuk kutipan harga di `GET /watchlist` (field `quotes`),
yang dibaca dari cache laporan emiten atau salinannya tanpa memanggil Sectors dan tanpa memakai credit.
Emiten yang belum pernah dipindai tidak punya kutipan sampai scan pertamanya.

Harga harian diambil untuk setiap emiten di watchlist saat halaman watchlist dibuka, tidak ikut scan
terjadwal. Seri yang sama dipakai untuk garis tren sebulan di tiap baris, harga penutupan emiten yang
belum pernah dipindai, dan grafik candle di panel detail. Respons `/daily/` berupa array polos berisi
`symbol, date, open, high, low, close, volume, market_cap`, sekitar 62 hari bursa untuk jendela 90
hari. Parameter `start` berganti tiap hari sehingga biaya paling banyak 1 credit per emiten per hari,
berapa pun pengguna yang membukanya. Endpoint TripWire-nya hanya melayani emiten yang ada di watchlist
pemanggil.

Saran saham dan modal Tambah saham memakai screener `/companies/` dengan `where=last_close_price > 0
and daily_close_change > -1 and market_cap > 0 and sector like '%'`, `order_by=-market_cap`,
`include_query_values=true`, dan `limit=200`. Diuji dengan data asli pada 29 September 2026:
`query_values` hanya berisi field yang disebut di `where` atau `order_by`, `sector like '%'` meloloskan
semua 962 emiten sambil membawa nama sektor, dan simbol di `where` wajib berakhiran `.JK`
(`symbol in ['BBCA.JK']`), tanpa akhiran hasilnya kosong tapi tetap ditagih 1 credit. `GET /market/top`
hanya membaca halaman pertama, sedangkan `GET /market/stocks` membaca semua halaman saat modal dibuka.

Sectors API tidak punya field logo. Logo emiten di daftar saham diambil browser langsung dari aset publik
yang dipakai sectors.app sendiri, `https://storage.googleapis.com/sectorsapp-sea/logo/{KODE}.webp`
(lingkaran 40x40, 404 kalau emiten belum punya logo), jadi tidak memakai credit. `LogoEmiten.svelte`
menumpuknya di atas monogram sebagai cadangan, dan CSP `img-src` hanya membuka path itu.

## 2. Aturan Penagihan
Diambil dari dokumentasi Sectors, dan diterapkan di `api/pkg/sectorsclient`:

- 2xx ditagih sesuai biaya endpoint. Laporan emiten ditagih 1 credit per section, sehingga TripWire
  selalu menyebut section yang dibutuhkan, tidak pernah meminta delapan section bawaan.
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
| Red Flag satu emiten pertama kali | 3 (kepemilikan 1, suspend 1, filing 1) |
| Red Flag satu emiten hari berikutnya | 2 (suspend dan filing), kepemilikan disegarkan seminggu sekali |
| Market Intelligence emiten non tambang pertama kali | 4 (ringkasan, valuasi, keuangan, dan pertumbuhan subsektor yang dibagi dengan emiten lain satu subsektor) |
| Market Intelligence emiten non tambang hari berikutnya | 1 (ringkasan harian) |
| Market Intelligence emiten tambang pertama kali dalam seminggu | 7 sampai 10 |
| Scan pertama untuk ANTM, MDKA, INCO, PTBA, BBCA | sekitar 70 |
| Scan harian berikutnya untuk lima emiten yang sama | sekitar 15, sebelumnya sekitar 30 saat laporan diambil utuh tiap hari |
| Membuka watchlist berisi N emiten pertama kali dalam sehari | N untuk harga harian, ditambah 1 untuk saran saham |
| Membuka modal Tambah saham pertama kali dalam sehari | 4 lagi untuk halaman screener sisanya |

Verifikasi dengan data asli pada 28 September 2026 memakai 59 credit: 14 untuk eksplorasi manual,
5 untuk universe ticker, dan 40 untuk insight ANTM, PTBA, PPGL, dan BBCA.

## 4. Stub untuk Test
`tests/stub/sectors.mjs` meniru path dan bentuk respons v2 di atas, termasuk pagination, filter
`start` pada filing, dan pemotongan `sections` pada laporan emiten. Playwright menjalankan backend
dengan `SECTORS_API_BASE_URL` menunjuk ke stub, jadi test tidak pernah memakai credit sungguhan.
