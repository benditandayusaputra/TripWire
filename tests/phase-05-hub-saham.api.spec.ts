import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, sesiMasuk } from './helpers/akun';

const STUB_URL = `http://127.0.0.1:${process.env.SECTORS_STUB_PORT ?? '8899'}`;

async function panggilanStub(request: APIRequestContext) {
	const response = await request.get(`${STUB_URL}/__stub/stats`);
	return (await response.json()).upstream_calls as number;
}

async function tungguCacheKedaluwarsa() {
	await new Promise((selesai) => setTimeout(selesai, 2300));
}

test.describe('Halaman saham: harga semua emiten dan pemindaian awal', () => {
	test('harga harian terbuka untuk saham di luar watchlist dengan satu credit lalu dilayani cache', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'hub-harga');
		const kredit = async () =>
			(await (await sesi.kirim('get', '/market/credits')).json()).meta.credits_used as number;

		await tungguCacheKedaluwarsa();
		const stubAwal = await panggilanStub(request);
		const kreditAwal = await kredit();

		const pertama = await sesi.kirim('get', '/market/PTBA/prices');
		expect(pertama.status()).toBe(200);
		const isi = await pertama.json();
		expect(isi.ticker).toBe('PTBA');
		expect(isi.meta.cached).toBe(false);
		expect(isi.series.length).toBeGreaterThan(40);
		const tanggal = isi.series.map((baris: { date: string }) => baris.date);
		expect(tanggal).toEqual([...tanggal].sort());
		expect(await panggilanStub(request)).toBe(stubAwal + 1);
		expect((await kredit()) - kreditAwal).toBe(1);

		const kedua = await (await sesi.kirim('get', '/market/ptba/prices')).json();
		expect(kedua.meta.cached).toBe(true);
		expect(kedua.series).toEqual(isi.series);
		expect(await panggilanStub(request)).toBe(stubAwal + 1);

		const asing = await sesi.kirim('get', '/market/ZZZZ/prices');
		expect(asing.status()).toBe(422);
		expect(await panggilanStub(request)).toBe(stubAwal + 1);

		expect((await request.get(`${API_URL}/market/PTBA/prices`)).status()).toBe(401);
	});

	test('pemindaian awal menghitung skor saham yang baru dipantau tanpa menunggu jadwal', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'hub-pindai');
		const { sesi: lain } = await sesiMasuk(request, 'hub-pindai-lain');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		execFileSync('redis-cli', ['-n', '1', 'DEL', 'scheduler:awal:BBRI']);
		await tungguCacheKedaluwarsa();

		const tambah = await sesi.kirim('post', '/watchlist', { data: { ticker: 'BBRI' }, headers: csrf });
		expect(tambah.status()).toBe(201);
		const { item } = await tambah.json();

		expect((await sesi.kirim('post', `/watchlist/${item.id}/scan`)).status()).toBe(403);

		const mulai = Date.now();
		const pindai = await sesi.kirim('post', `/watchlist/${item.id}/scan`, { headers: csrf });
		expect(pindai.status()).toBe(202);
		expect(await pindai.json()).toEqual({ ticker: 'BBRI', queued: true });

		await expect
			.poll(
				async () => {
					const isi = await (
						await sesi.kirim('get', '/insights?ticker=BBRI&type=red_flag&limit=1')
					).json();
					return new Date(isi.insights[0]?.generated_at ?? 0).getTime();
				},
				{ timeout: 10_000 }
			)
			.toBeGreaterThanOrEqual(mulai - 1000);

		const ulang = await sesi.kirim('post', `/watchlist/${item.id}/scan`, { headers: csrf });
		expect(ulang.status()).toBe(202);
		expect((await ulang.json()).queued).toBe(false);

		const milikOrang = await lain.kirim('post', `/watchlist/${item.id}/scan`, {
			headers: { 'X-CSRF-Token': lain.cookie('tw_csrf') }
		});
		expect(milikOrang.status()).toBe(404);
	});

	test('satu pengguna dibatasi 30 saham berbeda per hari, saham yang sudah dibuka tetap bisa', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'batas-emiten');
		for (let i = 0; i < 30; i += 1) {
			expect((await sesi.kirim('get', `/market/ZZ${String(i).padStart(2, '0')}/prices`)).status()).toBe(422);
		}

		const baru = await sesi.kirim('get', '/market/PTBA/prices');
		expect(baru.status()).toBe(429);
		expect(baru.headers()['retry-after']).toBeTruthy();
		expect((await sesi.kirim('get', '/market/ZZ00/profile')).status()).toBe(422);

		const { sesi: lain } = await sesiMasuk(request, 'batas-emiten-lain');
		expect((await lain.kirim('get', '/market/ZZ00/prices')).status()).toBe(422);
	});
});
