import { expect, test } from '@playwright/test';
import { sesiMasuk } from './helpers/akun';
import { kueri } from './helpers/database';

test.describe('Fase 7: integritas insight, signature Ed25519 dan hash chain', () => {
	test('insight yang baru dibuat lolos verifikasi dan public key ikut dipublish', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'integritas-valid');

		const dibuat = await sesi.kirim('get', '/insights/red-flag/ANTM');
		expect(dibuat.status()).toBe(200);

		const insight = await dibuat.json();
		expect(insight.id).toBeTruthy();
		expect(insight.signature).toBeTruthy();
		expect(insight.current_hash).toHaveLength(64);

		const verifikasi = await request.get(`/insights/verify/${insight.id}`);
		expect(verifikasi.status()).toBe(200);

		const hasil = await verifikasi.json();
		expect(hasil.valid).toBe(true);
		expect(hasil.signature_valid).toBe(true);
		expect(hasil.hash_valid).toBe(true);
		expect(hasil.chain_valid).toBe(true);
		expect(hasil.algorithm).toBe('Ed25519');
		expect(hasil.public_key).toMatch(/^[A-Za-z0-9+/]{43}=$/);
		expect(hasil.digest).toHaveLength(64);
		expect(hasil.current_hash).toBe(insight.current_hash);
	});

	test('endpoint verify terbuka untuk publik tanpa sesi sama sekali', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'integritas-publik');
		const insight = await (await sesi.kirim('get', '/insights/red-flag/MDKA')).json();

		const tanpaSesi = await request.get(`/insights/verify/${insight.id}`);
		expect(tanpaSesi.status()).toBe(200);
		expect((await tanpaSesi.json()).valid).toBe(true);
	});

	test('satu field payload diubah langsung di database, verifikasi berubah jadi tidak valid', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'integritas-rusak');

		const insight = await (await sesi.kirim('get', '/insights/red-flag/INCO')).json();

		const sebelum = await request.get(`/insights/verify/${insight.id}`);
		expect(sebelum.status()).toBe(200);
		expect((await sebelum.json()).valid).toBe(true);

		const skorAsli = kueri(
			`SELECT payload->>'governance_risk_score' FROM insight_events WHERE id = '${insight.id}'`
		);
		kueri(
			`UPDATE insight_events SET payload = jsonb_set(payload, '{governance_risk_score}', '1.0') WHERE id = '${insight.id}'`
		);
		const skorSetelah = kueri(
			`SELECT payload->>'governance_risk_score' FROM insight_events WHERE id = '${insight.id}'`
		);
		expect(skorSetelah).not.toBe(skorAsli);

		const sesudah = await request.get(`/insights/verify/${insight.id}`);
		expect(sesudah.status()).toBe(409);

		const hasil = await sesudah.json();
		expect(hasil.valid).toBe(false);
		expect(hasil.signature_valid).toBe(false);
		expect(hasil.hash_valid).toBe(false);
		expect(hasil.reason).toContain('Signature Ed25519 tidak cocok');
	});

	test('kolom hash chain tersambung berurutan dari insight pertama sampai terakhir', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, 'integritas-rantai');

		await sesi.kirim('get', '/insights/red-flag/PTBA');
		await sesi.kirim('get', '/insights/market-intelligence/PTBA');
		await sesi.kirim('get', '/insights/red-flag/BBCA');

		const putus = kueri(`
			SELECT count(*) FROM (
				SELECT prev_hash, lag(current_hash) OVER (ORDER BY generated_at, id) AS sebelumnya
				FROM insight_events
			) rantai
			WHERE coalesce(prev_hash, '') IS DISTINCT FROM coalesce(sebelumnya, '')
		`);
		expect(Number(putus)).toBe(0);

		const tanpaInduk = kueri(`
			SELECT count(*) FROM insight_events anak
			WHERE anak.prev_hash IS NOT NULL
			  AND NOT EXISTS (SELECT 1 FROM insight_events induk WHERE induk.current_hash = anak.prev_hash)
		`);
		expect(Number(tanpaInduk)).toBe(0);

		const total = Number(kueri('SELECT count(*) FROM insight_events'));
		expect(total).toBeGreaterThan(1);
	});

	test('insight dengan isi sama tidak menambah mata rantai baru', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'integritas-dedupe');

		const pertama = await (await sesi.kirim('get', '/insights/red-flag/ADRO')).json();
		const jumlahSetelahPertama = Number(kueri('SELECT count(*) FROM insight_events'));

		const kedua = await (await sesi.kirim('get', '/insights/red-flag/ADRO')).json();
		const jumlahSetelahKedua = Number(kueri('SELECT count(*) FROM insight_events'));

		expect(kedua.id).toBe(pertama.id);
		expect(kedua.current_hash).toBe(pertama.current_hash);
		expect(jumlahSetelahKedua).toBe(jumlahSetelahPertama);
	});

	test('id insight yang tidak dikenal dijawab 404', async ({ request }) => {
		const response = await request.get('/insights/verify/01a00000-0000-7000-8000-000000000000');
		expect(response.status()).toBe(404);
	});
});
