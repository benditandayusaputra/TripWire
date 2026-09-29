import { expect, test, type Page } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';
import { pngPersegi } from './helpers/gambar';
import { bukaModalSaham, tambahSaham } from './helpers/watchlist';

const LOGO_SECTORS = 'https://storage.googleapis.com/sectorsapp-sea/logo/';

async function pilih(page: Page, nilai: string) {
	const panel = page.getByTestId('panel-preferensi');
	if (!(await panel.isVisible())) {
		const tombol = page.getByTestId('tombol-preferensi').first();
		await expect(tombol).toHaveAttribute('data-siap', '');
		await tombol.click();
	}
	await panel.locator(`label:has(input[value="${nilai}"])`).click();
}

function kecerahanLatar(page: Page) {
	return page.evaluate(() => {
		const [r, g, b] = getComputedStyle(document.body)
			.backgroundColor.match(/[\d.]+/g)!
			.map(Number);
		return (r * 299 + g * 587 + b * 114) / 1000;
	});
}

test.describe('Tema terang dan bahasa id/en', () => {
	test('bisa diatur sebelum login, langsung berlaku, dan bertahan setelah muat ulang', async ({
		page
	}) => {
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'id');
		await expect(page.locator('html')).toHaveAttribute('data-tema', 'dark');
		expect(await kecerahanLatar(page)).toBeLessThan(40);

		await pilih(page, 'light');
		await expect(page.locator('html')).toHaveAttribute('data-tema', 'light');
		expect(await kecerahanLatar(page)).toBeGreaterThan(200);

		await pilih(page, 'en');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		const masuk = page.locator('header').getByRole('link', { name: 'Log in', exact: true });
		await expect(masuk).toBeVisible();
		await expect(page.getByTestId('tombol-preferensi')).toContainText('EN');

		const ssr = await (await page.request.get('/login')).text();
		expect(ssr).toContain('<html lang="en" data-tema="light">');

		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('data-tema', 'light');
		await expect(masuk).toBeVisible();

		await masuk.click();
		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByRole('navigation', { name: 'Choose log in or sign up' })).toBeVisible();

		await pilih(page, 'id');
		await pilih(page, 'system');
		await expect(page.locator('html')).toHaveAttribute('lang', 'id');
		await expect(page.getByRole('navigation', { name: 'Pilih masuk atau daftar' })).toBeVisible();
		await page.emulateMedia({ colorScheme: 'dark' });
		expect(await kecerahanLatar(page)).toBeLessThan(40);
		await page.emulateMedia({ colorScheme: 'light' });
		expect(await kecerahanLatar(page)).toBeGreaterThan(200);
	});

	test('navigasi aplikasi memuat pengaturan yang sama dan menerjemahkan menu', async ({ page }) => {
		await masukLewatBrowser(page, 'tema-bahasa-nav');

		await pilih(page, 'en');
		const nav = page.locator('header nav');
		await expect(nav.getByRole('link', { name: 'Home' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Alerts' })).toBeVisible();
		await expect(page.getByTestId('logout-button')).toContainText('Log out');

		await pilih(page, 'light');
		await page.goto('/watchlist');
		await expect(page.locator('html')).toHaveAttribute('data-tema', 'light');
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	});

	test('daftar saham memakai logo asli Sectors, emiten fiktif tetap monogram', async ({ page }) => {
		const diminta: string[] = [];
		await page.route(`${LOGO_SECTORS}**`, (route) => {
			diminta.push(route.request().url());
			return route.fulfill({ contentType: 'image/png', body: pngPersegi(40, [22, 90, 200]) });
		});

		await masukLewatBrowser(page, 'logo-emiten');
		await page.goto('/watchlist');

		const contoh = page.locator('[data-tur="baris"]');
		await expect(contoh).toContainText('SIMU');
		await expect(contoh.getByTestId('logo-emiten')).toHaveCount(0);

		const modal = await bukaModalSaham(page);
		const logoAntm = modal
			.locator('[data-testid="pilih-item"][data-ticker="ANTM"]')
			.getByTestId('logo-emiten');
		await expect(logoAntm).toHaveAttribute('src', `${LOGO_SECTORS}ANTM.webp`);
		await expect
			.poll(() => logoAntm.evaluate((img: HTMLImageElement) => img.naturalWidth))
			.toBeGreaterThan(0);
		await page.keyboard.press('Escape');

		await tambahSaham(page, 'ANTM');
		const baris = page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' });
		await expect(baris.getByTestId('logo-emiten')).toHaveAttribute('src', `${LOGO_SECTORS}ANTM.webp`);
		expect(diminta.some((url) => url.endsWith('/ANTM.webp'))).toBe(true);
		expect(diminta.some((url) => url.includes('SIMU'))).toBe(false);
	});
});
