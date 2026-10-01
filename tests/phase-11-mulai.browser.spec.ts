import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';
import { pngPersegi } from './helpers/gambar';

test.describe('Fase 11: langkah awal pengguna baru', () => {
	test('pengguna baru memilih saham, cara dikabari, lalu watchlist langsung terisi', async ({
		page
	}) => {
		await page.route('https://storage.googleapis.com/**', (rute) =>
			rute.fulfill({ contentType: 'image/png', body: pngPersegi(40, [22, 90, 200]) })
		);
		await masukLewatBrowser(page, 'mulai-baru', { mulai: true });

		const wizard = page.getByTestId('mulai-wizard');
		await expect(wizard).toHaveAttribute('data-langkah', '1');
		await expect(page.getByTestId('mulai-lanjut')).toBeDisabled();

		const bbca = page.locator('[data-testid="mulai-saham-item"][data-ticker="BBCA"]');
		await bbca.click();
		await expect(bbca).toHaveAttribute('aria-pressed', 'true');

		await page.getByTestId('mulai-cari').fill('aneka');
		await page.locator('[data-testid="mulai-hasil-item"][data-ticker="ANTM"]').click();
		await expect(page.locator('[data-testid="mulai-saham-item"][data-ticker="ANTM"]')).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		await page.getByTestId('mulai-lanjut').click();
		await expect(wizard).toHaveAttribute('data-langkah', '2');
		await page.getByText('Seminggu sekali').click();
		await expect(page.getByTestId('mulai-kondisi-mingguan')).toBeChecked();

		await page.getByTestId('mulai-lanjut').click();
		await expect(wizard).toHaveAttribute('data-langkah', '3');
		await expect(page.getByTestId('mulai-terpilih')).toHaveText('BBCA, ANTM');
		await expect(page.getByTestId('mulai-izin')).toBeVisible();

		await page.getByTestId('mulai-selesai').click();
		await expect(page).toHaveURL(/\/watchlist\?emiten=BBCA$/);
		await expect(page.getByTestId('watchlist-item')).toHaveCount(2);
		await expect(page.getByTestId('panel-emiten').getByTestId('kondisi').first()).toHaveAttribute(
			'data-condition-type',
			'weekly'
		);

		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/dashboard$/);
	});

	test('langkah awal bisa dibuka lagi dari dashboard saat watchlist masih kosong', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'mulai-dashboard');

		await expect(page.getByTestId('mulai')).toBeVisible();
		await page.getByTestId('buka-mulai').click();
		await expect(page).toHaveURL(/\/mulai$/);
		await expect(page.getByTestId('mulai-saham-item').first()).toBeVisible();
	});
});
