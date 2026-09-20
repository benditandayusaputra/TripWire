import { expect, test } from '@playwright/test';
import { sesiMasuk } from './helpers/akun';
import { kodeTOTP } from './helpers/totp';

test.describe('Fase 9: dua faktor lewat API', () => {
	test('rahasia TOTP tidak pernah ikut ter-serialize di respons akun', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, '2fa-serialisasi');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const setup = await sesi.kirim('post', '/auth/totp/setup', { headers: csrf });
		expect(setup.status()).toBe(200);

		const profil = await sesi.kirim('get', '/account/me');
		const teks = await profil.text();

		expect(teks).not.toContain('totp_secret');
		expect(teks).not.toContain('password_hash');
		expect(teks).not.toContain('password_salt');
	});

	test('setup mengembalikan rahasia, otpauth URL, dan QR code siap tampil', async ({ request }) => {
		const { akun, sesi } = await sesiMasuk(request, '2fa-setup');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await sesi.kirim('post', '/auth/totp/setup', { headers: csrf });
		const { setup } = await response.json();

		expect(setup.secret).toMatch(/^[A-Z2-7]{16,}$/);
		expect(setup.otpauth_url).toContain('otpauth://totp/');
		expect(setup.otpauth_url).toContain(akun.email);
		expect(setup.account).toBe(akun.email);
		expect(setup.qr_code).toMatch(/^data:image\/png;base64,/);

		const status = await sesi.kirim('get', '/auth/totp/status', { headers: csrf });
		const { two_factor } = await status.json();
		expect(two_factor.pending_setup).toBe(true);
		expect(two_factor.enabled).toBe(false);
	});

	test('kode salah ditolak, kode benar mengaktifkan dan memulangkan sepuluh kode cadangan', async ({
		request
	}) => {
		const { sesi } = await sesiMasuk(request, '2fa-verify');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const { setup } = await (await sesi.kirim('post', '/auth/totp/setup', { headers: csrf })).json();

		const salah = await sesi.kirim('post', '/auth/totp/verify', {
			data: { code: '000000' },
			headers: csrf
		});
		expect(salah.status()).toBe(422);

		const benar = await sesi.kirim('post', '/auth/totp/verify', {
			data: { code: kodeTOTP(setup.secret) },
			headers: csrf
		});
		expect(benar.status()).toBe(200);

		const { backup_codes } = await benar.json();
		expect(backup_codes).toHaveLength(10);
		for (const kode of backup_codes) {
			expect(kode).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
		}

		const status = await sesi.kirim('get', '/auth/totp/status', { headers: csrf });
		expect((await status.json()).two_factor).toMatchObject({
			enabled: true,
			pending_setup: false,
			backup_codes_left: 10
		});
	});

	test('login akun ber-2FA ditolak tanpa kode, lalu diterima dengan kode yang benar', async ({
		request
	}) => {
		const { akun, sesi } = await sesiMasuk(request, '2fa-login');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const { setup } = await (await sesi.kirim('post', '/auth/totp/setup', { headers: csrf })).json();
		await sesi.kirim('post', '/auth/totp/verify', {
			data: { code: kodeTOTP(setup.secret) },
			headers: csrf
		});

		const tanpaKode = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password }
		});
		expect(tanpaKode.status()).toBe(401);
		expect((await tanpaKode.json()).totp_required).toBe(true);

		const kodeSalah = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password, totp_code: '000000' }
		});
		expect(kodeSalah.status()).toBe(401);

		const kodeBenar = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password, totp_code: kodeTOTP(setup.secret) }
		});
		expect(kodeBenar.status()).toBe(200);
	});

	test('kode cadangan hanya berlaku sekali pakai', async ({ request }) => {
		const { akun, sesi } = await sesiMasuk(request, '2fa-cadangan');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const { setup } = await (await sesi.kirim('post', '/auth/totp/setup', { headers: csrf })).json();
		const aktivasi = await sesi.kirim('post', '/auth/totp/verify', {
			data: { code: kodeTOTP(setup.secret) },
			headers: csrf
		});
		const { backup_codes } = await aktivasi.json();
		const kodeCadangan = backup_codes[0];

		const pertama = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password, totp_code: kodeCadangan }
		});
		expect(pertama.status()).toBe(200);

		const kedua = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password, totp_code: kodeCadangan }
		});
		expect(kedua.status()).toBe(401);

		const status = await sesi.kirim('get', '/auth/totp/status', { headers: csrf });
		expect((await status.json()).two_factor.backup_codes_left).toBe(9);
	});

	test('mematikan dua faktor wajib konfirmasi password dan membuang kode cadangan', async ({
		request
	}) => {
		const { akun, sesi } = await sesiMasuk(request, '2fa-matikan');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const { setup } = await (await sesi.kirim('post', '/auth/totp/setup', { headers: csrf })).json();
		await sesi.kirim('post', '/auth/totp/verify', {
			data: { code: kodeTOTP(setup.secret) },
			headers: csrf
		});

		const passwordSalah = await sesi.kirim('post', '/auth/totp/disable', {
			data: { password: 'PasswordYangSalah123' },
			headers: csrf
		});
		expect(passwordSalah.status()).toBe(422);

		const benar = await sesi.kirim('post', '/auth/totp/disable', {
			data: { password: akun.password },
			headers: csrf
		});
		expect(benar.status()).toBe(200);

		const status = await sesi.kirim('get', '/auth/totp/status', { headers: csrf });
		expect((await status.json()).two_factor).toMatchObject({
			enabled: false,
			pending_setup: false,
			backup_codes_left: 0
		});

		const masuk = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password }
		});
		expect(masuk.status()).toBe(200);
	});

	test('challenge registrasi WebAuthn berformat benar saat feature flag menyala', async ({
		request
	}) => {
		const { akun, sesi } = await sesiMasuk(request, '2fa-webauthn');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		const response = await sesi.kirim('post', '/auth/webauthn/register/options', { headers: csrf });
		expect(response.status()).toBe(200);

		const { publicKey } = await response.json();

		expect(publicKey.challenge).toMatch(/^[A-Za-z0-9_-]{20,}$/);
		expect(publicKey.rp.name).toBeTruthy();
		expect(publicKey.rp.id).toBeTruthy();
		expect(publicKey.user.name).toBe(akun.email);
		expect(publicKey.user.id).toBeTruthy();
		expect(publicKey.pubKeyCredParams.map((p: { alg: number }) => p.alg)).toContain(-7);
		expect(publicKey.timeout).toBeGreaterThan(0);

		const daftar = await sesi.kirim('get', '/auth/webauthn/credentials', { headers: csrf });
		expect(daftar.status()).toBe(200);
		expect((await daftar.json()).credentials).toEqual([]);
	});

	test('endpoint dua faktor menolak permintaan tanpa sesi', async ({ request }) => {
		expect((await request.get('/auth/totp/status')).status()).toBe(401);
		expect((await request.post('/auth/totp/setup')).status()).toBe(401);
		expect((await request.post('/auth/webauthn/register/options')).status()).toBe(401);
	});
});
