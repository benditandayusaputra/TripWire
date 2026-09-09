import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';

test.describe('Fase 4: watchlist dari sisi pengguna', () => {
	test('tambah emiten, atur kondisi, lalu keduanya tampil di daftar', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-browser');

		await page.getByTestId('nav-watchlist').click();
		await expect(page).toHaveURL(/\/watchlist/);
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();

		await page.getByLabel('Kode emiten').fill('ANTM');
		await page.getByTestId('tambah-ticker').click();

		const item = page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' });
		await expect(item).toBeVisible();
		await expect(item).toContainText('Aneka Tambang Tbk.');

		await item.getByLabel('Jenis kondisi').selectOption('periodic_custom');
		await item.getByLabel('Interval jam').fill('8');
		await item.getByTestId('tambah-kondisi').click();

		const kondisi = item.getByTestId('kondisi');
		await expect(kondisi).toHaveAttribute('data-condition-type', 'periodic_custom');
		await expect(kondisi).toContainText('tiap 8 jam');
		await expect(kondisi.getByTestId('status-kondisi')).toContainText('Aktif');

		await page.reload();
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' })).toBeVisible();
		await expect(page.getByTestId('kondisi')).toContainText('tiap 8 jam');
	});

	test('kondisi bisa dinonaktifkan lalu dihapus', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-kondisi');

		await page.goto('/watchlist');
		await page.getByLabel('Kode emiten').fill('PTBA');
		await page.getByTestId('tambah-ticker').click();

		const item = page.getByTestId('watchlist-item').filter({ hasText: 'PTBA' });
		await item.getByLabel('Jenis kondisi').selectOption('daily');
		await item.getByTestId('tambah-kondisi').click();

		const kondisi = item.getByTestId('kondisi');
		await expect(kondisi.getByTestId('status-kondisi')).toContainText('Aktif');

		await kondisi.getByTestId('toggle-kondisi').click();
		await expect(item.getByTestId('status-kondisi')).toContainText('Nonaktif');

		await item.getByTestId('hapus-kondisi').click();
		await expect(item.getByTestId('kondisi')).toHaveCount(0);
	});

	test('emiten di luar daftar IDX ditolak dengan pesan yang jelas', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-tolak');

		await page.goto('/watchlist');
		await page.getByLabel('Kode emiten').fill('ZZZZ');
		await page.getByTestId('tambah-ticker').click();

		await expect(page.getByTestId('watchlist-error')).toBeVisible();
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();
	});

	test('emiten bisa dihapus dari watchlist', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-hapus');

		await page.goto('/watchlist');
		await page.getByLabel('Kode emiten').fill('INCO');
		await page.getByTestId('tambah-ticker').click();
		await expect(page.getByTestId('watchlist-item')).toHaveCount(1);

		await page.getByTestId('hapus-ticker').click();
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();
	});
});
