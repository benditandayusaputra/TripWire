import { fail } from '@sveltejs/kit';
import { apiBaseUrl } from '$lib/api/client';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

export const load: PageServerLoad = async ({ request }) => {
	const { payload } = await panggilApi('/account/me', {}, request.headers.get('cookie') ?? '');
	return { profil: payload?.user ?? null };
};

export const actions: Actions = {
	unggah: async ({ request, cookies }) => {
		const form = await request.formData();
		const berkas = form.get('file');

		if (!(berkas instanceof File) || berkas.size === 0) {
			return fail(400, { aksi: 'unggah', error: 'Pilih berkas gambar dulu' });
		}

		const teruskan = new FormData();
		teruskan.append('file', berkas, berkas.name);

		const response = await fetch(`${apiBaseUrl}/account/avatar`, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				cookie: request.headers.get('cookie') ?? '',
				...csrfHeader(cookies)
			},
			body: teruskan
		});

		const payload = await response.json().catch(() => null);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'unggah',
				error: pesanGalat(payload, 'Gagal mengunggah foto profil')
			});
		}

		return { aksi: 'unggah', sukses: true };
	},

	hapus: async ({ request, cookies }) => {
		const { response, payload } = await panggilApi(
			'/account/avatar',
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'hapus',
				error: pesanGalat(payload, 'Gagal menghapus foto profil')
			});
		}

		return { aksi: 'hapus', sukses: true };
	}
};
