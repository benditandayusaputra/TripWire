# TripWire: Formula Market Intelligence

Market Intelligence punya dua mode. Mode standar berlaku untuk semua emiten. Mode mendalam aktif
kalau emiten tercatat di ekstensi Mining milik Sectors. Semua angka berasal dari Sectors API v2,
daftar endpoint dan biayanya ada di `tripwire-sectors-api.md`.

## 1. Mode Standar: Fundamental terhadap Rata Rata Sektor

### 1.1 Valuasi terhadap peer
Sumber: bagian `valuation.historical_valuation` di laporan emiten. Tiap baris tahunan memuat nilai
emiten sekaligus rata rata peer satu subsektor (`pe_peer_avg`, `pb_peer_avg`, `ps_peer_avg`).

```
untuk tiap metrik PE, PB, PS:
    pilih tahun terbaru yang punya nilai emiten dan rata rata peer sekaligus
    difference     = nilai − rata_rata_peer
    difference_pct = difference / |rata_rata_peer| × 100
    posisi         = di atas bila difference_pct > 1, di bawah bila < −1, selain itu setara
```
Tahun dipilih per metrik. Contohnya PB tahun berjalan sering sudah tersedia saat PE tahun berjalan
belum, karena laba tahunan belum lengkap.

### 1.2 Pertumbuhan terhadap subsektor
Sumber: `financials.historical_financials` untuk emiten, dan bagian `growth` dari laporan subsektor
(`/v2/subsector/report/{slug}/?sections=growth`) untuk rata rata tertimbang subsektor.

```
tahun = tahun terbaru yang ada di data pertumbuhan subsektor dan punya pendapatan emiten tahun itu serta tahun sebelumnya
pertumbuhan_pendapatan = (pendapatan_tahun − pendapatan_tahun_lalu) / |pendapatan_tahun_lalu| × 100
pertumbuhan_laba       = (laba_tahun − laba_tahun_lalu) / |laba_tahun_lalu| × 100
difference = pertumbuhan_emiten − rata_rata_tertimbang_subsektor, dalam poin persentase
posisi     = di atas bila difference > 1 pp, di bawah bila < −1 pp, selain itu setara
```
Metrik pertumbuhan memakai selisih poin persentase, bukan selisih relatif, karena selisih relatif
dua angka pertumbuhan mudah meledak saat rata ratanya mendekati nol.

Mode standar tidak menghasilkan skor. Insight disimpan dengan `score` kosong dan tampil sebagai
"Info", karena posisi di atas atau di bawah rata rata sektor bukan penilaian baik atau buruk.

## 2. Mode Mendalam Tambang

### 2.1 Menentukan emiten tambang
1. Laporan emiten diperiksa dulu: `sub_sector`, `industry`, atau `sub_industry` harus memuat kata
   coal, metal, mineral, mining, gold, nickel, copper, atau tambang. Emiten lain tidak pernah
   memanggil endpoint Mining, jadi tidak ada credit terbuang.
2. `GET /v2/mining/companies/?keyword={ticker}` mencari perusahaan dengan `symbol` yang sama persis.
   Kalau tidak ada, insight tetap memakai mode standar.

### 2.2 Komoditas fokus
Laporan kinerja tambang memuat banyak baris per komoditas dan sub tipe, dengan satuan berbeda
(Mt untuk batu bara, koz untuk emas, wmt untuk bijih nikel, TNi untuk feronikel). Komoditas fokus
dipilih dengan urutan:

1. komoditas pertama di `commodity_type` perusahaan yang punya produksi di tahun terbaru dan tahun
   sebelumnya, supaya tren produksi bisa dihitung
2. kalau tidak ada, komoditas pertama yang punya produksi di tahun terbaru

Contoh ANTM per 28 September 2026: daftar komoditasnya Nickel lalu Gold, tapi data kinerja 2023 hanya
memuat emas, jadi komoditas fokusnya emas.

### 2.3 Komponen skor
```
tren_produksi = rata rata YoY produksi baris komoditas fokus yang ada di dua tahun
                (dicocokkan per komoditas, sub tipe, dan satuan)
komponen_produksi = clamp(50 + tren_produksi × 2, 0, 100)

tren_harga = (harga terbaru − harga sekitar 12 bulan sebelumnya) / harga 12 bulan sebelumnya × 100
             (pembanding dipilih yang paling dekat ke 12 bulan sebelumnya, maksimal selisih 45 hari)
komponen_harga = clamp(50 + tren_harga × 2, 0, 100)

umur_cadangan = total cadangan / produksi tahun terbaru, pada satuan yang sama
                (kunci total_reserves_<satuan>, atau <simbol logam>_reserves_<satuan> seperti Au_reserves_koz)
komponen_cadangan = clamp(umur_cadangan × 5, 0, 100)
```

### 2.4 Skor eksposur
```
bobot: produksi 0.35, harga 0.35, cadangan 0.30
skor_dasar = Σ(bobot × komponen) / Σ(bobot komponen yang datanya tersedia)
faktor_entitas:
    1.0   Mine Owner
    0.7   Trader
    0.85  Holding, Contractor, dan tipe lain
skor_eksposur = min(100, skor_dasar × faktor_entitas)

kategori: 0 sampai 30 Rendah, 31 sampai 60 Sedang, 61 sampai 85 Tinggi, 86 sampai 100 Sangat Tinggi
```
Komponen yang datanya kosong di Sectors tidak dihitung sebagai nol. Bobotnya dibagi ulang ke komponen
yang tersedia, dan payload menyimpan komponen itu sebagai `null` supaya terlihat jelas di halaman detail.
Kalau ketiganya kosong, insight tetap memakai mode mendalam untuk radar lisensi dan peta situs, tapi
tanpa skor.

Skor eksposur mengukur seberapa besar kinerja emiten terpapar siklus komoditasnya. Skor ini tidak
masuk ke Red Flag Score dan bukan sinyal beli atau jual.

### 2.5 Radar lisensi
Sumber: `mining_license` di detail perusahaan tambang. Radar menampilkan lisensi yang berakhir dalam
365 hari ke depan, dan juga lisensi yang sudah berakhir dalam 365 hari terakhir dengan tanda `expired`.
Sisa hari tidak disimpan di payload karena nilainya berubah tiap hari dan akan memicu insight baru
tanpa ada kejadian baru. Halaman detail menghitungnya dari tanggal berakhir.

### 2.6 Peta situs
Daftar situs diambil dari `GET /v2/mining/sites/?company={slug}`. Koordinat hanya ada di detail per
situs, jadi hanya tiga situs pertama yang diambil detailnya untuk menghemat credit. Situs lain tetap
tampil di daftar dengan kabupaten dan provinsinya.

## 3. Catatan Data
- Harga komoditas di Sectors selalu bernama `price_usd_per_ton`, padahal nilai emas dan perak jelas
  harga per troy ounce (emas sekitar 2.035 pada Januari 2024 dan 4.363 pada September 2026). TripWire
  menampilkan satuan USD/oz untuk logam mulia. Persentase perubahan tidak terpengaruh.
- Data harga batu bara dan nikel per 28 September 2026 baru sampai Februari 2026, sedangkan emas
  sudah sampai September 2026. Halaman detail selalu menampilkan tanggal harga terakhir.
- Data kinerja tambang terbaru yang tersedia adalah tahun 2024.
