import { expect, test } from '@playwright/test';

test.describe('Fase 1: setup proyek', () => {
	test('GET /health membalas 200 dengan Postgres dan Redis terkoneksi', async ({ request }) => {
		const response = await request.get('/health');

		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.status).toBe('ok');
		expect(body.postgres.connected).toBe(true);
		expect(body.redis.connected).toBe(true);
		expect(typeof body.postgres.latency_ms).toBe('number');
		expect(typeof body.redis.latency_ms).toBe('number');
	});

	test('header keamanan dasar terpasang di response', async ({ request }) => {
		const response = await request.get('/health');
		const headers = response.headers();

		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['content-security-policy']).toContain("default-src 'none'");
	});
});
