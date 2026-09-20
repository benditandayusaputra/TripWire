import { expect, test } from '@playwright/test';

test('Fase 1: halaman depan frontend termuat tanpa error console', async ({ page }) => {
	const consoleErrors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});

	await page.goto('/');

	await expect(page.getByRole('link', { name: 'TripWire' }).first()).toBeVisible();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Red flag');
	expect(consoleErrors).toEqual([]);
});
