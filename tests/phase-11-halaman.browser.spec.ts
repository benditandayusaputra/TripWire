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

async function siapkanInsight(page: Page, ticker: string, jenis = 'red-flag') {
	await page.goto('/watchlist');
	await page.getByLabel('Kode emiten').fill(ticker);
	await page.getByTestId('tambah-ticker').click();
	await expect(page.getByTestId('watchlist-item').filter({ hasText: ticker })).toBeVisible();

	const hasil = await page.evaluate(async (alamat) => {
		const response = await fetch(alamat, { credentials: 'include' });
		return { status: response.status, body: await response.json().catch(() => null) };
	}, `${API_URL}/insights/${jenis}/${ticker}`);

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

	test('beranda memutar simulasi, notifikasi terkirim sebelum harga anjlok', async ({ page }) => {
		const galat = tangkapGalatKonsol(page);

		await page.goto('/');
		const terminal = page.getByRole('figure', { name: /Simulasi grafik harga saham fiktif SIMU/ });
		const skor = terminal.getByTestId('skor-badge');
		const putarUlang = terminal.getByRole('button', { name: 'Putar ulang simulasi' });

		await expect(skor).toHaveAttribute('data-tier', 'low');
		await expect(putarUlang).toBeDisabled();

		await expect(skor).toHaveAttribute('data-tier', 'critical', { timeout: 10_000 });
		await expect(terminal.getByText('SIMU menyentuh skor 91, Kritis')).toBeVisible();
		await expect(terminal.getByText('▲')).toBeVisible();

		await expect(putarUlang).toBeEnabled({ timeout: 10_000 });
		await expect(terminal.getByText('▼')).toBeVisible();
		await expect(terminal).toContainText('4 hari bursa lebih awal');

		const slider = terminal.getByRole('slider', { name: 'Telusuri grafik per hari' });
		await slider.focus();
		await page.keyboard.press('Home');
		await expect(slider).toHaveAttribute('aria-valuetext', /1 Jun 2026, harga tutup 1\.180, Red Flag Score 6$/);
		await page.keyboard.press('End');
		await expect(slider).toHaveAttribute('aria-valuetext', /30 Jul 2026, harga tutup 780, Red Flag Score 100$/);

		const gauge = page.getByRole('img', { name: /^Red Flag Score \d+ dari 100/ });
		await expect(gauge).toHaveAttribute('aria-label', 'Red Flag Score 91 dari 100, Kritis');
		await page.getByRole('button', { name: /1 sinyal/ }).click();
		await expect(gauge).toHaveAttribute('aria-label', 'Red Flag Score 70 dari 100, Tinggi');
		await page.getByRole('button', { name: /3 sinyal/ }).click();
		await expect(gauge).toHaveAttribute('aria-label', 'Red Flag Score 100 dari 100, Kritis');

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

	test('detail red flag menampilkan jejak suspensi, insider, dan kepemilikan dari Sectors', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'halaman-detail-jejak');
		const galat = tangkapGalatKonsol(page);

		const id = await siapkanInsight(page, 'ANTM');
		await page.goto(`/insights/${id}`);

		await expect(page.getByTestId('pola-silang')).toContainText('1,6 kali');
		await expect(page.getByTestId('bagian-suspensi')).toContainText('Serius');
		await expect(page.getByTestId('bagian-suspensi').getByRole('link', { name: /Pengumuman resmi/ }).first()).toHaveAttribute('href', /idx\.co\.id/);
		await expect(page.getByTestId('bagian-insider')).toContainText('Direktur Utama');
		await expect(page.getByTestId('bagian-kepemilikan')).toContainText('Inalum (Persero)');
		await expect(page.getByTestId('bagian-kepemilikan')).toContainText('naik 7 poin');
		await expect(page.getByTestId('sumber-data')).toContainText('Laporan transaksi KSEI');

		expect(galat).toEqual([]);
	});

	test('detail market intelligence tambang menampilkan eksposur, peta situs, harga, dan radar lisensi', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'halaman-detail-tambang');
		const galat = tangkapGalatKonsol(page);

		const id = await siapkanInsight(page, 'ADRO', 'market-intelligence');
		await page.goto(`/insights/${id}`);

		await expect(page.getByTestId('detail-judul')).toContainText('Pengaruh harga komoditas');
		await expect(page.getByTestId('komponen-eksposur')).toHaveCount(3);
		await expect(page.getByTestId('bagian-tambang')).toBeVisible();
		await expect(page.getByTestId('peta-situs')).toBeVisible();
		await expect(page.locator('[data-testid="peta-situs"] path.leaflet-interactive')).toHaveCount(2);
		await expect(page.getByTestId('situs-tambang')).toHaveCount(2);
		await expect(page.getByTestId('harga-komoditas')).toContainText('-6%');
		await expect(page.getByTestId('tren-produksi')).toContainText('14 tahun');
		await expect(page.getByTestId('lisensi-segera')).toHaveCount(1);
		await expect(page.getByTestId('lisensi-segera')).toContainText('IUP-ADRO-01');
		await expect(page.getByTestId('sumber-data')).toContainText('Harga komoditas');

		expect(galat.filter((pesan) => !pesan.includes('Failed to load resource'))).toEqual([]);
	});

	test('detail snapshot sektor tanpa skor tidak menampilkan angka nol', async ({ page }) => {
		await masukLewatBrowser(page, 'halaman-detail-sektor');

		const id = await siapkanInsight(page, 'BBCA', 'market-intelligence');
		await page.goto(`/insights/${id}`);

		await expect(page.getByTestId('skor-badge')).toHaveAttribute('data-tier', 'none');
		await expect(page.getByTestId('metrik-sektor')).toHaveCount(5);
		await expect(page.locator('[data-testid="metrik-sektor"][data-kunci="pe"]')).toContainText('-20%');
		await expect(page.locator('[data-testid="metrik-sektor"][data-kunci="revenue_growth"]')).toContainText(
			'naik 2 poin'
		);
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
		await expect(hasil).toContainText('Insight ini asli dari TripWire');
		await tamu.getByText('Detail teknis untuk pemeriksa').click();
		await expect(tamu.getByTestId('detail-teknis')).toContainText('Ed25519');

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

	test('pindah halaman memunculkan progres di atas dan menu tujuan langsung aktif', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'halaman-progres');
		const galat = tangkapGalatKonsol(page);

		await page.route('**/watchlist/__data.json**', async (route) => {
			await new Promise((selesai) => setTimeout(selesai, 1500));
			await route.continue();
		});

		const progres = page.getByTestId('progres-navigasi');
		await expect(progres).toHaveCount(0);

		await page.getByTestId('nav-watchlist').click();
		await expect(progres).toBeVisible();
		await expect(page.getByTestId('nav-watchlist')).toHaveAttribute('aria-current', 'page');
		await expect(page).toHaveURL(/\/dashboard$/);

		await expect(page).toHaveURL(/\/watchlist$/);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(progres).toHaveCount(0);

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
