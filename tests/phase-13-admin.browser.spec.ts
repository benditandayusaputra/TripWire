import { expect, test } from '@playwright/test';
import { akunBaru, jadikanAdmin, masukLewatBrowser } from './helpers/akun';

async function masukSebagai(page: import('@playwright/test').Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await page.waitForURL(/\/dashboard/);
}

test.describe('Fase 13: panel admin dan kontrol aksesnya', () => {
	test('akun biasa ditolak dari rute admin dan tidak melihat tautannya', async ({ page }) => {
		await masukLewatBrowser(page, 'admin-biasa');

		await expect(page.getByTestId('nav-admin')).toHaveCount(0);

		await page.goto('/admin');
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.getByTestId('admin-heading')).toHaveCount(0);
	});

	test('akun biasa juga ditolak di lapisan API dengan 404, bukan 403', async ({ page }) => {
		await masukLewatBrowser(page, 'admin-api');

		const status = await page.evaluate(async () => {
			const jalur = [
				'/admin/stats',
				'/admin/users',
				'/admin/system/credits',
				'/admin/system/scheduler-status'
			];

			const hasil: number[] = [];
			for (const satu of jalur) {
				const response = await fetch(`http://127.0.0.1:8080${satu}`, { credentials: 'include' });
				hasil.push(response.status);
			}
			return hasil;
		});

		expect(status).toEqual([404, 404, 404, 404]);
	});

	test('akun admin bisa membuka panel dan melihat kuota, scheduler, serta daftar pengguna', async ({
		page
	}) => {
		const akun = akunBaru('admin-asli');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();
		await page.waitForURL(/\/login/);

		jadikanAdmin(akun.email);

		await masukSebagai(page, akun.email, akun.password);

		await expect(page.getByTestId('nav-admin')).toBeVisible();
		await page.getByTestId('nav-admin').click();

		await expect(page).toHaveURL(/\/admin/);
		await expect(page.getByTestId('admin-heading')).toBeVisible();
		await expect(page.getByTestId('admin-statistik')).toBeVisible();
		await expect(page.getByTestId('admin-credits')).toContainText('credit');

		const baris = page.getByTestId('admin-user-row');
		await expect(baris.first()).toBeVisible();
		await expect(page.getByTestId('admin-users')).toContainText(akun.email);
	});

	test('admin bisa memicu scan manual dan hasilnya tercatat sebagai run terakhir', async ({
		page
	}) => {
		const akun = akunBaru('admin-scan');

		await page.goto('/register');
		await page.getByLabel('Nama lengkap').fill(akun.fullName);
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Daftar' }).click();
		await page.waitForURL(/\/login/);

		jadikanAdmin(akun.email);
		await masukSebagai(page, akun.email, akun.password);

		await page.goto('/watchlist');
		await page.getByLabel('Kode emiten').fill('ANTM');
		await page.getByTestId('tambah-ticker').click();

		const item = page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' });
		await item.getByLabel('Jenis kondisi').selectOption('daily');
		await item.getByTestId('tambah-kondisi').click();
		await expect(item.getByTestId('kondisi')).toBeVisible();

		await page.goto('/admin');
		await page.getByTestId('trigger-scan').click();

		const terakhir = page.getByTestId('scheduler-terakhir');
		await expect(terakhir).toBeVisible();
		await expect(terakhir).toContainText('manual');
		await expect(terakhir).toContainText('Kondisi ditinjau');

		await page.reload();
		await expect(page.getByTestId('scheduler-terakhir')).toContainText('manual');
	});

	test('pengunjung tanpa sesi diarahkan ke login saat membuka rute admin', async ({ page }) => {
		await page.goto('/admin');
		await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
	});
});
