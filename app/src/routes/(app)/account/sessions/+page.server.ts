import { fail } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

type Sesi = {
	id: string;
	device_label: string | null;
	ip_address: string | null;
	issued_at: string;
	last_used_at: string | null;
	expires_at: string;
	current: boolean;
};

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

export const load: PageServerLoad = async ({ request }) => {
	const { payload } = await panggilApi(
		'/account/sessions',
		{},
		request.headers.get('cookie') ?? ''
	);
	return { sessions: (payload?.sessions ?? []) as Sesi[] };
};

export const actions: Actions = {
	cabut: async ({ request, cookies }) => {
		const form = await request.formData();
		const id = String(form.get('session_id') ?? '');

		const { response, payload } = await panggilApi(
			`/account/sessions/${id}`,
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, { error: pesanGalat(payload, 'Gagal mencabut sesi') });
		}

		return { sukses: true };
	},

	cabutLainnya: async ({ request, cookies }) => {
		const { response, payload } = await panggilApi(
			'/account/sessions',
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, { error: pesanGalat(payload, 'Gagal mencabut sesi lain') });
		}

		return { sukses: true, dicabut: payload?.revoked ?? 0 };
	}
};
