import { expect, test } from '@playwright/test';
import { sesiMasuk } from './helpers/akun';

test.describe('Fase 4: watchlist dan kondisi lewat API', () => {
	test('item milik pengguna lain selalu dijawab 404, bukan 403', async ({ request }) => {
		const { sesi: sesiA } = await sesiMasuk(request, 'ownerA');
		const { sesi: sesiB } = await sesiMasuk(request, 'ownerB');

		const csrfA = { 'X-CSRF-Token': sesiA.cookie('tw_csrf') };
		const csrfB = { 'X-CSRF-Token': sesiB.cookie('tw_csrf') };

		const dibuat = await sesiA.kirim('post', '/watchlist', {
			data: { ticker: 'ANTM' },
			headers: csrfA
		});
		expect(dibuat.status()).toBe(201);
		const { item } = await dibuat.json();

		const kondisiDibuat = await sesiA.kirim('post', `/watchlist/${item.id}/conditions`, {
			data: { condition_type: 'daily', config: {} },
			headers: csrfA
		});
		expect(kondisiDibuat.status()).toBe(201);
		const { condition } = await kondisiDibuat.json();

		const bacaKondisi = await sesiB.kirim('get', `/watchlist/${item.id}/conditions`);
		expect(bacaKondisi.status()).toBe(404);

		const ubahItem = await sesiB.kirim('patch', `/watchlist/${item.id}`, {
			data: { data_display_pref: 'insight_plus_data' },
			headers: csrfB
		});
		expect(ubahItem.status()).toBe(404);

		const hapusItem = await sesiB.kirim('delete', `/watchlist/${item.id}`, { headers: csrfB });
		expect(hapusItem.status()).toBe(404);

		const hapusKondisi = await sesiB.kirim(
			'delete',
			`/watchlist/${item.id}/conditions/${condition.id}`,
			{ headers: csrfB }
		);
		expect(hapusKondisi.status()).toBe(404);

		const masihUtuh = await sesiA.kirim('get', `/watchlist/${item.id}/conditions`);
		expect(masihUtuh.status()).toBe(200);
		expect((await masihUtuh.json()).conditions).toHaveLength(1);

		const daftarB = await sesiB.kirim('get', '/watchlist');
		expect((await daftarB.json()).items).toHaveLength(0);
	});

	test('ticker di luar daftar resmi IDX ditolak', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'tickerpalsu');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'ZZZZ' },
			headers: csrf
		});

		expect(response.status()).toBe(422);
		expect((await response.json()).fields.ticker).toContain('IDX');
	});

	test('ticker dinormalkan, huruf kecil dan sufiks JK tetap diterima', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'normalisasi');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'ptba.jk' },
			headers: csrf
		});

		expect(response.status()).toBe(201);
		expect((await response.json()).item.ticker).toBe('PTBA');

		const duplikat = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'PTBA' },
			headers: csrf
		});
		expect(duplikat.status()).toBe(409);
	});

	test('markup di badan permintaan ditolak sebelum tersimpan', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'xss');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await sesi.kirim('post', '/watchlist', {
			data: { ticker: '<script>alert(1)</script>' },
			headers: csrf
		});

		expect(response.status()).toBe(422);
		expect((await response.json()).error).toContain('markup');
	});

	test('config kondisi divalidasi, interval di luar rentang ditolak', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'kondisi');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const dibuat = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'MDKA' },
			headers: csrf
		});
		const { item } = await dibuat.json();

		const terlaluBesar = await sesi.kirim('post', `/watchlist/${item.id}/conditions`, {
			data: { condition_type: 'periodic_custom', config: { interval_hours: 5000 } },
			headers: csrf
		});
		expect(terlaluBesar.status()).toBe(422);

		const jenisAsing = await sesi.kirim('post', `/watchlist/${item.id}/conditions`, {
			data: { condition_type: 'kapan_saja', config: {} },
			headers: csrf
		});
		expect(jenisAsing.status()).toBe(422);

		const benar = await sesi.kirim('post', `/watchlist/${item.id}/conditions`, {
			data: { condition_type: 'periodic_custom', config: { interval_hours: 12 } },
			headers: csrf
		});
		expect(benar.status()).toBe(201);
		expect((await benar.json()).condition.config.interval_hours).toBe(12);
	});

	test('pencarian ticker mengembalikan emiten dari daftar resmi IDX', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'cari');

		const response = await sesi.kirim('get', '/tickers?q=ANTM');
		expect(response.status()).toBe(200);

		const { tickers } = await response.json();
		expect(tickers[0]).toMatchObject({ code: 'ANTM', name: 'Aneka Tambang Tbk.' });
	});
});
