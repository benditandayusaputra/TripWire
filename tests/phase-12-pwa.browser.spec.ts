import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';

test.describe('Fase 12: PWA manifest dan service worker', () => {
	test('manifest ter-load dengan ikon dan metadata yang dibutuhkan pemasangan', async ({ page }) => {
		await page.goto('/');

		const tautan = page.locator('link[rel="manifest"]');
		await expect(tautan).toHaveCount(1);

		const href = await tautan.getAttribute('href');
		expect(href).toBeTruthy();

		const response = await page.request.get(href as string);
		expect(response.status()).toBe(200);

		const manifest = await response.json();
		expect(manifest.name).toContain('TripWire');
		expect(manifest.short_name).toBe('TripWire');
		expect(manifest.start_url).toBe('/dashboard');
		expect(manifest.display).toBe('standalone');
		expect(manifest.theme_color).toBe('#04101F');

		const ukuran = manifest.icons.map((ikon: { sizes: string }) => ikon.sizes);
		expect(ukuran).toContain('192x192');
		expect(ukuran).toContain('512x512');

		const maskable = manifest.icons.filter((ikon: { purpose: string }) =>
			ikon.purpose?.includes('maskable')
		);
		expect(maskable.length).toBeGreaterThan(0);

		for (const ikon of manifest.icons) {
			const berkas = await page.request.get(ikon.src);
			expect(berkas.status(), `ikon ${ikon.src} harus tersedia`).toBe(200);
			expect(berkas.headers()['content-type']).toContain('image/png');
		}
	});

	test('service worker ter-registrasi dan aktif lewat navigator.serviceWorker', async ({ page }) => {
		await page.goto('/');

		await page.waitForFunction(async () => {
			const registrasi = await navigator.serviceWorker.ready;
			return registrasi.active?.state === 'activated';
		});

		const status = await page.evaluate(async () => {
			const registrasi = await navigator.serviceWorker.ready;
			return {
				scope: registrasi.scope,
				state: registrasi.active?.state ?? '',
				skrip: registrasi.active?.scriptURL ?? ''
			};
		});

		expect(status.scope).toBe('http://127.0.0.1:5173/');
		expect(status.state).toBe('activated');
		expect(status.skrip).toContain('service-worker');

		const terdaftar = await page.evaluate(async () => {
			const semua = await navigator.serviceWorker.getRegistrations();
			return semua.length;
		});
		expect(terdaftar).toBeGreaterThan(0);
	});

	test('service worker mengisi cache dan menyediakan halaman offline', async ({ page }) => {
		await page.goto('/');

		await page.evaluate(() => navigator.serviceWorker.ready);

		await page.waitForFunction(async () => {
			const nama = await caches.keys();
			return nama.some((kunci) => kunci.startsWith('tripwire-aset-'));
		});

		const nama = await page.evaluate(() => caches.keys());
		expect(nama.some((kunci) => kunci.startsWith('tripwire-aset-'))).toBe(true);
		expect(nama.some((kunci) => kunci.startsWith('tripwire-halaman-'))).toBe(true);

		await page.goto('/offline');
		await expect(page.getByTestId('judul-offline')).toContainText('offline');
	});

	test('halaman notifikasi menawarkan langganan push lewat service worker', async ({ page }) => {
		await masukLewatBrowser(page, 'pwa-push');

		await page.goto('/notifications');

		await expect(page.getByTestId('status-push')).toBeVisible();
		await expect(page.getByTestId('aktifkan-push')).toBeVisible();

		const dukungan = await page.evaluate(() => ({
			pushManager: 'PushManager' in window,
			notification: 'Notification' in window,
			serviceWorker: 'serviceWorker' in navigator
		}));

		expect(dukungan).toEqual({ pushManager: true, notification: true, serviceWorker: true });
	});

	test('ikon aplikasi dan favicon terlayani untuk pemasangan di layar utama', async ({ page }) => {
		await page.goto('/');

		for (const berkas of [
			'/icons/icon-192.png',
			'/icons/icon-512.png',
			'/icons/icon-maskable-512.png',
			'/icons/apple-touch-icon.png',
			'/favicon.svg'
		]) {
			const response = await page.request.get(berkas);
			expect(response.status(), `${berkas} harus tersedia`).toBe(200);
		}

		await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#04101F');
	});
});
