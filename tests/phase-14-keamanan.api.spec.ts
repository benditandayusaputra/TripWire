import { expect, test } from '@playwright/test';
import { SesiApi, akunBaru, daftarLewatApi, sesiMasuk } from './helpers/akun';

test.describe('Fase 14: audit keamanan, verifikasi lapisan yang wajib aktif', () => {
	test('header keamanan terpasang di tiap respons API', async ({ request }) => {
		const response = await request.get('/health');
		const header = response.headers();

		expect(header['content-security-policy']).toContain("default-src 'none'");
		expect(header['content-security-policy']).toContain("frame-ancestors 'none'");
		expect(header['content-security-policy']).toContain("object-src 'none'");
		expect(header['x-content-type-options']).toBe('nosniff');
		expect(header['x-frame-options']).toBe('DENY');
		expect(header['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(header['permissions-policy']).toContain('camera=()');
		expect(header['cross-origin-opener-policy']).toBe('same-origin');
	});

	test('endpoint yang mengubah data menolak permintaan tanpa token CSRF', async ({ request }) => {
		const { sesi } = await sesiMasuk(request, 'audit-csrf');

		const jalur: [Parameters<SesiApi['kirim']>[0], string, unknown][] = [
			['post', '/watchlist', { ticker: 'ANTM' }],
			['post', '/auth/logout', undefined],
			['patch', '/account/profile', { full_name: 'Diubah Paksa' }],
			['delete', '/account/sessions', undefined],
			['post', '/auth/totp/setup', undefined]
		];

		for (const [metode, path, data] of jalur) {
			const tanpaToken = await sesi.kirim(metode, path, { data });
			expect(tanpaToken.status(), `${metode.toUpperCase()} ${path} harus ditolak`).toBe(403);
			expect((await tanpaToken.json()).error).toContain('CSRF');
		}

		const dengan = await sesi.kirim('post', '/watchlist', {
			data: { ticker: 'ANTM' },
			headers: { 'X-CSRF-Token': sesi.cookie('tw_csrf') }
		});
		expect([201, 409]).toContain(dengan.status());
	});

	test('token CSRF milik sesi lain tidak bisa dipakai', async ({ request }) => {
		const { sesi: sesiA } = await sesiMasuk(request, 'audit-csrf-silang-a');
		const { sesi: sesiB } = await sesiMasuk(request, 'audit-csrf-silang-b');

		const response = await sesiA.kirim('post', '/watchlist', {
			data: { ticker: 'PTBA' },
			headers: { 'X-CSRF-Token': sesiB.cookie('tw_csrf') }
		});

		expect(response.status()).toBe(403);
	});

	test('rate limit login aktif setelah beberapa percobaan cepat', async ({ request }) => {
		const email = `banjir-${Date.now()}@tripwire.test`;

		let kena = 0;
		let percobaan = 0;

		for (percobaan = 1; percobaan <= 40; percobaan += 1) {
			const response = await request.post('/auth/login', {
				data: { email, password: 'PasswordSalahSekali1' }
			});

			if (response.status() === 429) {
				kena = percobaan;
				expect((await response.json()).error).toContain('Terlalu banyak permintaan');
				expect(response.headers()['retry-after']).toBeTruthy();
				break;
			}

			expect(response.status()).toBe(401);
			expect(response.headers()['x-ratelimit-limit']).toBeTruthy();
		}

		expect(kena, 'login harus kena rate limit sebelum 40 percobaan').toBeGreaterThan(0);
	});

	test('cookie sesi memakai flag httpOnly, Secure, dan SameSite Strict', async ({ request }) => {
		const akun = akunBaru('audit-cookie');
		await daftarLewatApi(request, akun);

		const response = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password }
		});

		const setCookie = response
			.headersArray()
			.filter((header) => header.name.toLowerCase() === 'set-cookie')
			.map((header) => header.value);

		const akses = setCookie.find((baris) => baris.startsWith('tw_access='));
		const refresh = setCookie.find((baris) => baris.startsWith('tw_refresh='));
		const csrf = setCookie.find((baris) => baris.startsWith('tw_csrf='));

		for (const baris of [akses, refresh]) {
			expect(baris).toContain('HttpOnly');
			expect(baris?.toLowerCase()).toContain('secure');
			expect(baris).toContain('SameSite=Strict');
		}

		expect(csrf).not.toContain('HttpOnly');
		expect(csrf?.toLowerCase()).toContain('secure');
	});

	test('field sensitif tidak pernah ikut ter-serialize di endpoint manapun', async ({ request }) => {
		const { akun, sesi } = await sesiMasuk(request, 'audit-serialisasi');
		const csrf = { 'X-CSRF-Token': sesi.cookie('tw_csrf') };

		await sesi.kirim('post', '/auth/totp/setup', { headers: csrf });

		const jalur = ['/account/me', '/account/profile', '/account/sessions', '/auth/totp/status'];

		for (const path of jalur) {
			const teks = await (await sesi.kirim('get', path, { headers: csrf })).text();

			for (const rahasia of ['password_hash', 'password_salt', 'totp_secret', 'token_hash']) {
				expect(teks, `${path} tidak boleh membocorkan ${rahasia}`).not.toContain(rahasia);
			}
		}

		expect(akun.email).toBeTruthy();
	});

	test('CORS hanya mengizinkan origin frontend TripWire, bukan wildcard', async ({ request }) => {
		const asing = await request.fetch('/health', {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://penyerang.example',
				'Access-Control-Request-Method': 'POST'
			}
		});

		const izin = asing.headers()['access-control-allow-origin'] ?? '';
		expect(izin).not.toBe('*');
		expect(izin).not.toContain('penyerang.example');
	});

	test('endpoint privat menolak permintaan tanpa sesi di seluruh grup rute', async ({ request }) => {
		const jalur = [
			'/account/me',
			'/account/profile',
			'/account/sessions',
			'/watchlist',
			'/insights',
			'/market/credits',
			'/notifications',
			'/admin/stats',
			'/auth/totp/status'
		];

		for (const path of jalur) {
			const response = await request.get(path);
			expect([401, 404], `${path} harus menolak tanpa sesi`).toContain(response.status());
		}
	});

	test('lockout database tetap menahan meski rate limit Redis dilewati', async ({ request }) => {
		const akun = akunBaru('audit-lockout');
		await daftarLewatApi(request, akun);

		let terkunci = false;

		for (let percobaan = 1; percobaan <= 10; percobaan += 1) {
			const response = await request.post('/auth/login', {
				data: { email: akun.email, password: 'PasswordSalahSekali1' }
			});

			if (response.status() === 423) {
				terkunci = true;
				expect((await response.json()).locked_until).toBeTruthy();
				break;
			}
		}

		expect(terkunci, 'akun harus terkunci setelah beberapa kali gagal').toBe(true);

		const benarTapiTerkunci = await request.post('/auth/login', {
			data: { email: akun.email, password: akun.password }
		});
		expect(benarTapiTerkunci.status()).toBe(423);
	});
});
