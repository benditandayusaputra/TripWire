import { expect, test } from '@playwright/test';
import { sesiMasuk } from './helpers/akun';

const STUB_URL = `http://127.0.0.1:${process.env.SECTORS_STUB_PORT ?? '8899'}`;

const CACHE_TTL_MS = 2000;

async function statistikStub(request: import('@playwright/test').APIRequestContext) {
	const response = await request.get(`${STUB_URL}/__stub/stats`);
	return (await response.json()).upstream_calls as number;
}

async function tungguCacheKedaluwarsa() {
	await new Promise((selesai) => setTimeout(selesai, CACHE_TTL_MS + 300));
}

test.describe('Fase 5: klien Sectors, cache, dan circuit breaker', () => {
	test('panggilan pertama menembak Sectors, panggilan kedua dilayani cache', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'sectors-cache');
		const ticker = 'ANTM';

		await tungguCacheKedaluwarsa();
		const sebelum = await statistikStub(request);

		const pertama = await sesi.kirim('get', `/market/${ticker}`);
		expect(pertama.status()).toBe(200);

		const isiPertama = await pertama.json();
		expect(isiPertama.ticker).toBe('ANTM');
		expect(isiPertama.company_name).toBe('Aneka Tambang Tbk.');
		expect(isiPertama.data.company_name).toBe('Aneka Tambang Tbk.');
		expect(isiPertama.data.overview.industry).toBe('Metals & Minerals');
		expect(Object.keys(isiPertama.data).sort()).toEqual(
			['company_name', 'financials', 'overview', 'ownership', 'symbol', 'valuation'].sort()
		);
		expect(isiPertama.meta.cached).toBe(false);

		const setelahPertama = await statistikStub(request);
		expect(setelahPertama).toBe(sebelum + 1);

		const kedua = await sesi.kirim('get', `/market/${ticker}`);
		expect(kedua.status()).toBe(200);

		const isiKedua = await kedua.json();
		expect(isiKedua.meta.cached).toBe(true);
		expect(isiKedua.data).toEqual(isiPertama.data);
		expect(isiKedua.meta.latency_ms).toBeLessThanOrEqual(isiPertama.meta.latency_ms);

		const setelahKedua = await statistikStub(request);
		expect(setelahKedua).toBe(setelahPertama);
	});

	test('cache hit tidak menghabiskan credit tambahan', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'sectors-credit');

		await tungguCacheKedaluwarsa();

		const pertama = await sesi.kirim('get', '/market/PTBA');
		const isiPertama = await pertama.json();
		expect(isiPertama.meta.cached).toBe(false);

		const kedua = await sesi.kirim('get', '/market/PTBA');
		const isiKedua = await kedua.json();

		expect(isiKedua.meta.cached).toBe(true);
		expect(isiKedua.meta.credits_used).toBe(isiPertama.meta.credits_used);
		expect(isiKedua.meta.credits_remaining).toBe(isiPertama.meta.credits_remaining);
		expect(isiKedua.meta.credit_budget).toBeGreaterThan(0);
	});

	test('laporan emiten v2 ditagih satu credit per section yang diminta', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'sectors-biaya');

		await tungguCacheKedaluwarsa();
		const sebelum = (await (await sesi.kirim('get', '/market/credits')).json()).meta.credits_used;

		const response = await sesi.kirim('get', '/market/TLKM');
		expect(response.status()).toBe(200);
		expect((await response.json()).meta.cached).toBe(false);

		const sesudah = (await (await sesi.kirim('get', '/market/credits')).json()).meta.credits_used;
		expect(sesudah - sebelum).toBe(4);
	});

	test('kutipan harga watchlist dibaca dari salinan laporan tanpa memanggil Sectors lagi', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'sectors-kutipan');

		const tambah = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'INCO' },
			headers: { 'X-CSRF-Token': sesi.cookie('tw_csrf') }
		});
		expect(tambah.status()).toBe(201);

		expect((await sesi.kirim('get', '/market/INCO')).status()).toBe(200);
		await tungguCacheKedaluwarsa();

		const sebelum = await statistikStub(request);
		const kredit = (await (await sesi.kirim('get', '/market/credits')).json()).meta.credits_used;

		const daftar = await sesi.kirim('get', '/watchlist');
		expect(daftar.status()).toBe(200);

		const { quotes } = await daftar.json();
		expect(quotes.INCO).toMatchObject({
			ticker: 'INCO',
			last_close_price: 3900,
			daily_close_change: 0.0155,
			high_52w: 4600,
			low_52w: 3100,
			sector: 'Basic Materials'
		});
		expect(quotes.INCO.indices).toContain('LQ45');

		expect(await statistikStub(request)).toBe(sebelum);
		const kreditSesudah = (await (await sesi.kirim('get', '/market/credits')).json()).meta
			.credits_used;
		expect(kreditSesudah).toBe(kredit);
	});

	test('ticker di luar daftar IDX tidak pernah diteruskan ke Sectors', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'sectors-ticker');

		const sebelum = await statistikStub(request);

		const response = await sesi.kirim('get', '/market/ZZZZ');
		expect(response.status()).toBe(422);

		expect(await statistikStub(request)).toBe(sebelum);
	});

	test('kegagalan beruntun membuka circuit breaker dan permintaan berikutnya dijeda', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'sectors-circuit');

		let terakhir = await sesi.kirim('get', '/market/BRMS');

		for (let percobaan = 1; percobaan <= 5 && terakhir.status() !== 503; percobaan += 1) {
			expect(terakhir.status()).toBe(502);
			terakhir = await sesi.kirim('get', '/market/BRMS');
		}

		expect(terakhir.status()).toBe(503);
		expect((await terakhir.json()).reason).toBe('circuit_open');

		const sebelum = await statistikStub(request);
		const lain = await sesi.kirim('get', '/market/MDKA');
		expect(lain.status()).toBe(503);
		expect(await statistikStub(request)).toBe(sebelum);
	});

	test('endpoint pasar menolak pengunjung tanpa sesi', async ({ request }) => {
		const response = await request.get('/market/ANTM');
		expect(response.status()).toBe(401);
	});
});
