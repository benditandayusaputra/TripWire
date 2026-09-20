import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';
import { bukanGambar, pngPersegi } from './helpers/gambar';

test.describe('Fase 10: avatar dari sisi pengguna', () => {
	test('unggah avatar lalu fotonya tampil di halaman akun dan di header', async ({ page }) => {
		await masukLewatBrowser(page, 'avatar-unggah');

		await page.goto('/account');
		await expect(page.getByTestId('avatar-inisial')).toBeVisible();
		await expect(page.getByTestId('avatar-gambar')).toHaveCount(0);

		await page.setInputFiles('#file', {
			name: 'avatar.png',
			mimeType: 'image/png',
			buffer: pngPersegi(64, [62, 224, 184])
		});
		await page.getByTestId('unggah-avatar').click();

		const gambar = page.getByTestId('avatar-gambar');
		await expect(gambar).toBeVisible();
		await expect(gambar).toHaveAttribute('src', /^http:\/\/127\.0\.0\.1:\d+\/files\/[0-9a-f-]+\?exp=\d+&sig=/);

		const termuat = await gambar.evaluate(
			(node) => (node as HTMLImageElement).naturalWidth > 0
		);
		expect(termuat).toBe(true);

		await expect(page.getByTestId('avatar-header')).toBeVisible();

		await page.reload();
		await expect(page.getByTestId('avatar-gambar')).toBeVisible();
	});

	test('berkas yang bukan gambar ditolak dengan pesan yang jelas', async ({ page }) => {
		await masukLewatBrowser(page, 'avatar-tolak');

		await page.goto('/account');
		await page.setInputFiles('#file', {
			name: 'avatar.png',
			mimeType: 'image/png',
			buffer: bukanGambar()
		});
		await page.getByTestId('unggah-avatar').click();

		await expect(page.getByTestId('avatar-error')).toBeVisible();
		await expect(page.getByTestId('avatar-error')).toContainText('JPEG atau PNG');
		await expect(page.getByTestId('avatar-inisial')).toBeVisible();
	});

	test('avatar bisa dihapus dan tampilannya kembali ke inisial', async ({ page }) => {
		await masukLewatBrowser(page, 'avatar-hapus');

		await page.goto('/account');
		await page.setInputFiles('#file', {
			name: 'avatar.png',
			mimeType: 'image/png',
			buffer: pngPersegi(64, [255, 138, 61])
		});
		await page.getByTestId('unggah-avatar').click();
		await expect(page.getByTestId('avatar-gambar')).toBeVisible();

		await page.getByTestId('hapus-avatar').click();
		await expect(page.getByTestId('avatar-inisial')).toBeVisible();
		await expect(page.getByTestId('avatar-gambar')).toHaveCount(0);
	});
});
