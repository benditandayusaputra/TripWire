import { expect, test } from '@playwright/test';

const TABEL_WAJIB = [
	'auth_audit_log',
	'email_verification_tokens',
	'files',
	'insight_events',
	'notifications',
	'password_reset_tokens',
	'push_subscriptions',
	'refresh_tokens',
	'roles',
	'totp_backup_codes',
	'users',
	'watch_conditions',
	'watchlist_items',
	'webauthn_credentials'
];

test.describe('Fase 2: migrasi database', () => {
	test('ke 14 tabel dari schema.sql ada semua', async ({ request }) => {
		const response = await request.get('/health/tables');

		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.tables).toEqual(TABEL_WAJIB);
		expect(body.count).toBe(14);
	});

	test('kolom avatar_file_id ikut ter-migrasi ke tabel users', async ({ request }) => {
		const response = await request.get('/health/tables?columns=users');

		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.columns).toContain('avatar_file_id');
		expect(body.columns).toContain('password_salt');
		expect(body.columns).toContain('locked_until');
	});
});
