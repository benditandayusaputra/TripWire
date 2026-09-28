import { expect, test } from '@playwright/test';
import { akunBaru, daftarLewatApi } from './helpers/akun';
import { isiCaptcha, jawabanCaptcha } from './helpers/captcha';

test.describe('Fase 3: alur autentikasi dari sisi pengguna', () => {
	test('tombol mata membuka dan menutup isi kolom password', async ({ page }) => {
		for (const halaman of ['/login', '/register']) {
			await page.goto(halaman);
			const kolom = page.getByLabel('Password');
			await kolom.fill('RahasiaKuat123');
			await expect(kolom).toHaveAttribute('type', 'password');

			await page.getByRole('button', { name: 'Tampilkan password' }).click();
			await expect(kolom).toHaveAttribute('type', 'text');
			await expect(kolom).toHaveValue('RahasiaKuat123');

			await page.getByRole('button', { name: 'Sembunyikan password' }).click();
			await expect(kolom).toHaveAttribute('type', 'password');
		}
	});

	test('tombol masuk dan daftar langsung menampilkan status proses saat dikirim', async ({ page }) => {
		await page.route(/\/(login|register)$/, async (route) => {
			if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 1500));
			await route.continue();
		});

		for (const [halaman, tombol] of [
			['/login', 'Masuk'],
			['/register', 'Daftar']
		]) {
			await page.goto(halaman);
			await expect(page.getByRole('button', { name: 'Tampilkan password' })).toBeEnabled();
			if (halaman === '/register') await page.getByLabel('Nama lengkap').fill('Penguji TripWire');
			await page.getByLabel('Email').fill('proses@tripwire.test');
			await page.getByLabel('Password').fill('RahasiaKuat123');
			if (halaman === '/login') await page.getByLabel('Kode captcha').fill('000000');
			await page.getByRole('button', { name: tombol, exact: true }).click();

			const sibuk = page.getByRole('button', { name: 'Memproses' });
			await expect(sibuk).toHaveAttribute('aria-busy', 'true');
			await expect(sibuk).toHaveCSS('opacity', '1');
			await expect(sibuk.locator('.animate-spin')).toBeVisible();
		}
	});

	test('captcha salah ditolak, kode baru dimuat, lalu login berhasil', async ({ page, request }) => {
		const akun = akunBaru('captcha-ui');
		await daftarLewatApi(request, akun);

		await page.goto('/login');
		const idCaptcha = page.locator('input[name="captcha_id"]');
		await expect(idCaptcha).not.toHaveValue('');
		await expect(page.getByTestId('captcha').getByRole('img')).toBeVisible();

		const idAwal = await idCaptcha.inputValue();
		await page.getByRole('button', { name: 'Ganti kode captcha' }).click();
		await expect(idCaptcha).not.toHaveValue(idAwal);

		const idLama = await idCaptcha.inputValue();
		const salah = jawabanCaptcha(idLama).replace(/\d$/, (digit) => String((Number(digit) + 1) % 10));
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByLabel('Kode captcha').fill(salah);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page.getByTestId('login-error')).toContainText('Kode captcha salah');
		await expect(idCaptcha).not.toHaveValue(idLama);
		await expect(page.getByLabel('Kode captcha')).toHaveValue('');

		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('parameter next yang menunjuk domain lain diabaikan setelah login', async ({ page, request }) => {
		const akun = akunBaru('next-luar');
		await daftarLewatApi(request, akun);

		await page.goto('/login?next=%2F%2Fcontoh.invalid%2Fcuri');
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page).toHaveURL(/\/dashboard$/);
		expect(new URL(page.url()).hostname).toBe('127.0.0.1');
	});

	test('halaman masuk dan daftar pas di layar ponsel 390px', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });

		for (const [halaman, tombol] of [
			['/login', 'Masuk'],
			['/register', 'Daftar']
		]) {
			await page.goto(halaman);
			await expect(page.getByRole('link', { name: 'TripWire' })).toBeVisible();
			await expect(page.getByRole('navigation', { name: 'Pilih masuk atau daftar' })).toBeVisible();
			await expect(page.getByRole('button', { name: tombol, exact: true })).toBeInViewport({ ratio: 1 });
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
		}

		await page.getByRole('link', { name: 'Masuk', exact: true }).click();
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByTestId('captcha').getByRole('img')).toBeVisible();
	});

	test('register lalu login mengantar pengguna ke dashboard', async ({ page }) => {
		const akun = akunBaru('browser');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();

		await expect(page).toHaveURL(/\/login\?registered=1/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByTestId('dashboard-heading')).toContainText(akun.fullName);
		await expect(page.getByTestId('current-user')).toContainText(akun.email);
	});

	test('cookie sesi terpasang dengan flag httpOnly, Secure, dan SameSite Strict', async ({
		page,
		context
	}) => {
		const akun = akunBaru('cookie');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();
		await expect(page).toHaveURL(/\/login/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		const cookies = await context.cookies();

		const access = cookies.find((cookie) => cookie.name === 'tw_access');
		expect(access).toBeDefined();
		expect(access?.httpOnly).toBe(true);
		expect(access?.secure).toBe(true);
		expect(access?.sameSite).toBe('Strict');

		const refresh = cookies.find((cookie) => cookie.name === 'tw_refresh');
		expect(refresh?.httpOnly).toBe(true);
		expect(refresh?.secure).toBe(true);
		expect(refresh?.sameSite).toBe('Strict');

		const csrf = cookies.find((cookie) => cookie.name === 'tw_csrf');
		expect(csrf?.httpOnly).toBe(false);
		expect(csrf?.secure).toBe(true);
		expect(csrf?.sameSite).toBe('Strict');
	});

	test('login gagal berulang mengunci akun dan pesan lockout tampil', async ({ page }) => {
		const akun = akunBaru('lockout');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();
		await expect(page).toHaveURL(/\/login/);

		for (let percobaan = 1; percobaan <= 5; percobaan += 1) {
			await page.getByLabel('Email').fill(akun.email);
			await page.getByLabel('Password').fill('PasswordSalahSekali1');
			await isiCaptcha(page);
			await page.getByRole('button', { name: 'Masuk' }).click();
			await expect(page.getByTestId('login-error')).toBeVisible();
		}

		await expect(page.getByTestId('login-error')).toContainText('Akun terkunci sementara');

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page.getByTestId('login-error')).toContainText('Akun terkunci sementara');
		await expect(page).toHaveURL(/\/login/);
	});

	test('rute dashboard menolak pengunjung tanpa sesi', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
	});

	test('keluar mencabut sesi dan memblokir akses dashboard', async ({ page }) => {
		const akun = akunBaru('keluar');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();
		await expect(page).toHaveURL(/\/login/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await isiCaptcha(page);
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		await page.getByTestId('logout-button').click();
		await expect(page).toHaveURL(/\/login/);

		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
	});
});
