# TripWire: Product Requirements Document

## 1. Ringkasan Produk
TripWire adalah aplikasi red flag detector dan market intelligence untuk saham di Bursa Efek Indonesia (IDX). Aplikasi memantau watchlist saham milik tiap pengguna secara otomatis, mendeteksi pola risiko tata kelola dan sinyal pasar dari data Sectors, lalu mengirim notifikasi begitu kondisi yang ditentukan pengguna terpenuhi. Dibangun sebagai submission untuk Sectors Hackathon 2026.

## 2. Latar Belakang & Masalah
Investor ritel Indonesia harus memeriksa manual berbagai sinyal yang tersebar: histori suspend saham, transaksi insider dan pemegang saham mayor, perubahan konsentrasi kepemilikan, data fundamental dibanding sektor. Sinyal sinyal ini biasanya ditampilkan terpisah pisah di tab atau tools berbeda, gak ada yang menyatukannya jadi satu notifikasi yang actionable. Ranah screener harga dan bandarmology sendiri sudah sangat mapan (Stockbit, Ajaib Terminal, IPOT, IDXAlpha), jadi diferensiasi TripWire diarahkan ke pola silang antar sinyal tata kelola, dan ke data vertikal tambang yang jauh lebih dalam dari sekadar harga saham.

## 3. Target Pengguna
Investor ritel yang aktif memantau beberapa saham tertentu dan ingin tahu begitu ada perubahan signifikan, tanpa harus mengecek manual tiap hari. Termasuk investor yang tertarik ke sektor tambang dan komoditas, yang datanya jauh lebih kaya di Sectors dibanding sektor lain.

## 4. Konteks Kompetisi
- Kompetisi: Sectors Hackathon 2026
- Track: 03, Market Intelligence
- Syarat inti: data Sectors sebagai sumber utama, bukan tempelan, produk kehilangan fungsi utamanya kalau data Sectors dicabut
- Larangan tegas: tidak ada eksekusi trading otomatis, tidak ada rekomendasi beli/jual langsung, semua insight wajib diposisikan sebagai informasi atau analisis dengan disclaimer
- Jatah API: 1.000 credit per tim, dikelola lewat cache Redis dan circuit breaker

## 5. Tujuan & Metrik Sukses
Selaras dengan bobot penilaian resmi lomba:
- Real world usability (40%): satu alur kerja yang jelas untuk satu jenis pengguna, bukan demo sekali pakai
- Video demo dan storytelling (30%): skenario yang bisa didemoin meyakinkan dalam waktu terbatas, idealnya pakai insight yang genuinely muncul dari data saham asli, bukan data karangan
- Technical depth dan eksekusi (30%): lapisan integritas data (signature, hash chain), keamanan berlapis, dan formula skoring yang punya dasar analisis nyata

## 6. Lingkup Fitur
Ringkasan area fitur, detail lengkap tiap item ada di tripwire-menu-fitur.md:
- Autentikasi dan akun: registrasi, login, 2FA (TOTP dan WebAuthn), manajemen sesi per device, profil lengkap
- Watchlist: tambah/hapus saham, atur kondisi trigger per saham (event terbaru, geopolitik, harian, mingguan, periodik custom)
- Insight engine: Red Flag Detector untuk semua saham, Market Intelligence dengan mode mendalam khusus saham tambang
- Notifikasi: riwayat, push notification, delivery real-time lewat SSE kalau pengguna sedang online
- Verifikasi publik: cek keaslian satu insight lewat signature, terbuka buat siapa saja termasuk juri
- Panel admin: monitoring sisa credit API, status scheduler, trigger manual buat testing
- Manajemen file: upload avatar dan dokumen lewat signed URL ber-TTL

## 7. Alur Pengguna Utama

### Alur onboarding
1. Registrasi atau login
2. Terima izin notifikasi browser
3. Pilih saham pertama buat watchlist
4. Pilih kondisi pemicu
5. Pilih tampilan data (insight saja, atau insight plus data pendukung)

### Alur trigger dan notifikasi
Kondisi terpenuhi, sistem generate insight, insight ditandatangani dan dicatat, notifikasi dikirim (SSE kalau online, Web Push kalau offline), pengguna klik notifikasi, masuk ke halaman Detail Insight di dashboard.

## 8. Insight Engine

