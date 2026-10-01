import { fail, redirect } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import { teks } from '$lib/bahasa.svelte';
import type { ItemWatchlist, SahamPasar } from '$lib/watchlist';
import type { Actions, PageServerLoad } from './$types';

const BATAS_PILIHAN = 5;

const KONDISI: Record<string, { condition_type: string; config: Record<string, number> }> = {
	harian: { condition_type: 'daily', config: {} },
	mingguan: { condition_type: 'weekly', config: { weekday: 1 } },
	penting: { condition_type: 'recent_event', config: { min_score: 61 } }
};

async function ambilSaham(path: string, cookie: string): Promise<SahamPasar[]> {
	try {
		const { response, payload } = await panggilApi(path, {}, cookie);
		return response.ok ? ((payload?.stocks ?? []) as SahamPasar[]) : [];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ request }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const [teratas, daftar] = await Promise.all([
		ambilSaham('/market/top', cookie),
		panggilApi('/watchlist', {}, cookie).catch(() => null)
	]);

	return {
		teratas,
		dipantau: ((daftar?.payload?.items ?? []) as ItemWatchlist[]).map((item) => item.ticker),
		semua: ambilSaham('/market/stocks', cookie)
	};
};

export const actions: Actions = {
	selesai: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const pilihan = [
			...new Set(
				form
					.getAll('ticker')
					.map((nilai) => String(nilai).trim().toUpperCase())
					.filter(Boolean)
			)
		].slice(0, BATAS_PILIHAN);
		const kondisi = KONDISI[String(form.get('kondisi') ?? '')] ?? KONDISI.harian;

		if (pilihan.length === 0) {
			return fail(400, {
				error: teks(locals.bahasa, 'Pilih minimal satu saham.', 'Pick at least one stock.')
			});
		}

		const cookie = request.headers.get('cookie') ?? '';
		const headers = { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
		const ditambah: string[] = [];
		let galat = '';

		for (const ticker of pilihan) {
			const { response, payload } = await panggilApi(
				'/watchlist',
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ ticker, data_display_pref: 'insight_plus_data' })
				},
				cookie
			);

			if (!response.ok) {
				if (response.status !== 409) {
					galat = `${ticker}: ${pesanGalat(
						payload,
						teks(locals.bahasa, 'gagal ditambahkan', 'could not be added')
					)}`;
				}
				continue;
			}

			const item = payload?.item as ItemWatchlist;
			ditambah.push(item.ticker);
			await panggilApi(
				`/watchlist/${item.id}/conditions`,
				{ method: 'POST', headers, body: JSON.stringify(kondisi) },
				cookie
			);
			await panggilApi(`/watchlist/${item.id}/scan`, { method: 'POST', headers }, cookie).catch(
				() => null
			);
		}

		if (ditambah.length === 0 && galat) return fail(400, { error: galat });

		redirect(303, `/watchlist?emiten=${ditambah[0] ?? pilihan[0]}`);
	}
};
