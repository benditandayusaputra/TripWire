import { expect, test } from '@playwright/test';
import { API_URL, SesiApi, akunBaru, daftarLewatApi } from './helpers/akun';
import { denganCaptcha } from './helpers/captcha';

const INGGRIS = { Cookie: 'tw_bahasa=en' };

test.describe('Pesan API mengikuti cookie tw_bahasa', () => {
	test('galat validasi register berbahasa Inggris dengan cookie en, tetap Indonesia tanpa cookie', async ({
		request
	}) => {
		const data = { email: 'bukan-email', password: 'pendek', full_name: 'A' };

		const inggris = await request.post(`${API_URL}/auth/register`, { data, headers: INGGRIS });
		expect(inggris.status()).toBe(422);
		expect(await inggris.json()).toEqual({
			error: 'Please check the details you entered',
			fields: {
				email: 'Email format is invalid',
				password: 'Password must be at least 10 characters',
				full_name: 'Full name must be at least 2 characters'
			}
		});

		for (const headers of [{}, { Cookie: 'tw_bahasa=id' }]) {
			const indonesia = await request.post(`${API_URL}/auth/register`, { data, headers });
			expect(indonesia.status()).toBe(422);
			expect(await indonesia.json()).toEqual({
				error: 'Data yang dikirim belum benar',
				fields: {
					email: 'Format email tidak valid',
					password: 'Password minimal 10 karakter',
					full_name: 'Nama lengkap minimal 2 karakter'
				}
			});
		}
	});

	test('galat login password salah dan captcha salah mengikuti cookie bahasa', async ({
		request
	}) => {
		const akun = akunBaru('bahasa-login');
		await daftarLewatApi(request, akun);
		const salah = { email: akun.email, password: 'PasswordSalahSekali1' };

		const inggris = await request.post(`${API_URL}/auth/login`, {
			data: await denganCaptcha(request, salah),
			headers: INGGRIS
		});
		expect(inggris.status()).toBe(401);
		expect(await inggris.json()).toEqual({ error: 'Incorrect email or password' });

		const indonesia = await request.post(`${API_URL}/auth/login`, {
			data: await denganCaptcha(request, salah)
		});
		expect(indonesia.status()).toBe(401);
		expect(await indonesia.json()).toEqual({ error: 'Email atau password salah' });

		const captchaInggris = await request.post(`${API_URL}/auth/login`, {
			data: salah,
			headers: INGGRIS
		});
		expect(captchaInggris.status()).toBe(422);
		expect(await captchaInggris.json()).toEqual({
			error: 'The captcha code is wrong or has expired',
			fields: { captcha_answer: 'Type the 6 digits shown in the new image' }
		});

		const captchaIndonesia = await request.post(`${API_URL}/auth/login`, { data: salah });
		expect(captchaIndonesia.status()).toBe(422);
		expect(await captchaIndonesia.json()).toEqual({
			error: 'Kode captcha salah atau sudah kedaluwarsa',
			fields: { captcha_answer: 'Ketik 6 angka pada gambar yang baru' }
		});
	});

	test('respons sukses dan stream SSE tetap utuh dengan cookie en', async ({ request }) => {
		const akun = akunBaru('bahasa-sukses');
		const daftar = await request.post(`${API_URL}/auth/register`, {
			data: { email: akun.email, password: akun.password, full_name: akun.fullName },
			headers: INGGRIS
		});
		expect(daftar.status()).toBe(201);
		const hasilDaftar = await daftar.json();
		expect(hasilDaftar.message).toBe('Account created, check your email to verify it');
		expect(hasilDaftar.user.email).toBe(akun.email);
		expect(hasilDaftar.verification_token).toBeTruthy();

		const sesi = new SesiApi(request);
		const masuk = await sesi.kirim('post', '/auth/login', {
			data: await denganCaptcha(request, { email: akun.email, password: akun.password }),
			headers: INGGRIS
		});
		expect(masuk.status()).toBe(200);
		expect((await masuk.json()).user.email).toBe(akun.email);
		expect(sesi.cookie('tw_access')).toBeTruthy();

		const denganInggris = { Cookie: `${sesi.header}; tw_bahasa=en` };
		const profilIndonesia = await request.get(`${API_URL}/account/me`, {
			headers: { Cookie: sesi.header }
		});
		const profilInggris = await request.get(`${API_URL}/account/me`, { headers: denganInggris });
		expect(profilInggris.status()).toBe(200);
		expect(await profilInggris.text()).toBe(await profilIndonesia.text());

		const stream = await fetch(`${API_URL}/stream`, {
			headers: denganInggris,
			signal: AbortSignal.timeout(10_000)
		});
		expect(stream.status).toBe(200);
		expect(stream.headers.get('content-type')).toContain('text/event-stream');
		const pembaca = stream.body!.getReader();
		const { value } = await pembaca.read();
		expect(new TextDecoder().decode(value)).toContain('"presence"');
		await pembaca.cancel();
	});
});
