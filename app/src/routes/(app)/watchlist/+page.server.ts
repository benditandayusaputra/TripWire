import { fail } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

type Kondisi = {
	id: string;
	condition_type: string;
	config: Record<string, number>;
	is_active: boolean;
};

type Item = {
	id: string;
	ticker: string;
	company_name: string;
	data_display_pref: string;
	created_at: string;
	conditions: Kondisi[];
};

function konteks(request: Request) {
	return request.headers.get('cookie') ?? '';
}

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

export const load: PageServerLoad = async ({ request }) => {
	const cookie = konteks(request);

	const [daftar, emiten] = await Promise.all([
		panggilApi('/watchlist', {}, cookie),
		panggilApi('/tickers?limit=50', {}, cookie)
	]);

	return {
		items: (daftar.payload?.items ?? []) as Item[],
		tickers: (emiten.payload?.tickers ?? []) as { code: string; name: string }[]
	};
};

export const actions: Actions = {
	tambah: async ({ request, cookies }) => {
		const form = await request.formData();
		const ticker = String(form.get('ticker') ?? '');
		const displayPref = String(form.get('data_display_pref') ?? 'insight_only');

		const { response, payload } = await panggilApi(
			'/watchlist',
			{
				method: 'POST',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ ticker, data_display_pref: displayPref })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'tambah',
				error: pesanGalat(payload, 'Gagal menambah ticker'),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		return { aksi: 'tambah', sukses: true };
	},

	hapus: async ({ request, cookies }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}`,
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'hapus',
				error: pesanGalat(payload, 'Gagal menghapus ticker')
			});
		}

		return { aksi: 'hapus', sukses: true };
	},

	tambahKondisi: async ({ request, cookies }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionType = String(form.get('condition_type') ?? '');

		const config: Record<string, number> = {};
		const interval = Number(form.get('interval_hours') ?? 0);
		const weekday = Number(form.get('weekday') ?? 0);
		if (conditionType === 'periodic_custom' && interval > 0) config.interval_hours = interval;
		if (conditionType === 'weekly' && weekday > 0) config.weekday = weekday;

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions`,
			{
				method: 'POST',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ condition_type: conditionType, config })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(payload, 'Gagal menambah kondisi'),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		return { aksi: 'kondisi', sukses: true };
	},

	ubahKondisi: async ({ request, cookies }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionId = String(form.get('condition_id') ?? '');
		const isActive = form.get('is_active') === 'true';

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions/${conditionId}`,
			{
				method: 'PATCH',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ is_active: isActive })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(payload, 'Gagal mengubah kondisi')
			});
		}

		return { aksi: 'kondisi', sukses: true };
	},

	hapusKondisi: async ({ request, cookies }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionId = String(form.get('condition_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions/${conditionId}`,
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(payload, 'Gagal menghapus kondisi')
			});
		}

		return { aksi: 'kondisi', sukses: true };
	}
};
