import { fail } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

type Status = {
	enabled: boolean;
	pending_setup: boolean;
	backup_codes_left: number;
	webauthn_enabled: boolean;
	webauthn_credentials: number;
};

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

export const load: PageServerLoad = async ({ request, cookies }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const { payload } = await panggilApi(
		'/auth/totp/status',
		{ headers: csrfHeader(cookies) },
		cookie
	);

	return {
		status: (payload?.two_factor ?? {
			enabled: false,
			pending_setup: false,
			backup_codes_left: 0,
			webauthn_enabled: false,
			webauthn_credentials: 0
		}) as Status
	};
};

export const actions: Actions = {
	mulai: async ({ request, cookies }) => {
		const { response, payload } = await panggilApi(
			'/auth/totp/setup',
			{ method: 'POST', headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'mulai',
				error: pesanGalat(payload, 'Gagal menyiapkan dua faktor')
			});
		}

		return { aksi: 'mulai', setup: payload?.setup };
	},

	konfirmasi: async ({ request, cookies }) => {
		const form = await request.formData();
		const code = String(form.get('code') ?? '');
		const setupSerialized = String(form.get('setup') ?? '');

		const { response, payload } = await panggilApi(
			'/auth/totp/verify',
			{ method: 'POST', headers: csrfHeader(cookies), body: JSON.stringify({ code }) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'konfirmasi',
				error: pesanGalat(payload, 'Kode verifikasi ditolak'),
				fields: (payload?.fields ?? {}) as Record<string, string>,
				setup: setupSerialized ? JSON.parse(setupSerialized) : undefined
			});
		}

		return { aksi: 'konfirmasi', backupCodes: (payload?.backup_codes ?? []) as string[] };
	},

	matikan: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		const { response, payload } = await panggilApi(
			'/auth/totp/disable',
			{ method: 'POST', headers: csrfHeader(cookies), body: JSON.stringify({ password }) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'matikan',
				error: pesanGalat(payload, 'Gagal mematikan dua faktor'),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		return { aksi: 'matikan', sukses: true };
	},

	kodeBaru: async ({ request, cookies }) => {
		const { response, payload } = await panggilApi(
			'/auth/totp/backup-codes',
			{ headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kodeBaru',
				error: pesanGalat(payload, 'Gagal membuat kode cadangan baru')
			});
		}

		return { aksi: 'kodeBaru', backupCodes: (payload?.backup_codes ?? []) as string[] };
	}
};
