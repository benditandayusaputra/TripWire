import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';
import { pngPersegi } from './helpers/gambar';

function tangkapGalatKonsol(page: Page) {
	const galat: string[] = [];
	page.on('console', (pesan) => {
		if (pesan.type() === 'error') galat.push(pesan.text());
	});
	page.on('pageerror', (kesalahan) => galat.push(kesalahan.message));
	return galat;
}

test.describe('Fase 11: halaman saham sebagai pusat', () => {
	test('petak peta pasar membuka halaman saham, lalu Pantau langsung menghitung skornya', async ({
		page
	}) => {
		await page.route('https://storage.googleapis.com/**', (rute) =>
			rute.fulfill({ contentType: 'image/png', body: pngPersegi(40, [22, 90, 200]) })
		);
		await masukLewatBrowser(page, 'hub-saham');
		const galat = tangkapGalatKonsol(page);
		execFileSync('redis-cli', ['-n', '1', 'DEL', 'scheduler:awal:BBRI']);

		await page.goto('/dashboard');
		await page.locator('[data-testid="petak-pasar"][data-ticker="BBRI"] a').click();
		await expect(page).toHaveURL(/\/stocks\/BBRI$/);

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('BBRI');
		await expect(page.getByTestId('harga-saham').getByText('Harga harian dan Red Flag Score', { exact: false })).toBeVisible();
		await expect(page.getByTestId('harga-saham')).toContainText('Kinerja 3 bulan');

		const risiko = page.getByTestId('risiko-saham');
		await expect(risiko).toHaveAttribute('data-status', 'belum');
		await expect(risiko).toContainText('Cek tanda bahaya di BBRI');
		await expect(page.getByRole('link', { name: 'Kembali ke dashboard' })).toBeVisible();

		await page.waitForTimeout(2300);
		await page.getByTestId('pantau-saham').first().click();

		await expect(page.getByTestId('sudah-dipantau')).toBeVisible();
		await expect(risiko).toHaveAttribute('data-status', 'skor', { timeout: 15_000 });
		await expect(risiko).toContainText('baru saja', { timeout: 15_000 });
		await expect(page.getByTestId('skor-saham')).toHaveText(/^\d{1,3}$/);
		await expect(page.getByTestId('rincian-skor')).toHaveAttribute('href', /^\/insights\/[0-9a-f-]{36}$/);
		await expect(page.getByTestId('pasar-saham')).toContainText('Perbandingan sektor');

		await page.setViewportSize({ width: 390, height: 844 });
		await expect(risiko).toBeVisible();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
			.toBeLessThanOrEqual(390);

		await page.getByRole('link', { name: 'Atur pemantauan' }).click();
		await expect(page).toHaveURL(/\/watchlist\?emiten=BBRI$/);
		await expect(page.getByTestId('panel-emiten')).toHaveAttribute('data-ticker', 'BBRI');

		expect(galat).toEqual([]);
	});

	test('penggerak dan arus asing di dashboard menaut ke halaman saham', async ({ page }) => {
		await masukLewatBrowser(page, 'hub-tautan');

		await page.goto('/dashboard');
		const penggerak = page.locator('[data-testid="penggerak-item"]').first();
		const kode = await penggerak.getAttribute('data-ticker');
		await expect(penggerak.getByRole('link')).toHaveAttribute('href', `/stocks/${kode}`);

		const asing = page.locator('[data-testid="asing-item"]').first();
		const kodeAsing = await asing.getAttribute('data-ticker');
		await asing.getByRole('link').click();
		await expect(page).toHaveURL(new RegExp(`/stocks/${kodeAsing}$`));
		await expect(page.getByTestId('risiko-saham')).toBeVisible();
	});
});
