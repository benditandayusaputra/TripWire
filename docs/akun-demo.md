# TripWire: Akun Demo untuk Testing

Akun di bawah dibuat oleh seeder `api/cmd/seed`. Semuanya data contoh untuk pengembangan dan demo,
bukan kredensial produksi.

```
cd api && go run ./cmd/seed
```

Seeder menghapus lalu membuat ulang seluruh akun berdomain `@tripwire.demo` tiap dijalankan,
sehingga aman diulang kapan saja dan hasilnya selalu sama bentuknya.

## Daftar Akun

Password sama untuk semua akun: `TripWireDemo123`

| Email | Peran | Kondisi | Untuk menguji |
|---|---|---|---|
| `admin@tripwire.demo` | admin | aktif, 2 emiten dipantau | Panel admin, kuota Sectors, scan manual, daftar pengguna |
| `investor@tripwire.demo` | user | aktif, 4 emiten, semua jenis kondisi | Dashboard terisi, watchlist, detail insight, verifikasi signature |
| `duafaktor@tripwire.demo` | user | 2FA aktif | Login wajib kode, kode cadangan sekali pakai, halaman keamanan |
| `baru@tripwire.demo` | user | email belum diverifikasi, watchlist kosong | Alur onboarding, banner verifikasi email, keadaan kosong |
| `terkunci@tripwire.demo` | user | terkunci satu jam | Tampilan lockout, penolakan login meski password benar |

Watchlist `investor@tripwire.demo` sengaja memakai lima jenis kondisi sekaligus:

| Emiten | Kondisi |
|---|---|
| ANTM | harian, dan event terbaru dengan ambang skor 60 |
| MDKA | periodik custom tiap 6 jam |
| BBCA | mingguan tiap Rabu |
| INCO | geopolitik dengan ambang skor 45 |

## Akun Dua Faktor

Secret TOTP dan sepuluh kode cadangan dicetak seeder ke layar saat dijalankan, karena keduanya
memang hanya bisa ditampilkan sekali. Salin secret itu ke aplikasi authenticator, atau pakai salah
satu kode cadangan untuk masuk tanpa authenticator. Tiap kode cadangan hanya berlaku sekali.

## Mengisi Feed Insight

Seeder tidak membuat insight, karena insight lahir dari pemindaian yang memanggil Sectors API.
Setelah seeding, isi feed lewat salah satu cara berikut:

- Masuk sebagai `admin@tripwire.demo`, buka `/admin`, tekan tombol scan manual
- Atau jalankan `SCHEDULER_RUN_ON_START=true go run ./cmd/scheduler` dari folder `api`

Tanpa `SECTORS_API_KEY` yang aktif, pemindaian akan gagal di lapisan klien Sectors. Untuk
pengembangan lokal, arahkan `SECTORS_API_BASE_URL` ke stub di `tests/stub/sectors.mjs`. Perlu
diketahui stub itu hanya punya data mendalam untuk ANTM dan PTBA, jadi emiten lain akan berskor
rendah atau kosong. Itu keterbatasan data contoh, bukan kesalahan mesin skoring.

## Membersihkan Sisa Test

Menjalankan Playwright meninggalkan ribuan akun berdomain `@tripwire.test` yang membuat panel admin
sulit dibaca. Bersihkan sekaligus saat seeding:

```
cd api && go run ./cmd/seed --bersihkan-test
```

Perintah itu juga mengosongkan `insight_events`, sehingga rantai hash dimulai ulang dari nol. Hanya
untuk database pengembangan, jangan dipakai di data yang ingin dipertahankan.
