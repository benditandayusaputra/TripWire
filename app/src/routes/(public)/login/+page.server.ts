import { fail, redirect } from '@sveltejs/kit';
import { panggilApi, pesanGalat, teruskanCookie } from '$lib/server/api';
import { teks } from '$lib/bahasa.svelte';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const totpCode = String(form.get('totp_code') ?? '');

		const { response, payload } = await panggilApi('/auth/login', {
			method: 'POST',
			body: JSON.stringify({
				email,
				password,
				totp_code: totpCode,
				captcha_id: String(form.get('captcha_id') ?? ''),
				captcha_answer: String(form.get('captcha_answer') ?? '')
			})
		});

		if (!response.ok) {
			return fail(response.status, {
				email,
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Tidak bisa masuk sekarang', "Can't log in right now")
				),
				lockedUntil: typeof payload?.locked_until === 'string' ? payload.locked_until : '',
				totpRequired: payload?.totp_required === true || form.has('totp_code'),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		teruskanCookie(response, cookies);

		const tujuan = new URL(url.searchParams.get('next') ?? '/dashboard', url.origin);
		redirect(303, tujuan.origin === url.origin ? tujuan.pathname + tujuan.search : '/dashboard');
	}
};
