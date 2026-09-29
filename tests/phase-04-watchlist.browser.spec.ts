import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL, masukLewatBrowser, sesiMasuk } from './helpers/akun';
import { bukaModalSaham, modalSaham, tambahSaham } from './helpers/watchlist';

function tangkapGalatKonsol(page: Page) {
	const galat: string[] = [];
	page.on('console', (pesan) => {
		if (pesan.type() === 'error') galat.push(pesan.text());
	});
	page.on('pageerror', (kesalahan) => galat.push(kesalahan.message));
	return galat;
}

async function tambah(page: Page, ticker: string) {
	await tambahSaham(page, ticker);
	await expect(page.getByTestId('panel-emiten')).toHaveAttribute('data-ticker', ticker);
}

async function bukaTab(page: Page, nama: 'Harga' | 'Risiko' | 'Pemantauan') {
	const tab = page.getByTestId('panel-emiten').getByRole('tab', { name: new RegExp(nama) });
	await tab.click();
	await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function siap(page: Page) {
	await expect(page.getByTestId('status-langsung')).toHaveAttribute('data-terhubung', 'true');
}

async function tersorot(page: Page, sasaran: Locator) {
	await expect
		.poll(async () => {
			const sorot = await page.getByTestId('tur-sorot').boundingBox();
			const kotak = await sasaran.boundingBox();
			if (!sorot || !kotak) return false;
			return (
				sorot.x <= kotak.x &&
				sorot.y <= kotak.y &&
				sorot.x + sorot.width >= kotak.x + kotak.width &&
				sorot.y + sorot.height >= kotak.y + kotak.height
			);
		})
		.toBe(true);
}

async function pindai(page: Page, ticker: string) {
	const status = await page.evaluate(
		async (alamat) => (await fetch(alamat, { credentials: 'include' })).status,
		`${API_URL}/insights/red-flag/${ticker}`
	);
	expect(status).toBe(200);
}

test.describe('Fase 4: watchlist dari sisi pengguna', () => {
	test('tambah emiten, atur kondisi, lalu keduanya tampil di daftar', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-browser');

		await page.getByTestId('nav-watchlist').click();
		await expect(page).toHaveURL(/\/watchlist/);
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();

		await tambah(page, 'ANTM');

		const item = page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' });
		await expect(item).toBeVisible();
		await expect(item).toContainText('Aneka Tambang Tbk.');

		const panel = page.getByTestId('panel-emiten');
		await bukaTab(page, 'Pemantauan');
		await expect(panel.getByTestId('kondisi')).toHaveCount(1);
		await expect(panel.getByTestId('kondisi')).toHaveAttribute('data-condition-type', 'daily');

		await panel.getByLabel('Jenis kondisi').selectOption('periodic_custom');
		await panel.getByLabel('Setiap berapa jam').fill('8');
		await panel.getByTestId('tambah-kondisi').click();

		const berkala = panel.getByTestId('kondisi').filter({ hasText: 'tiap 8 jam' });
		await expect(berkala).toHaveAttribute('data-condition-type', 'periodic_custom');
		await expect(berkala.getByTestId('status-kondisi')).toContainText('Aktif');
		await expect(berkala.getByTestId('cek-berikutnya')).toContainText('WIB');

		await page.reload();
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' })).toBeVisible();
		await bukaTab(page, 'Pemantauan');
		await expect(page.getByTestId('kondisi')).toHaveCount(2);
		await expect(page.getByTestId('kondisi').filter({ hasText: 'tiap 8 jam' })).toBeVisible();
	});

	test('kondisi bisa dinonaktifkan lalu dihapus', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-kondisi');

		await page.goto('/watchlist');
		await tambah(page, 'PTBA');
		await bukaTab(page, 'Pemantauan');

		const panel = page.getByTestId('panel-emiten');
		const kondisi = panel.getByTestId('kondisi');
		await expect(kondisi.getByTestId('status-kondisi')).toContainText('Aktif');

		await kondisi.getByTestId('toggle-kondisi').click();
		await expect(panel.getByTestId('status-kondisi')).toContainText('Nonaktif');
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'PTBA' })).toContainText(
			'tanpa jadwal'
		);

		await panel.getByTestId('hapus-kondisi').click();
		await expect(panel.getByTestId('kondisi')).toHaveCount(0);
		await expect(panel).toContainText('belum ikut dipindai');
	});

	test('emiten di luar daftar IDX tidak bisa dipilih dan diberi pesan yang jelas', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'wl-tolak');

		await page.goto('/watchlist');
		const modal = await bukaModalSaham(page);
		await modal.getByLabel('Cari saham').fill('ZZZZ');
		await expect(modal.getByTestId('pilih-kosong')).toContainText('ZZZZ');
		await expect(modal.getByTestId('pilih-item')).toHaveCount(0);

		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
		await expect(page).toHaveURL(/\/watchlist$/);
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();
	});

	test('emiten bisa dihapus dari watchlist setelah dikonfirmasi', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-hapus');

		await page.goto('/watchlist');
		await tambah(page, 'INCO');
		await expect(page.getByTestId('watchlist-item')).toHaveCount(1);

		await bukaTab(page, 'Pemantauan');
		await page.getByTestId('hapus-ticker').click();
		await expect(page.getByTestId('panel-emiten')).toContainText('beserta 1 kondisinya');
		await page.getByTestId('konfirmasi-hapus').click();

		await expect(page).toHaveURL(/\/watchlist$/);
		await expect(page.getByTestId('watchlist-kosong')).toBeVisible();
	});

	test('panel emiten menampilkan harga, grafik candle, skor, peristiwa, dan jadwal cek', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'wl-panel');
		const galat = tangkapGalatKonsol(page);

		await page.goto('/watchlist');
		await tambah(page, 'ANTM');
		await pindai(page, 'ANTM');
		await page.reload();
		await siap(page);

		const panel = page.getByTestId('panel-emiten');
		await expect(panel.getByTestId('harga-terakhir')).toHaveText('3.230');
		await expect(panel.getByTestId('perubahan-harian')).toHaveText('▼ 1,22%');
		await expect(panel.getByTestId('skor-badge').first()).toHaveAttribute('data-tier', 'critical');

		const grafik = panel.getByTestId('grafik-emiten');
		await expect(grafik).toBeVisible();
		expect(await grafik.locator('g.lilin').count()).toBeGreaterThan(40);
		await expect(grafik.getByTestId('penanda-peristiwa').first()).toBeVisible();

		const slider = grafik.getByRole('slider');
		await slider.focus();
		await page.keyboard.press('End');
		await expect(slider).toHaveAttribute('aria-valuetext', /harga tutup 3\.230, Red Flag Score \d+/);
		await page.keyboard.press('Home');
		await expect(slider).toHaveAttribute('aria-valuenow', '0');

		await grafik.getByRole('button', { name: 'Tampilkan 1 bulan' }).click();
		expect(await grafik.locator('g.lilin').count()).toBe(22);

		await expect(page.getByTestId('scan-berikutnya')).toBeVisible();
		await expect(page.getByTestId('ringkasan-watchlist')).toContainText('ANTM');

		const daftar = await page.getByRole('region', { name: /Daftar pantauan/ }).boundingBox();
		const ringkasan = await page.getByTestId('ringkasan-watchlist').boundingBox();
		const kotakPanel = await panel.boundingBox();
		expect(Math.abs((ringkasan?.x ?? 0) - (daftar?.x ?? 99))).toBeLessThan(2);
		expect(ringkasan?.y ?? 0).toBeGreaterThan((daftar?.y ?? 0) + (daftar?.height ?? 0));
		expect(kotakPanel?.x ?? 0).toBeGreaterThan((daftar?.x ?? 0) + (daftar?.width ?? 0));

		await bukaTab(page, 'Risiko');
		await expect(grafik).toBeHidden();
		await expect(panel.getByTestId('daftar-peristiwa')).toContainText('Direktur Utama');
		await expect(panel.getByRole('tab', { name: /Risiko/ })).toContainText(/\d+/);

		await page.keyboard.press('ArrowRight');
		const tabPantau = panel.getByRole('tab', { name: /Pemantauan/ });
		await expect(tabPantau).toHaveAttribute('aria-selected', 'true');
		await expect(tabPantau).toBeFocused();
		await expect(panel.getByTestId('cek-berikutnya')).toContainText('WIB');

		await panel.getByTestId('tampilan-insight_only').click();
		await expect(panel.getByTestId('tampilan-insight_only')).toHaveAttribute('aria-pressed', 'true');
		await expect(panel.getByTestId('daftar-peristiwa')).toHaveCount(0);
		await panel.getByTestId('tampilan-insight_plus_data').click();
		await expect(panel.getByTestId('tampilan-insight_plus_data')).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await bukaTab(page, 'Risiko');
		await expect(panel.getByTestId('daftar-peristiwa')).toBeVisible();

		expect(galat).toEqual([]);
	});

	test('daftar bisa diurutkan dan disaring per tingkat risiko', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-urut');

		await page.goto('/watchlist');
		await tambah(page, 'BBCA');
		await tambah(page, 'ANTM');
		await pindai(page, 'BBCA');
		await pindai(page, 'ANTM');
		await page.goto('/watchlist');
		await siap(page);

		const baris = page.getByTestId('watchlist-item');
		await expect(baris.first()).toHaveAttribute('data-ticker', 'ANTM');

		await page.getByRole('button', { name: 'Urutkan berdasarkan Red Flag Score' }).click();
		await expect(baris.first()).toHaveAttribute('data-ticker', 'BBCA');

		await page.getByTestId('saring-critical').click();
		await expect(baris).toHaveCount(1);
		await expect(baris.first()).toHaveAttribute('data-ticker', 'ANTM');

		await page.getByTestId('saring-low').click();
		await expect(baris).toHaveCount(1);
		await expect(baris.first()).toHaveAttribute('data-ticker', 'BBCA');

		await page.getByTestId('saring-semua').click();
		await expect(baris).toHaveCount(2);

		await baris.filter({ hasText: 'BBCA' }).click();
		await expect(page).toHaveURL(/emiten=BBCA/);
		await expect(page.getByTestId('panel-emiten')).toHaveAttribute('data-ticker', 'BBCA');
	});

	test('saham bisa dicari lewat nama lalu ditambah dengan keyboard', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-cari');

		await page.goto('/watchlist');
		await siap(page);
		await page.keyboard.press('/');
		const modal = modalSaham(page);
		await expect(modal.getByLabel('Cari saham')).toBeFocused();
		await page.keyboard.type('aneka');

		const pilihan = modal.getByRole('option', { name: /ANTM/ });
		await expect(pilihan).toContainText('Aneka Tambang');
		await expect(modal.getByTestId('pilih-item')).toHaveCount(1);
		await expect(pilihan).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Enter');
		await expect(pilihan).toContainText('Dipantau');
		await expect(modal.getByTestId('jumlah-ditambah')).toContainText('ANTM');

		await page.keyboard.press('Escape');
		await expect(modal).toBeHidden();
		await expect(page).toHaveURL(/emiten=ANTM/);
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'ANTM' })).toBeVisible();

		await page.keyboard.press('/');
		await page.keyboard.type('ANT');
		await expect(modal.getByRole('option', { name: /ANTM/ })).toContainText('Dipantau');
	});

	test('modal daftar saham bisa disaring per sektor dan menambah beberapa saham sekaligus', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'wl-modal');
		await page.goto('/watchlist');
		await siap(page);

		await page.getByTestId('lihat-semua-saham').click();
		const modal = modalSaham(page);
		await expect(modal).toContainText('10 emiten BEI');
		const pilihan = modal.getByTestId('pilih-item');
		await expect(pilihan).toHaveCount(10);
		await expect(pilihan.first()).toHaveAttribute('data-ticker', 'BBCA');
		await expect(pilihan.first()).toContainText('Keuangan');
		await expect(pilihan.first()).toContainText('7.000');
		await expect(pilihan.first()).toContainText('Rp863 T');

		await modal.getByTestId('sektor-Energy').click();
		await expect(pilihan).toHaveCount(3);
		await modal.getByLabel('Urutkan daftar saham').selectOption('kode');
		await expect(pilihan.first()).toHaveAttribute('data-ticker', 'ADRO');

		await modal.locator('[data-testid="pilih-item"][data-ticker="ADRO"]').click();
		await expect(modal.locator('[data-ticker="ADRO"]')).toContainText('Dipantau');
		await modal.locator('[data-testid="pilih-item"][data-ticker="PTBA"]').click();
		await expect(modal.getByTestId('jumlah-ditambah')).toContainText('ADRO, PTBA');
		await expect(page.getByTestId('watchlist-item')).toHaveCount(2);

		await modal.getByRole('button', { name: 'Selesai' }).click();
		await expect(page).toHaveURL(/emiten=PTBA/);
		await expect(page.getByTestId('panel-emiten')).toHaveAttribute('data-ticker', 'PTBA');
	});

	test('insight baru lewat SSE memunculkan kabar tanpa muat ulang halaman', async ({
		page,
		request
	}) => {
		await masukLewatBrowser(page, 'wl-langsung');
		await page.goto('/watchlist');
		await tambah(page, 'BBRI');
		await siap(page);
		await page.evaluate(() => ((window as unknown as { penanda: string }).penanda = 'sama'));

		const { sesi } = await sesiMasuk(request, 'wl-langsung-pemicu');
		await new Promise((selesai) => setTimeout(selesai, 2400));
		expect((await sesi.kirim('get', '/insights/red-flag/BBRI')).status()).toBe(200);

		await expect(page.getByTestId('kabar-insight')).toContainText('BBRI');
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'BBRI' })).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { penanda?: string }).penanda)).toBe(
			'sama'
		);
	});

	test('di layar 390px detail emiten muncul sebagai lembar dan bisa ditutup', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await masukLewatBrowser(page, 'wl-hp');

		await page.goto('/watchlist');
		await tambah(page, 'MDKA');

		const panel = page.getByTestId('panel-emiten');
		await expect(panel).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

		await siap(page);
		await page.getByRole('link', { name: 'Tutup detail MDKA' }).click();
		await expect(page).toHaveURL(/\/watchlist$/);
		await expect(panel).toBeHidden();
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'MDKA' })).toBeVisible();

		await page.getByTestId('watchlist-item').filter({ hasText: 'MDKA' }).click();
		await expect(panel).toBeInViewport();
		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\/watchlist$/);
	});

	test('kunjungan pertama memunculkan tur yang menjelaskan fungsi watchlist', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-tur', { tur: true });
		const galat = tangkapGalatKonsol(page);

		await page.goto('/watchlist');
		const tur = page.getByRole('dialog');
		await expect(tur).toContainText('Ini watchlist kamu');
		await expect(tur).toContainText('Langkah 1 dari 6');
		await expect(page.getByTestId('tur-sorot')).toHaveCount(0);

		await page.getByTestId('tur-lanjut').click();
		await expect(tur).toContainText('Tambah saham dari sini');
		await tersorot(page, page.getByTestId('buka-pilih-saham'));

		await page.getByTestId('tur-lanjut').click();
		await expect(tur).toContainText('Cara membaca satu baris');
		await expect(page.locator('[data-tur="baris"]')).toContainText('SIMU');
		await tersorot(page, page.locator('[data-tur="baris"]'));

		await page.getByTestId('tur-lanjut').click();
		await expect(tur).toContainText('Lingkaran ini Red Flag Score');
		await tersorot(page, page.locator('[data-tur="skor"]'));

		await page.getByTestId('tur-lanjut').click();
		await expect(tur).toContainText('Belum tahu mulai dari mana?');
		await tersorot(page, page.getByTestId('saran-saham'));

		await page.keyboard.press('ArrowRight');
		await expect(tur).toContainText('Kabar datang ke sini');
		await tersorot(page, page.getByTestId('nav-notifications'));
		await page.getByRole('button', { name: 'Mulai memantau' }).click();
		await expect(tur).toBeHidden();

		await page.reload();
		await siap(page);
		await page.waitForTimeout(900);
		await expect(tur).toBeHidden();

		await page.getByTestId('mulai-tur').click();
		await expect(tur).toContainText('Langkah 1 dari 6');
		await page.keyboard.press('Escape');
		await expect(tur).toBeHidden();
		await expect(page.getByTestId('mulai-tur')).toBeFocused();

		expect(galat).toEqual([]);
	});

	test('saran saham terbesar dari Sectors bisa langsung dipantau', async ({ page }) => {
		await masukLewatBrowser(page, 'wl-saran');
		await page.goto('/watchlist');

		const saran = page.getByTestId('saran-item');
		await expect(saran.first()).toHaveAttribute('data-ticker', 'BBCA');
		await expect(saran.nth(1)).toHaveAttribute('data-ticker', 'BBRI');
		await expect(saran.first()).toContainText('Bank Central Asia Tbk.');
		await expect(saran.first()).toContainText('7.000');
		await expect(saran.first()).toContainText('▲ 0,36%');

		await siap(page);
		await page.getByRole('button', { name: 'Pantau BBRI' }).click();
		await expect(page).toHaveURL(/emiten=BBRI/);
		await expect(page.getByTestId('watchlist-item').filter({ hasText: 'BBRI' })).toBeVisible();

		const modal = await bukaModalSaham(page);
		await expect(modal.getByTestId('pilih-item').first()).toHaveAttribute('data-ticker', 'BBCA');
		await expect(modal.locator('[data-testid="pilih-item"][data-ticker="BBRI"]')).toContainText(
			'Dipantau'
		);
	});

	test('baris memakai harga dan tren harian Sectors walau saham belum dipindai', async ({
		page
	}) => {
		await masukLewatBrowser(page, 'wl-tren');
		await page.goto('/watchlist');
		await tambah(page, 'BRMS');

		const baris = page.getByTestId('watchlist-item').filter({ hasText: 'BRMS' });
		await expect(baris.getByTestId('tren-harga')).toHaveAttribute('data-arah', /naik|turun|datar/);
		await expect(baris).toContainText('1.000');
		await expect(baris.getByTestId('cincin-skor')).toHaveAttribute('data-tier', 'none');
		await expect(page.getByTestId('panel-emiten').getByTestId('harga-terakhir')).toHaveText('1.000');
		await expect(page.getByText(/dari Sectors, bukan harga berjalan\. Garis kecil/)).toBeVisible();
	});

	test('tur muat di layar 390px dan melewati panel detail yang tersembunyi', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await masukLewatBrowser(page, 'wl-tur-hp');

		await page.goto('/watchlist');
		await tambah(page, 'ADRO');
		await siap(page);
		await page.getByRole('link', { name: 'Tutup detail ADRO' }).click();
		await expect(page).toHaveURL(/\/watchlist$/);

		await page.getByTestId('mulai-tur').click();
		const tur = page.getByRole('dialog');
		await expect(tur).toContainText('Langkah 1 dari 5');
		for (let langkah = 1; langkah <= 5; langkah += 1) {
			await expect(tur).toContainText(`Langkah ${langkah} dari 5`);
			const kotak = await tur.boundingBox();
			expect(kotak?.x ?? -1).toBeGreaterThanOrEqual(0);
			expect((kotak?.x ?? 0) + (kotak?.width ?? 999)).toBeLessThanOrEqual(390);
			expect((kotak?.y ?? 0) + (kotak?.height ?? 999)).toBeLessThanOrEqual(844);
			if (langkah < 5) await page.getByTestId('tur-lanjut').click();
		}
		await expect(tur).toContainText('Kabar datang ke sini');
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	});
});
