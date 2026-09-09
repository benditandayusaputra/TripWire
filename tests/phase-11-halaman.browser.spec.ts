import { expect, test, type Page } from '@playwright/test';
import { API_URL, masukLewatBrowser } from './helpers/akun';

function tangkapGalatKonsol(page: Page) {
	const galat: string[] = [];

	page.on('console', (pesan) => {
		if (pesan.type() === 'error') galat.push(pesan.text());
	});
	page.on('pageerror', (kesalahan) => galat.push(kesalahan.message));

	return galat;
}

async function siapkanInsight(page: Page, ticker: string) {
	await page.goto('/watchlist');
	await page.getByLabel('Kode emiten').fill(ticker);
	await page.getByTestId('tambah-ticker').click();
	await expect(page.getByTestId('watchlist-item').filter({ hasText: ticker })).toBeVisible();

	const hasil = await page.evaluate(async (alamat) => {
		const response = await fetch(alamat, { credentials: 'include' });
		return { status: response.status, body: await response.json().catch(() => null) };
	}, `${API_URL}/insights/red-flag/${ticker}`);

	expect(hasil.status).toBe(200);

	return hasil.body.id as string;
}

test.describe('Fase 11: navigasi seluruh halaman utama', () => {
	test('halaman publik termuat tanpa error console dan elemen kuncinya muncul', async ({ page }) => {
		const galat = tangkapGalatKonsol(page);

		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Red flag');
		await expect(page.getByRole('link', { name: 'Mulai pantau gratis' })).toBeVisible();
		await expect(page.getByTestId('disclaimer-bar')).toBeVisible();

		await page.getByTestId('nav-verifikasi').click();
		await expect(page).toHaveURL(/\/verify-insight/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('keaslian');
		await expect(page.getByLabel('ID insight')).toBeVisible();

		await page.goto('/login');
		await expect(page.getByRole('heading', { level: 1, name: 'Masuk' })).toBeVisible();

		await page.goto('/register');
		await expect(page.getByRole('heading', { level: 1, name: 'Buat akun' })).toBeVisible();

		expect(galat).toEqual([]);
	});

	test('dashboard menampilkan ringkasan dan feed insight dari watchlist', async ({ page }) => {
		const akun = await masukLewatBrowser(page, 'halaman-dashboard');
		const galat = tangkapGalatKonsol(page);

		await page.goto('/dashboard');
		await expect(page.getByTestId('dashboard-heading')).toContainText(akun.fullName);
		await expect(page.getByTestId('ringkasan')).toBeVisible();
		await expect(page.getByTestId('feed-kosong')).toBeVisible();

		await siapkanInsight(page, 'ANTM');

		await page.goto('/dashboard');
		const kartu = page.getByTestId('insight-card').filter({ hasText: 'ANTM' });
		await expect(kartu.first()).toBeVisible();
		await expect(page.getByTestId('ringkasan')).toContainText('1');

		await page.getByTestId('saring-red_flag').click();
		await expect(page).toHaveURL(/type=red_flag/);
		await expect(page.getByTestId('insight-card').first()).toBeVisible();

		expect(galat).toEqual([]);
	});

	test('detail insight menampilkan sub skor, data pendukung, dan badge signature', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'halaman-detail');
		const galat = tangkapGalatKonsol(page);

		const id = await siapkanInsight(page, 'PTBA');

		await page.goto('/dashboard');
		await page.getByTestId('insight-card').filter({ hasText: 'PTBA' }).first().click();
		await expect(page).toHaveURL(/\/insights\/[0-9a-f-]+$/);

		await page.goto(`/insights/${id}`);
		await expect(page.getByTestId('detail-ticker')).toContainText('PTBA');
		await expect(page.getByTestId('detail-judul')).toBeVisible();
		await expect(page.getByTestId('badge-signature')).toHaveAttribute('data-valid', 'true');
		await expect(page.getByTestId('sub-skor').first()).toBeVisible();
		await expect(page.getByTestId('disclaimer-bar')).toBeVisible();

		expect(galat).toEqual([]);
	});

	test('verifikasi publik memeriksa insight nyata tanpa perlu login', async ({ page, browser }) => {
		await masukLewatBrowser(page, 'halaman-verifikasi');
		const id = await siapkanInsight(page, 'MDKA');

		const konteks = await browser.newContext();
		const tamu = await konteks.newPage();
		const galat = tangkapGalatKonsol(tamu);

		await tamu.goto('/verify-insight');
		await tamu.getByLabel('ID insight').fill(id);
		await tamu.getByTestId('verifikasi-submit').click();

		const hasil = tamu.getByTestId('verifikasi-hasil');
		await expect(hasil).toBeVisible();
		await expect(hasil).toHaveAttribute('data-valid', 'true');
		await expect(hasil).toContainText('MDKA');
		await expect(hasil).toContainText('Ed25519');

		expect(galat).toEqual([]);
		await konteks.close();
	});

	test('halaman akun, keamanan, dan perangkat termuat dengan elemen kuncinya', async ({ page }) => {
		const akun = await masukLewatBrowser(page, 'halaman-akun');
		const galat = tangkapGalatKonsol(page);

		await page.goto('/account');
		await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
		await expect(page.getByLabel('Nama lengkap')).toHaveValue(akun.fullName);
		await expect(page.getByTestId('avatar-inisial')).toBeVisible();

		await page.getByLabel('Nama lengkap').fill('Nama Sudah Diubah');
		await page.getByLabel('Tema').selectOption('light');
		await page.getByTestId('simpan-profil').click();

		await expect(page.getByTestId('profil-tersimpan')).toBeVisible();
		await page.reload();
		await expect(page.getByLabel('Nama lengkap')).toHaveValue('Nama Sudah Diubah');
		await expect(page.getByLabel('Tema')).toHaveValue('light');

		await page.getByTestId('tautan-sesi').click();
		await expect(page).toHaveURL(/\/account\/sessions/);
		await expect(page.getByTestId('sesi')).toHaveCount(1);
		await expect(page.getByTestId('sesi-ini')).toBeVisible();

		await page.goto('/account');
		await page.getByTestId('tautan-keamanan').click();
		await expect(page).toHaveURL(/\/account\/security/);
		await expect(page.getByTestId('status-2fa')).toHaveAttribute('data-aktif', 'false');

		expect(galat).toEqual([]);
	});

	test('navigasi utama menjangkau tiap halaman aplikasi', async ({ page }) => {
		await masukLewatBrowser(page, 'halaman-navigasi');
		const galat = tangkapGalatKonsol(page);

		for (const [testid, pola] of [
			['nav-watchlist', /\/watchlist/],
			['nav-notifications', /\/notifications/],
			['nav-account', /\/account/],
			['nav-dashboard', /\/dashboard/]
		] as const) {
			await page.getByTestId(testid).click();
			await expect(page).toHaveURL(pola);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		}

		expect(galat).toEqual([]);
	});
});
