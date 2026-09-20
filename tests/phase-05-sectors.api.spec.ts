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
		expect(isiPertama.data.financials.revenue).toBe(41000000000000);
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
