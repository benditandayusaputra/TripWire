# TripWire: Naskah Video Demo

Target durasi tiga menit. Bobot video dan storytelling 30 persen, jadi ceritanya harus berdiri di
atas insight yang lahir dari data Sectors asli, bukan data stub.

## Problem Statement

Investor ritel IDX harus mengecek sendiri histori suspend, transaksi orang dalam, dan perubahan
kepemilikan di tempat yang terpisah pisah, padahal risiko tata kelola justru terlihat saat ketiga
sinyal itu muncul berdekatan. TripWire memantau pola silang itu otomatis dari data Sectors,
menjelaskan skornya, dan mengabari begitu terjadi.

## Persiapan Sebelum Rekam

1. Pastikan API produksi sudah memuat rilis terbaru (endpoint `GET /market/:ticker/prices` dan
   `POST /watchlist/:id/scan` membalas, bukan 404). Cara deploy ada di `docs/deploy.md`.
2. Buka `/admin` dengan `admin@tripwire.demo`. Cek sisa credit dan perkiraan berapa hari lagi jatah
   cukup. Sisihkan sekitar 150 credit untuk rekaman dan cadangan pengulangan.
3. Jalankan scan manual dari `/admin`, lalu pilih satu emiten dengan skor Tinggi atau Kritis dari data
   asli sebagai tokoh utama cerita. Kalau tidak ada, pakai emiten tambang dengan skor eksposur
   tertinggi dan tonjolkan Market Intelligence mode mendalam.
4. Siapkan akun baru untuk adegan langkah awal (email belum pernah dipakai), dan login
   `investor@tripwire.demo` di jendela lain dengan izin notifikasi aktif supaya push terlihat.
5. Catat satu ID insight untuk adegan verifikasi publik, lalu buka `/verify-insight` di jendela
   penyamaran tanpa login.
6. Rekam di lebar layar desktop, lalu ulangi adegan halaman saham di lebar ponsel kalau waktunya
   cukup. Pakai tema gelap supaya grafik terbaca jelas.

## Adegan

| Waktu | Layar | Narasi inti |
|---|---|---|
| 0:00 sampai 0:15 | Beranda | Problem statement di atas, satu kalimat. |
| 0:15 sampai 0:40 | Daftar lalu `/mulai` | Pilih saham tokoh cerita dan satu saham besar, pilih cara dikabari, izinkan notifikasi. Begitu selesai, watchlist terisi dan skor muncul beberapa detik kemudian karena TripWire langsung memindai dari Sectors. |
| 0:40 sampai 1:05 | Halaman saham tokoh cerita | Grafik harga dengan penanda suspensi dan transaksi orang dalam, Red Flag Score dengan pemicu terakhir, lalu Siapa di balik saham: pemilik terbesar, direksi, komposisi investor. |
| 1:05 sampai 1:45 | Detail insight | Kenapa skornya segini: tiga sub skor dengan bobot, skor dasar, pengali pola silang. Tekankan bahwa skor naik saat sinyal muncul berdekatan, bukan sekadar dijumlah. Tunjukkan bukti yang ditandai di jendela 30 hari dan data mentah yang disegel. |
| 1:45 sampai 2:05 | Notifikasi | Push dari jendela `investor@tripwire.demo`, klik langsung ke detail insight. |
| 2:05 sampai 2:30 | Verifikasi publik di jendela tanpa login | Tempel ID insight. Segel valid, hash rantai utuh, dan browser pengunjung ikut menghitung ulang tanda tangan Ed25519 serta hash rantainya. |
| 2:30 sampai 2:50 | Dashboard pasar dan Ctrl+K | Sekilas IHSG, penggerak, arus asing, peta pasar, lalu Ctrl+K untuk membuka saham lain. |
| 2:50 sampai 3:00 | Penutup | TripWire memberi informasi, bukan rekomendasi beli atau jual. |

## Kalimat yang Wajib Muncul

- Data Sectors adalah sumber utama. Tanpa data itu tidak ada skor dan tidak ada notifikasi.
- Tidak ada eksekusi order dan tidak ada rekomendasi beli atau jual.
- Setiap insight ditandatangani dan berantai hash, jadi tidak bisa diubah diam diam, dan siapa pun
  bisa memeriksanya sendiri.

## Hindari

- Menyebut emiten sebagai "berbahaya" atau "harus dijual". Pakai bahasa faktual: apa yang terjadi
  dan kapan.
- Merekam dengan data stub. Kalau terpaksa, sebut terang terangan bahwa itu data contoh.
- Membuka panel admin terlalu lama. Itu alat demo, bukan fitur pengguna.
- Membuka halaman saham emiten acak berkali kali saat rehearsal. Setiap emiten baru memakai sekitar
  5 credit pertama kali dalam sehari.
