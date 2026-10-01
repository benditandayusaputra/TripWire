import { fail } from '@sveltejs/kit';
import { apiBaseUrl } from '$lib/api/client';
import { panggilApi, pesanGalat } from '$lib/server/api';
import { teks } from '$lib/bahasa.svelte';
import type { Actions, PageServerLoad } from './$types';

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

export const load: PageServerLoad = async ({ request }) => {
	const { payload } = await panggilApi('/account/profile', {}, request.headers.get('cookie') ?? '');
	return { profil: payload?.user ?? null };
};

export const actions: Actions = {
	unggah: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const berkas = form.get('file');

		if (!(berkas instanceof File) || berkas.size === 0) {
			return fail(400, {
				aksi: 'unggah',
				error: teks(locals.bahasa, 'Pilih berkas gambar dulu', 'Choose an image file first')
			});
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
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal mengunggah foto profil', 'Could not upload your profile photo')
				)
			});
		}

		return { aksi: 'unggah', sukses: true };
	},

	simpan: async ({ request, cookies, locals }) => {
		const form = await request.formData();

		const { response, payload } = await panggilApi(
			'/account/profile',
			{
				method: 'PATCH',
				headers: csrfHeader(cookies),
				body: JSON.stringify({
					full_name: String(form.get('full_name') ?? ''),
					phone_number: String(form.get('phone_number') ?? ''),
					bio: String(form.get('bio') ?? ''),
					timezone: String(form.get('timezone') ?? 'Asia/Jakarta')
				})
			},
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'simpan',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal menyimpan profil', 'Could not save your profile')
				),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		return { aksi: 'simpan', sukses: true };
	},

	hapus: async ({ request, cookies, locals }) => {
		const { response, payload } = await panggilApi(
			'/account/avatar',
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'hapus',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal menghapus foto profil', 'Could not remove your profile photo')
				)
			});
		}

		return { aksi: 'hapus', sukses: true };
	}
};
