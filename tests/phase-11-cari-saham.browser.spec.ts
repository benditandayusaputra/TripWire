import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';

test.describe('Fase 11: cari saham dari mana saja', () => {
	test('Ctrl+K membuka pencarian, Enter membuka halaman saham, lalu tercatat sebagai terakhir', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'cari-saham');
		await expect(page.getByTestId('buka-cari-saham')).toHaveAttribute('data-siap', 'true');

		await page.keyboard.press('Control+k');
		const dialog = page.getByRole('dialog', { name: 'Cari saham BEI' });
		await expect(dialog).toBeVisible();
		await expect(page.getByTestId('input-cari-saham')).toBeFocused();

		await page.getByTestId('input-cari-saham').fill('tambang');
		await expect(page.locator('[data-testid="hasil-cari-saham"][data-ticker="ANTM"]')).toBeVisible();
		await expect(page.locator('[data-testid="hasil-cari-saham"][data-ticker="ITMG"]')).toBeVisible();

		await page.getByTestId('input-cari-saham').fill('antm');
		await expect(page.getByTestId('hasil-cari-saham').first()).toHaveAttribute('data-ticker', 'ANTM');
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/stocks\/ANTM$/);
		await expect(dialog).toBeHidden();

		await page.getByTestId('buka-cari-saham').click();
		await expect(dialog).toContainText('Terakhir dibuka');
		await expect(page.locator('[data-testid="hasil-cari-saham"][data-ticker="ANTM"]')).toBeVisible();

		await page.getByTestId('input-cari-saham').fill('zzzzq');
		await expect(page.getByTestId('cari-saham-kosong')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});
});
