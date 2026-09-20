import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';
import { kodeTOTP } from './helpers/totp';

test.describe('Fase 9: alur dua faktor dari sisi pengguna', () => {
	test('aktifkan TOTP, terima kode cadangan, lalu masuk lagi memakai kode authenticator', async ({
		page
	}) => {
		const akun = await masukLewatBrowser(page, '2fa-alur');

		await page.goto('/account/security');
		await expect(page.getByTestId('status-2fa')).toHaveAttribute('data-aktif', 'false');

		await page.getByTestId('mulai-2fa').click();

		await expect(page.getByTestId('setup-2fa')).toBeVisible();
		await expect(page.getByTestId('qr-2fa')).toHaveAttribute('src', /^data:image\/png;base64,/);

		const rahasia = (await page.getByTestId('secret-2fa').textContent())?.trim() ?? '';
		expect(rahasia).toMatch(/^[A-Z2-7]{16,}$/);

		await page.getByLabel('Kode dari aplikasi').fill('000000');
		await page.getByTestId('konfirmasi-2fa').click();
		await expect(page.getByTestId('security-error')).toBeVisible();

		await page.getByLabel('Kode dari aplikasi').fill(kodeTOTP(rahasia));
		await page.getByTestId('konfirmasi-2fa').click();

		const kotakCadangan = page.getByTestId('backup-codes');
		await expect(kotakCadangan).toBeVisible();
		await expect(kotakCadangan.locator('li')).toHaveCount(10);
		const kodeCadangan = ((await kotakCadangan.locator('li').first().textContent()) ?? '').trim();

		await page.reload();
		await expect(page.getByTestId('status-2fa')).toHaveAttribute('data-aktif', 'true');
		await expect(page.getByTestId('backup-codes')).toHaveCount(0);

		await page.getByTestId('logout-button').click();
		await expect(page).toHaveURL(/\/login/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page.getByTestId('totp-diperlukan')).toBeVisible();
		await expect(page).toHaveURL(/\/login/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByLabel('Kode verifikasi').fill(kodeTOTP(rahasia));
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page).toHaveURL(/\/dashboard/);
		expect(kodeCadangan).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
	});

	test('kode cadangan bisa dipakai masuk saat authenticator tidak tersedia', async ({ page }) => {
		const akun = await masukLewatBrowser(page, '2fa-cadangan-ui');

		await page.goto('/account/security');
		await page.getByTestId('mulai-2fa').click();

		const rahasia = (await page.getByTestId('secret-2fa').textContent())?.trim() ?? '';
		await page.getByLabel('Kode dari aplikasi').fill(kodeTOTP(rahasia));
		await page.getByTestId('konfirmasi-2fa').click();

		const kodeCadangan = (
			(await page.getByTestId('backup-codes').locator('li').first().textContent()) ?? ''
		).trim();

		await page.getByTestId('logout-button').click();
		await expect(page).toHaveURL(/\/login/);

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page.getByTestId('totp-diperlukan')).toBeVisible();

		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByLabel('Kode verifikasi').fill(kodeCadangan);
		await page.getByRole('button', { name: 'Masuk' }).click();

		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('dua faktor bisa dimatikan lagi setelah konfirmasi password', async ({ page }) => {
		const akun = await masukLewatBrowser(page, '2fa-matikan-ui');

		await page.goto('/account/security');
		await page.getByTestId('mulai-2fa').click();

		const rahasia = (await page.getByTestId('secret-2fa').textContent())?.trim() ?? '';
		await page.getByLabel('Kode dari aplikasi').fill(kodeTOTP(rahasia));
		await page.getByTestId('konfirmasi-2fa').click();
		await expect(page.getByTestId('backup-codes')).toBeVisible();

		await page.reload();
		await page.getByLabel('Konfirmasi password untuk mematikan').fill('PasswordYangSalah123');
		await page.getByTestId('matikan-2fa').click();
		await expect(page.getByTestId('security-error')).toBeVisible();
		await expect(page.getByTestId('status-2fa')).toHaveAttribute('data-aktif', 'true');

		await page.getByLabel('Konfirmasi password untuk mematikan').fill(akun.password);
		await page.getByTestId('matikan-2fa').click();
		await expect(page.getByTestId('status-2fa')).toHaveAttribute('data-aktif', 'false');

		await page.getByTestId('logout-button').click();
		await page.getByLabel('Email').fill(akun.email);
		await page.getByLabel('Password').fill(akun.password);
		await page.getByRole('button', { name: 'Masuk' }).click();
		await expect(page).toHaveURL(/\/dashboard/);
	});
});
