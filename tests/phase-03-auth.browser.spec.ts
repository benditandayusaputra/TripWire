import { expect, test } from '@playwright/test';
import { akunBaru } from './helpers/akun';

test.describe('Fase 3: alur autentikasi dari sisi pengguna', () => {
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
			await page.getByRole('button', { name: 'Masuk' }).click();
			await expect(page.getByTestId('login-error')).toBeVisible();
		}

		await expect(page.getByTestId('login-error')).toContainText('Akun terkunci sementara');

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
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
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page).toHaveURL(/\/dashboard/);

		await page.getByTestId('logout-button').click();
		await expect(page).toHaveURL(/\/login/);

		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
	});
});
