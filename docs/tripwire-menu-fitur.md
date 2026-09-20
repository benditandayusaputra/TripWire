# TripWire: Peta Menu & Fitur Lengkap

Red Flag Detector & Market Intelligence untuk saham IDX. PWA dengan watchlist personal, kondisi trigger, dan notifikasi push.

## 1. Halaman Publik
- **Landing Page**: pitch value proposition, contoh insight (sample/dianonimkan), CTA daftar
- **Login**
- **Register**
- **Verifikasi Insight** *(bonus)*: publik bisa paste ID insight, sistem tunjukkan valid/tidaknya signature Ed25519-nya, bukti insight tidak diubah setelah dibuat

## 2. Onboarding (sekali, setelah register)
1. Terima izin notifikasi browser
2. Pilih saham pertama buat watchlist
3. Pilih kondisi pemicu: event terbaru/geopolitik, harian, mingguan, atau periodik custom
4. Pilih tampilan data: insight saja, atau insight plus data pendukung (revenue, dst)

## 3. Dashboard Utama
- Feed insight terbaru dari seluruh watchlist, urut waktu
- Ringkasan: jumlah saham dipantau, insight baru minggu ini, kondisi yang lagi aktif
- Shortcut ke watchlist dan notifikasi

## 4. Watchlist
- Daftar saham yang dipantau (tambah/hapus)
- Cari dan tambah saham baru
- Pengaturan per saham: jenis kondisi, frekuensi cek, preferensi tampilan data
- Indikator batas free tier *(bonus, kalau jadi pakai tier)*

## 5. Insight Engine

### Red Flag Detector (jalan buat semua saham)
- Histori suspend saham beserta alasan resmi
- Pola klaster transaksi insider/pemegang saham mayor yang tidak biasa
- Perubahan konsentrasi kepemilikan
- Skor risiko tata kelola, gabungan dari tiga sinyal di atas

### Market Intelligence
- Snapshot fundamental vs rata rata sektor
- **Khusus saham tambang** (data lebih dalam tersedia dari Sectors):
  - Skor eksposur komoditas (tren produksi, tren harga komoditas, rasio umur cadangan, dimodifikasi oleh tipe entitas/company_type)
  - Radar lisensi tambang (flag kalau ada lisensi kedaluwarsa dalam 12 bulan)
  - Peta situs tambang terkait, kalau relevan

## 6. Detail Insight
- Isi lengkap satu insight: apa yang memicu, data pendukung, waktu generate
- Badge verifikasi signature (valid/tidak)
- Disclaimer: informasi analisis, bukan rekomendasi beli/jual

## 7. Notifikasi
- Riwayat notifikasi yang pernah dikirim
- Klik notifikasi masuk langsung ke Detail Insight terkait
- Preferensi: aktif/nonaktif push, per kondisi bisa diatur sendiri

## 8. Kondisi & Trigger
- Konfigurasi kondisi per saham, atau default global
- Tipe: event terbaru/geopolitik, harian, mingguan, periodik custom

## 9. Akun & Pengaturan
- Profil (email, ganti password)
- Status izin notifikasi, tombol aktifkan ulang kalau ke-revoke
- Preferensi tampilan data (default global)
- Tier: free/premium *(bonus)*

## 10. Admin Panel (role: admin, buat kamu sendiri)
- Sisa credit Sectors API
- Status dan log scheduler run terakhir
- Daftar user (buat debugging)
- Tombol trigger manual, buat testing tanpa nunggu jadwal

## 11. Fitur Sistem (berjalan di belakang, bukan menu)
- **Scheduler**: cek kondisi tiap watchlist item sesuai jadwalnya, panggil Sectors API
- **Insight engine**: hitung Red Flag score dan Market Intelligence insight
- **Signing**: tiap insight ditandatangani Ed25519 begitu dibuat
- **Hash chain**: tiap insight nyimpen hash dari insight sebelumnya, rangkaian tamper-evident
- **Push dispatch**: kirim notifikasi via Web Push (VAPID + AES128GCM)
- **Cache & circuit breaker**: Redis nyimpen response Sectors API, skip refresh kalau sisa credit di bawah ambang batas
- **Rate limiting**: login, register, tambah watchlist
- **Ownership check**: tiap query data nempel `user_id`, balas 404 (bukan 403) kalau bukan milik user yang minta
- **CI**: govulncheck jalan tiap push, cek kerentanan dependency

## Catatan Kepatuhan
Semua insight, skor, dan notifikasi diposisikan sebagai informasi dan analisis, bukan rekomendasi beli/jual. Disclaimer ini tampil permanen (footer atau banner) di seluruh halaman insight.
