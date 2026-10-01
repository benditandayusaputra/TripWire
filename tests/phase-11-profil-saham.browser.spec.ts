import { expect, test, type Page } from '@playwright/test';
import { API_URL, masukLewatBrowser } from './helpers/akun';
import { tambahSaham } from './helpers/watchlist';

function tangkapGalatKonsol(page: Page) {
	const galat: string[] = [];
	page.on('console', (pesan) => {
		if (pesan.type() === 'error') galat.push(pesan.text());
	});
	page.on('pageerror', (kesalahan) => galat.push(kesalahan.message));
	return galat;
}

async function pilihPreferensi(page: Page, nama: 'tw_bahasa' | 'tw_tema', nilai: string) {
	await page.context().addCookies([{ name: nama, value: nilai, url: page.url() }]);
	await page.reload();
}

test.describe('Fase 11: profil saham, pengelola, dan orang di balik saham', () => {
	test('panel watchlist membuka profil berisi pemilik, direksi, komposisi, dan jejak orang dalam', async ({
		page
	}, testInfo) => {
		await masukLewatBrowser(page, 'profil-browser');
		const galat = tangkapGalatKonsol(page);

		await page.goto('/watchlist');
		await tambahSaham(page, 'ANTM');
		const status = await page.evaluate(
			async (alamat) => (await fetch(alamat, { credentials: 'include' })).status,
			`${API_URL}/insights/red-flag/ANTM`
		);
		expect(status).toBe(200);

		await page.goto('/watchlist?emiten=ANTM');
		await page.getByTestId('panel-emiten').getByTestId('buka-profil').click();
		await expect(page).toHaveURL(/\/stocks\/ANTM$/);

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('ANTM');
		await expect(page.getByTestId('nama-emiten')).toHaveText('Aneka Tambang Tbk.');
		await expect(page.getByTestId('balik-pemilik')).toContainText('Inalum (Persero)');
		await expect(page.getByTestId('balik-pemilik')).toContainText('65%');
		await expect(page.getByTestId('balik-pimpinan')).toContainText('Direktur Utama Uji');
		await expect(page.getByTestId('balik-grup')).toContainText('Grup BUMN Uji');
		await expect(page.getByTestId('balik-grup')).toContainText('Grup Afiliasi Uji');
		await expect(page.getByTestId('balik-kakap')).toContainText('Investor Kakap Uji');

		const pengelola = page.getByTestId('pengelola');
		await expect(pengelola.getByRole('heading', { name: 'Direksi' })).toBeVisible();
		await expect(pengelola.getByRole('heading', { name: 'Dewan komisaris' })).toBeVisible();
		await expect(pengelola.getByTestId('pejabat')).toHaveCount(3);
		await expect(pengelola.getByTestId('pejabat').first()).toContainText('Direktur Utama');
		await expect(pengelola.getByTestId('pejabat').last()).toContainText('Komisaris Utama');
		await expect(pengelola.getByTestId('saham-pengelola')).toContainText('244 rb lembar');
		await expect(pengelola.getByTestId('saham-pengelola')).toContainText('0,001%');

		const pemegang = page.getByTestId('pemegang');
		await expect(pemegang).toHaveCount(2);
		await expect(pemegang.first()).toContainText('Inalum (Persero)');
		await expect(pemegang.last()).toContainText('Masyarakat');

		await expect(page.getByTestId('institusi-beli')).toContainText('Dana Pensiun Uji');
		await expect(page.getByTestId('institusi-jual')).toContainText('▼ 8 jt lembar');
		await expect(page.getByTestId('jumlah-pemegang')).toHaveText('512.345');
		await expect(page.getByTestId('kategori-investor')).toHaveCount(3);
		await expect(page.getByTestId('kategori-investor').first()).toContainText('Perorangan');
		await expect(page.getByTestId('jejak').first()).toBeVisible();

		const situs = page.getByTestId('situs-emiten');
		await expect(situs).toHaveAttribute('href', 'https://www.aneka-tambang.test');
		await expect(situs).toHaveAttribute('rel', 'noopener noreferrer');

		await page.screenshot({
			path: testInfo.outputPath('profil-desktop.png'),
			fullPage: true,
			animations: 'disabled'
		});

		await pilihPreferensi(page, 'tw_bahasa', 'en');
		await expect(page.getByRole('heading', { name: 'Who is behind ANTM' })).toBeVisible();
		await expect(page.getByTestId('balik-pimpinan')).toContainText('President Director');
		await expect(page.getByTestId('pemegang').last()).toContainText('Public');

		await pilihPreferensi(page, 'tw_tema', 'light');
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByTestId('siapa-di-balik')).toBeVisible();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
			.toBeLessThanOrEqual(390);
		await page.screenshot({
			path: testInfo.outputPath('profil-390-terang.png'),
			fullPage: true,
			animations: 'disabled'
		});

		expect(galat).toEqual([]);
	});

	test('profil saham yang tidak terdaftar di BEI membalas 404', async ({ page }) => {
		await masukLewatBrowser(page, 'profil-404');

		const response = await page.goto('/stocks/ZZZZ');
		expect(response?.status()).toBe(404);
		await expect(page.getByText('Saham ini tidak terdaftar di BEI')).toBeVisible();
	});
});
