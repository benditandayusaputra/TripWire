import { expect, test } from '@playwright/test';
import { SesiApi, akunBaru, daftarLewatApi } from './helpers/akun';
import { captchaBaru, denganCaptcha } from './helpers/captcha';

const jawabanSalah = (jawaban: string) => jawaban.replace(/\d$/, (digit) => String((Number(digit) + 1) % 10));

test.describe('Fase 3: autentikasi inti lewat API', () => {
	test('endpoint captcha memberi gambar PNG dan audio tanpa cache', async ({ request }) => {
		const response = await request.post('/auth/captcha');
		expect(response.status()).toBe(201);
		expect(response.headers()['cache-control']).toBe('no-store');

		const { captcha_id, image } = await response.json();
		expect(image).toMatch(/^data:image\/png;base64,/);

		const audio = await request.get(`/auth/captcha/${captcha_id}/audio`);
		expect(audio.status()).toBe(200);
		expect(audio.headers()['content-type']).toBe('audio/wav');

		const tidakDikenal = await request.get('/auth/captcha/tidak-ada/audio');
		expect(tidakDikenal.status()).toBe(404);
	});

	test('login wajib lolos captcha dan satu kode hanya berlaku sekali', async ({ request }) => {
		const akun = akunBaru('captcha');
		await daftarLewatApi(request, akun);
		const kredensial = { email: akun.email, password: akun.password };

		const tanpaCaptcha = await request.post('/auth/login', { data: kredensial });
		expect(tanpaCaptcha.status()).toBe(422);
		expect((await tanpaCaptcha.json()).fields.captcha_answer).toBeTruthy();

		const kode = await captchaBaru(request);
		const salah = await request.post('/auth/login', {
			data: { ...kredensial, captcha_id: kode.captcha_id, captcha_answer: jawabanSalah(kode.captcha_answer) }
		});
		expect(salah.status()).toBe(422);

		const sudahHangus = await request.post('/auth/login', { data: { ...kredensial, ...kode } });
		expect(sudahHangus.status()).toBe(422);

		const baru = await captchaBaru(request);
		const benar = await request.post('/auth/login', { data: { ...kredensial, ...baru } });
		expect(benar.status()).toBe(200);

		const dipakaiUlang = await request.post('/auth/login', { data: { ...kredensial, ...baru } });
		expect(dipakaiUlang.status()).toBe(422);
	});

	test('captcha yang salah tidak ikut mengunci akun', async ({ request }) => {
		const akun = akunBaru('captcha-kunci');
		await daftarLewatApi(request, akun);

		for (let percobaan = 1; percobaan <= 6; percobaan += 1) {
			const kode = await captchaBaru(request);
			const response = await request.post('/auth/login', {
				data: {
					email: akun.email,
					password: 'PasswordSalahSekali1',
					captcha_id: kode.captcha_id,
					captcha_answer: jawabanSalah(kode.captcha_answer)
				}
			});
			expect(response.status()).toBe(422);
		}

		const masuk = await request.post('/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: akun.password })
		});
		expect(masuk.status()).toBe(200);
	});

	test('register menolak password lemah dengan detail per field', async ({ request }) => {
		const response = await request.post('/auth/register', {
			data: { email: 'lemah@tripwire.test', password: 'pendek', full_name: 'Uji Lemah' }
		});

		expect(response.status()).toBe(422);

		const body = await response.json();
		expect(body.fields.password).toContain('minimal 10 karakter');
	});

	test('email yang sudah terdaftar ditolak', async ({ request }) => {
		const akun = akunBaru('duplikat');
		await daftarLewatApi(request, akun);

		const response = await request.post('/auth/register', {
			data: { email: akun.email, password: akun.password, full_name: akun.fullName }
		});

		expect(response.status()).toBe(409);
	});

	test('respons akun tidak pernah membawa password_hash, password_salt, atau totp_secret', async ({
		request
	}) => {
		const akun = akunBaru('serialisasi');
		const registrasi = await daftarLewatApi(request, akun);

		expect(JSON.stringify(registrasi.user)).not.toContain('password_hash');
		expect(JSON.stringify(registrasi.user)).not.toContain('password_salt');
		expect(JSON.stringify(registrasi.user)).not.toContain('totp_secret');
	});

	test('verifikasi email sekali pakai, token yang sama ditolak di percobaan kedua', async ({
		request
	}) => {
		const akun = akunBaru('verifikasi');
		const { verification_token } = await daftarLewatApi(request, akun);

		const pertama = await request.get(`/auth/verify-email/${verification_token}`, {
			headers: { Accept: 'application/json' }
		});
		expect(pertama.status()).toBe(200);

		const kedua = await request.get(`/auth/verify-email/${verification_token}`, {
			headers: { Accept: 'application/json' }
		});
		expect(kedua.status()).toBe(401);
	});

	test('refresh token dirotasi, token lama langsung tidak berlaku', async ({ request }) => {
		const akun = akunBaru('rotasi');
		await daftarLewatApi(request, akun);

		const sesi = new SesiApi(request);
		await sesi.kirim('post', '/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: akun.password })
		});

		const refreshLama = sesi.cookie('tw_refresh');
		expect(refreshLama).toBeTruthy();

		const rotasi = await sesi.kirim('post', '/auth/refresh');
		expect(rotasi.status()).toBe(200);
		expect(sesi.cookie('tw_refresh')).not.toBe(refreshLama);

		const pakaiTokenLama = await request.post('/auth/refresh', {
			headers: { Cookie: `tw_refresh=${refreshLama}` }
		});
		expect(pakaiTokenLama.status()).toBe(401);
	});

	test('mutasi tanpa header CSRF ditolak 403', async ({ request }) => {
		const akun = akunBaru('csrf');
		await daftarLewatApi(request, akun);

		const sesi = new SesiApi(request);
		await sesi.kirim('post', '/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: akun.password })
		});

		const tanpaToken = await sesi.kirim('post', '/auth/logout');
		expect(tanpaToken.status()).toBe(403);

		const denganToken = await sesi.kirim('post', '/auth/logout', {
			headers: { 'X-CSRF-Token': sesi.cookie('tw_csrf') }
		});
		expect(denganToken.status()).toBe(200);
	});

	test('reset password mencabut semua sesi lama dan membuka kunci akun', async ({ request }) => {
		const akun = akunBaru('reset');
		await daftarLewatApi(request, akun);

		const sesi = new SesiApi(request);
		await sesi.kirim('post', '/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: akun.password })
		});
		expect(sesi.cookie('tw_refresh')).toBeTruthy();

		const forgot = await sesi.kirim('post', '/auth/password/forgot', {
			data: { email: akun.email }
		});
		const { reset_token } = await forgot.json();

		const reset = await sesi.kirim('post', '/auth/password/reset', {
			data: { token: reset_token, password: 'PasswordGantiBaru9' }
		});
		expect(reset.status()).toBe(200);

		const sesiLama = await sesi.kirim('post', '/auth/refresh');
		expect(sesiLama.status()).toBe(401);

		const masukBaru = await sesi.kirim('post', '/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: 'PasswordGantiBaru9' })
		});
		expect(masukBaru.status()).toBe(200);
	});

	test('endpoint terproteksi menolak permintaan tanpa sesi', async ({ request }) => {
		const response = await request.get('/account/me');
		expect(response.status()).toBe(401);
	});
});
