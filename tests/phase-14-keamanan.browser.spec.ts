import { expect, test } from '@playwright/test';
import { masukLewatBrowser } from './helpers/akun';

test.describe('Fase 14: lapisan keamanan di sisi browser', () => {
	test('halaman frontend membawa CSP sendiri sebagai lapisan XSS browser', async ({ page }) => {
		const response = await page.goto('/');

		const dariHeader = (await response?.headerValue('content-security-policy')) ?? '';

		const meta = page.locator('meta[http-equiv="content-security-policy" i]');
		const dariMeta =
			(await meta.count()) > 0 ? ((await meta.first().getAttribute('content')) ?? '') : '';

		const csp = dariHeader || dariMeta;

		expect(csp, 'halaman harus mengirim CSP lewat header atau meta').toBeTruthy();
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("form-action 'self'");
	});

	test('tidak ada pelanggaran CSP saat menelusuri halaman utama aplikasi', async ({ page }) => {
		const pelanggaran: string[] = [];

		page.on('console', (pesan) => {
			const teks = pesan.text();
			if (pesan.type() === 'error' && teks.toLowerCase().includes('content security policy')) {
				pelanggaran.push(teks);
			}
		});

		await masukLewatBrowser(page, 'audit-csp');

		for (const jalur of ['/dashboard', '/watchlist', '/notifications', '/account', '/account/security']) {
			await page.goto(jalur);
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		}

		expect(pelanggaran).toEqual([]);
	});

	test('markup berbahaya di badan permintaan ditolak sebelum tersimpan', async ({ page }) => {
		await masukLewatBrowser(page, 'audit-xss');

		const status = await page.evaluate(async () => {
			const ambilCookie = (nama: string) =>
				document.cookie.match(new RegExp(`(?:^|; )${nama}=([^;]*)`))?.[1] ?? '';

			const response = await fetch('http://127.0.0.1:8080/account/profile', {
				method: 'PATCH',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRF-Token': decodeURIComponent(ambilCookie('tw_csrf'))
				},
				body: JSON.stringify({ bio: '<script>alert(1)</script>' })
			});

			return { kode: response.status, isi: await response.json() };
		});

		expect(status.kode).toBe(422);
		expect(status.isi.error).toContain('markup');
	});
});
