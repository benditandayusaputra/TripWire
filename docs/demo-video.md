# TripWire: Naskah Video Demo

Target durasi tiga menit. Bobot video dan storytelling 30 persen, jadi ceritanya harus berdiri di
atas insight yang lahir dari data Sectors asli, bukan data stub.

## Problem Statement

Investor ritel IDX harus mengecek sendiri histori suspend, transaksi insider, dan perubahan
kepemilikan di tempat yang terpisah pisah, padahal risiko tata kelola justru terlihat saat ketiga
sinyal itu muncul berdekatan. TripWire memantau pola silang itu otomatis dan mengabari begitu terjadi.

## Persiapan Sebelum Rekam

1. `SECTORS_API_KEY` sudah terisi di server, lalu scan manual dari `/admin` sudah menghasilkan
   insight. Cek di `/admin` bahwa kolom gagal bernilai nol dan sisa credit masih cukup.
2. Pilih satu emiten yang skornya Tinggi atau Kritis dari hasil scan untuk jadi tokoh utama
   cerita. Kalau tidak ada, pakai emiten tambang dengan skor tertinggi, lalu tonjolkan Market
   Intelligence mode mendalam.
3. Login `investor@tripwire.demo` di satu browser, izinkan notifikasi supaya push terlihat.
4. Siapkan satu ID insight untuk bagian verifikasi publik.
5. Rekam di lebar layar ponsel sekali dan desktop sekali, pakai yang paling terbaca.

## Adegan

| Waktu | Layar | Narasi inti |
|---|---|---|
| 0:00 sampai 0:20 | Landing page | Problem statement di atas, satu kalimat. |
| 0:20 sampai 0:45 | Register lalu onboarding | Pilih emiten, pilih kondisi pemicu. Tunjukkan bahwa ticker divalidasi ke daftar emiten IDX. |
| 0:45 sampai 1:05 | Watchlist | Lima jenis kondisi: event terbaru, geopolitik, harian, mingguan, periodik custom. |
| 1:05 sampai 1:25 | Admin, scan manual | Scheduler memanggil Sectors API, sisa credit terlihat berkurang, cache menahan panggilan ulang. |
| 1:25 sampai 1:40 | Notifikasi masuk | Push muncul, klik langsung ke detail insight. |
| 1:40 sampai 2:20 | Detail insight | Skor gabungan, tiga sub skor, pengali pola silang, data pendukung dari Sectors. Tekankan bahwa skor naik saat sinyal muncul berdekatan, bukan sekadar dijumlah. |
| 2:20 sampai 2:45 | Verifikasi publik | Tempel ID insight, signature Ed25519 valid, hash chain utuh. Siapa pun termasuk juri bisa mengeceknya tanpa login. |
| 2:45 sampai 3:00 | Dashboard | Disclaimer terlihat. Penutup: TripWire memberi informasi, bukan rekomendasi beli atau jual. |

## Kalimat yang Wajib Muncul

- Data Sectors adalah sumber utama. Tanpa data itu tidak ada skor dan tidak ada notifikasi.
- Tidak ada eksekusi order dan tidak ada rekomendasi beli atau jual.
- Setiap insight ditandatangani dan berantai hash, jadi tidak bisa diubah diam diam.

## Hindari

- Menyebut emiten sebagai "berbahaya" atau "harus dijual". Pakai bahasa faktual: apa yang terjadi
  dan kapan.
- Merekam dengan data stub. Kalau terpaksa, sebut terang terangan bahwa itu data contoh.
- Membuka panel admin terlalu lama. Itu alat demo, bukan fitur pengguna.
