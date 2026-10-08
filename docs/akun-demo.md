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
| `baru@tripwire.demo` | user | email belum diverifikasi, watchlist kosong | Langkah awal `/mulai` lewat tombol Mulai dalam 3 langkah di dashboard, keadaan kosong |
| `terkunci@tripwire.demo` | user | terkunci satu jam | Tampilan lockout, penolakan login meski password benar |

Watchlist `investor@tripwire.demo` sengaja memakai lima jenis kondisi sekaligus:

| Emiten | Kondisi |
|---|---|
| ANTM | harian, dan event terbaru dengan ambang skor 60 |
| MDKA | periodik custom tiap 6 jam |
| BBCA | mingguan tiap Rabu |
| INCO | geopolitik dengan ambang skor 45 |

Akun yang baru didaftarkan lewat halaman Daftar langsung diarahkan ke langkah awal `/mulai` setelah
login pertama selama watchlist-nya masih kosong (cookie `tw_mulai` dari aksi daftar, berlaku 7 hari dan
dihapus begitu dashboard dibuka). Langkah awal memilih sampai lima saham, cara dikabari (harian,
mingguan, atau hanya saat skor 61 ke atas), dan izin notifikasi, lalu langsung memindai saham itu.

## Akun Dua Faktor

Secret TOTP dan sepuluh kode cadangan dicetak seeder ke layar saat dijalankan, karena keduanya
memang hanya bisa ditampilkan sekali. Salin secret itu ke aplikasi authenticator, atau pakai salah
satu kode cadangan untuk masuk tanpa authenticator. Tiap kode cadangan hanya berlaku sekali.

## Mengisi Feed Insight

Seeder tidak membuat insight, karena insight lahir dari pemindaian yang memanggil Sectors API.
Setelah seeding, isi feed lewat salah satu cara berikut:

- Masuk sebagai `admin@tripwire.demo`, buka `/admin`, tekan tombol scan manual
- Atau jalankan `SCHEDULER_RUN_ON_START=true go run ./cmd/scheduler` dari folder `api`

Tanpa `SECTORS_API_KEY` yang aktif, pemindaian akan gagal di lapisan klien Sectors. Scan pertama
untuk lima emiten di akun demo memakai sekitar 70 credit, rinciannya di `tripwire-sectors-api.md`.

Untuk pengembangan tanpa memakai credit, arahkan `SECTORS_API_BASE_URL` ke stub di
`tests/stub/sectors.mjs`. Stub meniru bentuk respons v2 tapi datanya karangan, dengan skenario
red flag untuk ANTM, PTBA, MDKA, dan ITMG, mode tambang untuk ADRO dan INCO, serta snapshot sektor
untuk BBCA. Emiten lain berskor rendah atau kosong. Jangan merekam video demo dengan data stub.

## Membersihkan Sisa Test

Menjalankan Playwright meninggalkan ribuan akun berdomain `@tripwire.test` yang membuat panel admin
sulit dibaca. Bersihkan sekaligus saat seeding:

```
cd api && go run ./cmd/seed --bersihkan-test
```

Perintah itu juga mengosongkan `insight_events`, sehingga rantai hash dimulai ulang dari nol. Hanya
untuk database pengembangan, jangan dipakai di data yang ingin dipertahankan.
