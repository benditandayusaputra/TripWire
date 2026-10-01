import { execFileSync } from 'node:child_process';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, sesiMasuk } from './helpers/akun';

const STUB_URL = `http://127.0.0.1:${process.env.SECTORS_STUB_PORT ?? '8899'}`;

async function panggilanStub(request: APIRequestContext) {
	const response = await request.get(`${STUB_URL}/__stub/stats`);
	return (await response.json()).upstream_calls as number;
}

function lupakanCache(...path: string[]) {
	execFileSync('redis-cli', ['-n', '1', 'DEL', ...path.map((satu) => `sectors:cache:${satu}`)]);
}

async function tungguLaporanKedaluwarsa() {
	await new Promise((selesai) => setTimeout(selesai, 2300));
}

test.describe('Fase 5: profil emiten, pengelola, dan pemegang saham', () => {
	test('profil menggabungkan laporan, direksi, dan komposisi dengan biaya credit yang benar', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'profil-saham');
		lupakanCache(
			'company/report/ANTM/?sections=ownership',
			'company/report/ANTM/?sections=management',
			'company/shareholders-composition/ANTM/'
		);
		await tungguLaporanKedaluwarsa();

		const kredit = async () =>
			(await (await sesi.kirim('get', '/market/credits')).json()).meta.credits_used as number;
		const kreditAwal = await kredit();
		const stubAwal = await panggilanStub(request);

		const pertama = await sesi.kirim('get', '/market/ANTM/profile');
		expect(pertama.status()).toBe(200);
		const profil = await pertama.json();

		expect(profil.meta.cached).toBe(false);
		expect(await panggilanStub(request)).toBe(stubAwal + 4);
		expect((await kredit()) - kreditAwal).toBe(4);

		expect(profil.ticker).toBe('ANTM');
		expect(profil.company_name).toBe('Aneka Tambang Tbk.');
		expect(profil.quote).toMatchObject({ last_close_price: 3230, market_cap_rank: 27 });
		expect(profil.company).toMatchObject({
			listing_board: 'Main',
			listing_date: '1997-11-27',
			industry: 'Metals & Minerals',
			address: 'Gedung Uji Tambang\nJalan Contoh No. 1\nJakarta 12530',
			website: 'https://www.aneka-tambang.test',
			email: 'ir@aneka-tambang.test',
			employees: 2750
		});

		expect(profil.executives).toEqual([
			{ name: 'Direktur Utama Uji', position: 'President Director' },
			{ name: 'Direktur Keuangan Uji', position: 'Director' },
			{ name: 'Komisaris Utama Uji', position: 'President Commissioner' }
		]);
		expect(profil.executive_holdings).toHaveLength(1);
		expect(profil.executive_holdings[0]).toMatchObject({
			name: 'Direktur Keuangan Uji',
			share_amount: 244000
		});
		expect(profil.executive_holdings[0].percentage).toBeCloseTo(0.001, 6);

		expect(profil.shareholders.map((satu: { name: string }) => satu.name)).toEqual([
			'Inalum (Persero)',
			'Public'
		]);
		expect(profil.shareholders[0].percentage).toBeCloseTo(65, 6);
		expect(profil.whale_investors).toEqual(['Investor Kakap Uji']);
		expect(profil.conglomerates).toEqual(['Grup BUMN Uji']);
		expect(profil.affiliates).toEqual(['Grup Afiliasi Uji']);

		expect(profil.institutional.top_buyers).toEqual([
			{ name: 'Dana Pensiun Uji', change_amount: 12_500_000 }
		]);
		expect(profil.institutional.top_sellers[0].change_amount).toBe(-8_000_000);
		const arus = profil.institutional.flow.map((satu: { date: string }) => satu.date);
		expect(arus).toEqual([...arus].sort());

		expect(profil.composition).toMatchObject({
			shareholders: 512_345,
			shareholders_change: 12_345,
			local: 5_500_000_000,
			foreign: 3_300_000_000
		});
		expect(profil.composition.categories.map((satu: { key: string }) => satu.key)).toEqual([
			'individual',
			'mutual_fund',
			'pension_fund'
		]);

		const kedua = await sesi.kirim('get', '/market/ANTM/profile');
		expect((await kedua.json()).meta.cached).toBe(true);
		expect(await panggilanStub(request)).toBe(stubAwal + 4);
		expect((await kredit()) - kreditAwal).toBe(4);
	});

	test('profil tetap tampil saat Sectors belum punya data direksi atau komposisi', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'profil-kosong');

		const response = await sesi.kirim('get', '/market/TLKM/profile');
		expect(response.status()).toBe(200);
		const profil = await response.json();

		expect(profil.executives).toEqual([]);
		expect(profil.executive_holdings).toEqual([]);
		expect(profil.composition).toBeNull();
		expect(profil.whale_investors).toEqual([]);
		expect(profil.institutional.top_buyers).toEqual([]);
		expect(profil.shareholders.length).toBeGreaterThan(0);
	});

	test('situs web berskema berbahaya dari Sectors tidak diteruskan ke pengguna', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'profil-situs');

		const response = await sesi.kirim('get', '/market/PTBA/profile');
		expect(response.status()).toBe(200);
		expect((await response.json()).company.website).toBeUndefined();
	});

	test('profil butuh login dan menolak ticker di luar IDX tanpa memanggil Sectors', async ({
		request
	}) => {
		expect((await request.get(`${API_URL}/market/ANTM/profile`)).status()).toBe(401);

		const { sesi } = await sesiMasuk(request, 'profil-ticker');
		const sebelum = await panggilanStub(request);

		expect((await sesi.kirim('get', '/market/ZZZZ/profile')).status()).toBe(422);
		expect(await panggilanStub(request)).toBe(sebelum);
	});
});
