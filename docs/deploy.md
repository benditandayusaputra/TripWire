# Deploy TripWire

Backend dan frontend di-deploy ke server berbeda, env-nya juga terpisah: backend membaca `api/.env`,
frontend membaca `app/.env`.

## Gambaran

| Bagian | Tempat |
|---|---|
| Frontend `app/` | Vercel |
| API, scheduler, Postgres 18, Redis | VM Oracle `130.162.198.219`, project Docker Compose `tripwire` di `/opt/tripwire` |
| HTTPS API | `https://tripwire-app.duckdns.org`, lewat Caddy milik project sidestream di VM yang sama |
| Auto deploy API | GitHub Actions `Deploy API` setiap push ke `main` yang mengubah `api/` |

Alur request:

- Halaman dan form action SvelteKit memanggil API dari server Vercel ke `PUBLIC_API_URL`, lalu cookie
  sesi diteruskan ke domain frontend.
- Kode yang jalan di browser (stream notifikasi, langganan push, tandai notifikasi dibaca) memanggil
  `/api/...` di domain frontend. Route `app/src/routes/api/[...path]` meneruskannya ke API. Karena
  itu frontend dan API tidak perlu berbagi domain, dan `COOKIE_DOMAIN` dibiarkan kosong.

## Deploy Frontend di Vercel

1. Import repo di Vercel, Root Directory `app`.
2. Environment variable: `PUBLIC_API_URL=https://tripwire-app.duckdns.org`.
3. Deploy.
4. Setelah URL Vercel diketahui, isi `FRONTEND_URL` di server (lihat Operasional). Nilai ini dipakai
   WebAuthn dan tautan verifikasi email.

## Auto Deploy API

Workflow `.github/workflows/deploy-api.yml` menjalankan unit test, build binary Linux, lalu mengirim
bundle lewat SSH ke user `tripwire` di VM. Kunci SSH itu dibatasi `restrict,command=` sehingga hanya
bisa menjalankan `/opt/tripwire/deploy.sh`, tidak bisa membuka shell.

`deploy.sh` mengekstrak bundle ke `releases/<commit>`, menjalankan migrasi, menyalakan ulang API dan
scheduler, lalu menunggu `/health`. Kalau salah satu langkah gagal, symlink `current` dikembalikan ke
rilis sebelumnya dan workflow ditandai merah. Tiga rilis terakhir disimpan.

Syarat sekali pasang: secret repository `DEPLOY_SSH_KEY` berisi private key deploy (Settings,
Secrets and variables, Actions). Deploy manual tanpa push bisa dipicu dari tab Actions lewat
tombol Run workflow.

## Operasional

Masuk VM lalu jalankan perintah dari folder project:

```bash
ssh sidestream-vm
sudo -u tripwire sh -c 'cd /opt/tripwire && docker compose ps'
sudo -u tripwire sh -c 'cd /opt/tripwire && docker compose logs -f --tail 100 tripwire-api tripwire-scheduler'
```

| Keperluan | Perintah di `/opt/tripwire` sebagai user `tripwire` |
|---|---|
| Ubah env | edit `.env`, lalu `docker compose up -d --force-recreate tripwire-api tripwire-scheduler` |
| Seed ulang akun demo | `docker compose run --rm -T --entrypoint /app/bin/seed tripwire-api` |
| Migrasi manual | `docker compose run --rm --entrypoint /app/bin/migrate tripwire-api up` |
| Backup database | `docker compose exec -T tripwire-db pg_dump -U tripwire tripwire > backup.sql` |
| Cek health dari VM | `curl 127.0.0.1:8090/health` |

Nama service sengaja diberi awalan `tripwire-`. Container API ikut bergabung ke network
`deploy_default` milik sidestream supaya bisa dijangkau Caddy, dan di network itu sudah ada service
bernama `api` dan `db`. Nama tanpa awalan akan bertabrakan dan API bisa tersambung ke database
sidestream.

Batas memori per container: database 192 MB, Redis 64 MB, API 128 MB, scheduler 96 MB. VM hanya
1 GB dan dipakai bersama sidestream, jadi jangan build Go di VM.

Jangan mengganti `TOTP_ENCRYPTION_KEY` dan `INSIGHT_SIGNING_PRIVATE_KEY` di server setelah ada data.
Secret TOTP yang tersimpan tidak bisa dibuka lagi dan tanda tangan insight lama gagal diverifikasi.

## Caddy

Blok berikut ditambahkan di akhir `/opt/sidestream/deploy/Caddyfile`:

```
tripwire-app.duckdns.org {
	reverse_proxy tripwire-api:8080
}
```

File itu di-mount ke container Caddy sebagai satu file, jadi ubah isinya di tempat (misalnya dengan
`tee -a`), jangan diganti file baru, lalu muat ulang tanpa restart:

```bash
sudo docker exec deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo docker exec deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Kalau deploy sidestream menimpa Caddyfile, blok ini hilang dan API tidak bisa diakses dari luar.
Tambahkan lagi blok di atas.

## Batasan

- Rate limit dan lockout per IP melihat IP server Vercel, bukan IP pengguna, karena hampir semua
  request datang dari server frontend. Lockout per akun tetap berlaku.
- Fungsi Vercel punya batas durasi, jadi koneksi stream notifikasi terputus berkala dan tersambung
  ulang otomatis oleh browser.
- Tanpa `SECTORS_API_KEY`, scan berjalan tapi setiap emiten gagal diambil dan feed insight kosong.
