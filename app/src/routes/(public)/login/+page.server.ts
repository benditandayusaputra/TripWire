import { fail, redirect } from '@sveltejs/kit';
import { panggilApi, pesanGalat, teruskanCookie } from '$lib/server/api';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const totpCode = String(form.get('totp_code') ?? '');

		const { response, payload } = await panggilApi('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password, totp_code: totpCode })
		});

		if (!response.ok) {
			return fail(response.status, {
				email,
				error: pesanGalat(payload, 'Tidak bisa masuk sekarang'),
				lockedUntil: typeof payload?.locked_until === 'string' ? payload.locked_until : '',
				totpRequired: payload?.totp_required === true,
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		teruskanCookie(response, cookies);

		const tujuan = url.searchParams.get('next') ?? '/dashboard';
		redirect(303, tujuan.startsWith('/') ? tujuan : '/dashboard');
	}
};
