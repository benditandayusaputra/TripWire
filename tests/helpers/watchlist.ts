import { expect, type Page } from '@playwright/test';

export function modalSaham(page: Page) {
	return page.getByRole('dialog', { name: 'Tambah saham ke watchlist' });
}

export async function bukaModalSaham(page: Page) {
	const modal = modalSaham(page);
	await expect(async () => {
		await page.getByTestId('buka-pilih-saham').click();
		await expect(modal).toBeVisible({ timeout: 1000 });
	}).toPass();
	return modal;
}

export async function tambahSaham(page: Page, ticker: string) {
	const modal = await bukaModalSaham(page);
	await modal.getByLabel('Cari saham').fill(ticker);
	await modal.locator(`[data-testid="pilih-item"][data-ticker="${ticker}"]`).click();
	await expect(modal.getByTestId('jumlah-ditambah')).toContainText(ticker);
	await modal.getByRole('button', { name: 'Selesai' }).click();
	await expect(page).toHaveURL(new RegExp(`emiten=${ticker}`));
}
