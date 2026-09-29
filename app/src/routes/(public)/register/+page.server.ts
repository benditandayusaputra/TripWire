import { fail, redirect } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import { teks } from '$lib/bahasa.svelte';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const fullName = String(form.get('full_name') ?? '');

		const { response, payload } = await panggilApi('/auth/register', {
			method: 'POST',
			body: JSON.stringify({ email, password, full_name: fullName })
		});

		if (!response.ok) {
			return fail(response.status, {
				email,
				fullName,
				error: pesanGalat(payload, teks(locals.bahasa, 'Pendaftaran gagal', 'Sign up failed')),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		redirect(303, '/login?registered=1');
	}
};
