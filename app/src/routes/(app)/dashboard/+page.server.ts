import { panggilApi } from '$lib/server/api';
import type { Notifikasi } from '$lib/api/notifications';
import type { ItemWatchlist, Kutipan } from '$lib/dashboard';
import type { Insight } from '$lib/insight';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookie = request.headers.get('cookie') ?? '';

	const [feed, ringkasan, watchlist, notifikasi] = await Promise.all([
		panggilApi('/insights?limit=100', {}, cookie),
		panggilApi('/account/summary', {}, cookie),
		panggilApi('/watchlist', {}, cookie),
		panggilApi('/notifications', {}, cookie)
	]);

	return {
		insights: (feed.payload?.insights ?? []) as Insight[],
		summary: (ringkasan.payload?.summary ?? {
			saham_dipantau: 0,
			insight_total: 0,
			insight_kritis: 0,
			kondisi_aktif: 0
		}) as Record<string, number>,
		items: (watchlist.payload?.items ?? []) as ItemWatchlist[],
		quotes: (watchlist.payload?.quotes ?? {}) as Record<string, Kutipan>,
		notifications: (notifikasi.payload?.notifications ?? []) as Notifikasi[]
	};
};
