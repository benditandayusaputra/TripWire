import { expect, test } from '@playwright/test';
import { sesiMasuk } from './helpers/akun';
import { bukanGambar, pngAcak, pngPersegi } from './helpers/gambar';

const AVATAR = pngPersegi(48, [74, 158, 255]);

test.describe('Fase 10: berkas, avatar, dan signed URL', () => {
	test('signature yang diubah membuat tautan berkas ditolak', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'berkas-sig');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const unggah = await request.post('/account/avatar', {
			headers: { ...csrf, Cookie: sesi.header },
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		expect(unggah.status()).toBe(201);

		const { file } = await unggah.json();
		const tautan = new URL(file.url);
		const exp = tautan.searchParams.get('exp') ?? '';
		const sig = tautan.searchParams.get('sig') ?? '';

		const sah = await request.get(file.url);
		expect(sah.status()).toBe(200);
		expect(sah.headers()['content-type']).toContain('image/png');

		const sigPalsu = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
		const diubah = await request.get(`/files/${file.id}?exp=${exp}&sig=${sigPalsu}`);
		expect(diubah.status()).toBe(403);
		expect((await diubah.json()).reason).toBe('signature_invalid');

		const tanpaSig = await request.get(`/files/${file.id}?exp=${exp}`);
		expect(tanpaSig.status()).toBe(403);
	});

	test('memperpanjang exp tanpa menandatangani ulang tetap ditolak', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'berkas-exp');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const unggah = await request.post('/account/avatar', {
			headers: { ...csrf, Cookie: sesi.header },
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		const { file } = await unggah.json();
		const sig = new URL(file.url).searchParams.get('sig') ?? '';

		const diperpanjang = await request.get(`/files/${file.id}?exp=9999999999&sig=${sig}`);
		expect(diperpanjang.status()).toBe(403);
		expect((await diperpanjang.json()).reason).toBe('signature_invalid');

		const kedaluwarsa = await request.get(`/files/${file.id}?exp=1&sig=${sig}`);
		expect(kedaluwarsa.status()).toBe(403);
	});

	test('berkas yang isinya bukan gambar ditolak meski mengaku PNG', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'berkas-palsu');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await request.post('/account/avatar', {
			headers: { ...csrf, Cookie: sesi.header },
			multipart: {
				file: { name: 'avatar.png', mimeType: 'image/png', buffer: bukanGambar() }
			}
		});

		expect(response.status()).toBe(415);
	});

	test('avatar melebihi batas ukuran ditolak sebelum tersimpan', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'berkas-besar');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const besar = pngAcak(1200);
		expect(besar.length).toBeGreaterThan(2 * 1024 * 1024);

		const response = await request.post('/account/avatar', {
			headers: { ...csrf, Cookie: sesi.header },
			multipart: { file: { name: 'besar.png', mimeType: 'image/png', buffer: besar } }
		});

		expect(response.status()).toBe(413);
	});

	test('metadata berkas menyimpan checksum yang cocok dengan isi yang diunduh', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'berkas-checksum');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const unggah = await request.post('/account/avatar', {
			headers: { ...csrf, Cookie: sesi.header },
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		const { file } = await unggah.json();

		expect(file.checksum_sha256).toHaveLength(64);
		expect(file.mime_type).toBe('image/png');
		expect(file.size_bytes).toBe(AVATAR.length);

		const unduh = await request.get(file.url);
		expect(unduh.headers()['x-checksum-sha256']).toBe(file.checksum_sha256);
		expect(Buffer.from(await unduh.body())).toEqual(AVATAR);
	});

	test('berkas milik pengguna lain tidak bisa dihapus, dijawab 404', async ({ request }) => {
		const { sesi: sesiA } = await sesiMasuk(request, 'berkas-ownerA');
		const { sesi: sesiB } = await sesiMasuk(request, 'berkas-ownerB');

		const unggah = await request.post('/account/avatar', {
			headers: { 'X-CSRF-Token': sesiA.cookie('tw_csrf'), Cookie: sesiA.header },
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		const { file } = await unggah.json();

		const hapusOlehB = await sesiB.kirim('delete', `/files/${file.id}`, {
			headers: { 'X-CSRF-Token': sesiB.cookie('tw_csrf') }
		});
		expect(hapusOlehB.status()).toBe(404);

		const masihAda = await request.get(file.url);
		expect(masihAda.status()).toBe(200);
	});

	test('unggah avatar butuh sesi dan token CSRF', async ({ request }) => {
		const tanpaSesi = await request.post('/account/avatar', {
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		expect(tanpaSesi.status()).toBe(401);

		const { sesi } = await sesiMasuk(request, 'berkas-csrf');
		const tanpaCSRF = await request.post('/account/avatar', {
			headers: { Cookie: sesi.header },
			multipart: { file: { name: 'avatar.png', mimeType: 'image/png', buffer: AVATAR } }
		});
		expect(tanpaCSRF.status()).toBe(403);
	});
});