### Red Flag Detector (berlaku untuk semua saham di watchlist)
Menggabungkan tiga sinyal tata kelola yang biasanya tersebar dan ditampilkan terpisah: histori suspend beserta alasan resmi, pola transaksi insider dan pemegang saham mayor yang tidak wajar, dan perubahan konsentrasi kepemilikan. Nilai jual utamanya ada di pencarian pola silang antar tiga sinyal ini, misalnya klaster penjualan insider yang terjadi berdekatan waktu dengan suspend, bukan menampilkan tiap sinyal secara terpisah seperti yang sudah lazim.
Status: konsep sudah matang, formula skoring konkret (bobot tiap sinyal, ambang batas klaster) belum difinalisasi.

### Market Intelligence
Mode standar: snapshot fundamental dibandingkan rata rata sektor.
Mode mendalam, khusus emiten tambang, memanfaatkan kedalaman data Sectors di sektor ini: skor eksposur komoditas (tren produksi, tren harga komoditas, rasio umur cadangan, dimodifikasi tipe entitas mine owner versus trading/holding), radar kedaluwarsa lisensi tambang, konteks peta situs tambang.
Status: formula skor eksposur komoditas sudah dirancang sebagai starting point, siap diuji begitu API key aktif.

## 9. Kebutuhan Non-Fungsional
Detail lengkap ada di tripwire-security-design.md, ringkasannya:
- Autentikasi berlapis: password ter-salt dan ter-hash, account lockout, JWT dual-token dengan refresh token yang bisa di-revoke, TOTP dan WebAuthn opsional
- Integritas data: tiap insight ditandatangani Ed25519 dan tersusun dalam hash chain, bisa diverifikasi independen
- Kontrol akses berbasis kepemilikan data, bukan RBAC granular, karena sifat data TripWire privat per akun
- Performa: access token stateless tanpa roundtrip database, cache Redis buat response Sectors API, circuit breaker credit budget
- Privasi: identifier pakai UUIDv7 untuk performa index, tanpa expose identifier yang sensitif ke endpoint publik

## 10. Pendekatan Teknis
Detail lengkap ada di tripwire-architecture.md, ringkasannya:
- Backend: Go dengan Fiber, clean architecture (handler, service, repository), PostgreSQL untuk data relasional, Redis untuk cache dan presence
- Frontend: SvelteKit sebagai PWA, komponen Map, Chart, dan DataTable buat visualisasi utama
- Realtime: Server-Sent Events buat update insight langsung ke dashboard yang sedang terbuka
- Notifikasi: Web Push dengan VAPID dan enkripsi AES128GCM
- Skema database dan kontrak API lengkap ada di tripwire-schema.sql dan tripwire-api-routes.md

## 11. Di Luar Lingkup
- Eksekusi order atau trading otomatis, dilarang aturan lomba dan memang bukan tujuan produk
- Rekomendasi beli atau jual langsung, semua insight diposisikan sebagai informasi dan analisis
- Fitur sosial: watchlist publik, follow pengguna lain, leaderboard
- Aplikasi mobile native, cukup PWA
- WebAuthn wajib untuk semua pengguna, tetap opsional lewat feature flag

## 12. Risiko & Pertanyaan Terbuka
- Formula skoring Red Flag Detector belum final, masih level konsep pola silang, belum ada bobot dan ambang batas konkret
- Wireframe atau tampilan visual tiap halaman belum dibuat, baru sebatas ketentuan data yang muncul
- Rencana video demo belum disusun: skenario, urutan cerita, dan satu kalimat problem statement wajib buat submission
- Resolusi entitas grup tambang (kasus entitas trading terpisah dari entitas induk) masih butuh riset lanjutan ke endpoint ownership tree sebelum diimplementasi
- Kelengkapan data per emiten belum divalidasi langsung ke API, ada indikasi awal kalau emiten kecil datanya gak selengkap emiten besar
- Ketidakkonsistenan penamaan endpoint yang sempat ditemukan di dokumentasi (dua path berbeda buat data yang sama) perlu dikonfirmasi ulang begitu API key aktif

## 13. Dokumen Referensi
- tripwire-menu-fitur.md: peta menu dan fitur lengkap
- tripwire-schema.sql: skema database
- tripwire-api-routes.md: kontrak API endpoint
- tripwire-security-design.md: desain keamanan
- tripwire-architecture.md: arsitektur frontend dan backend
