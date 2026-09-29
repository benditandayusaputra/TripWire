import { panggilApi } from '$lib/server/api';
import type { Notifikasi } from '$lib/api/notifications';
import type { Insight } from '$lib/insight';
import { ringkasPasar, type RingkasanAsing, type SeriIndeks } from '$lib/pasar';
import type { Harian, ItemWatchlist, Jadwal, Kutipan, Risiko, SahamPasar } from '$lib/watchlist';
import type { PageServerLoad } from './$types';

type Payload = Record<string, any>;

async function ambil<T>(path: string, cookie: string, olah: (payload: Payload) => T) {
	try {
		const { response, payload } = await panggilApi(path, {}, cookie);
		return response.ok && payload ? olah(payload) : null;
	} catch {
		return null;
	}
}

function rampingkan(insights: Insight[]) {
	const terbaru = new Set<string>();
	return insights.map((insight) => {
		const kunci = `${insight.ticker}:${insight.insight_type}`;
		if (!terbaru.has(kunci)) {
			terbaru.add(kunci);
			return insight;
		}
		const { category, cross_pattern } = insight.payload ?? {};
		return { ...insight, payload: { category, cross_pattern } };
	});
}

export const load: PageServerLoad = async ({ request }) => {
	const cookie = request.headers.get('cookie') ?? '';

	const [feed, analisis, watchlist, ringkasan, notifikasi] = await Promise.all([
		panggilApi('/insights?limit=100', {}, cookie),
		panggilApi('/insights?type=market_intelligence&limit=40', {}, cookie),
		panggilApi('/watchlist', {}, cookie),
		panggilApi('/watchlist/overview', {}, cookie),
		panggilApi('/notifications?limit=6', {}, cookie)
	]);

	const items = (watchlist.payload?.items ?? []) as ItemWatchlist[];
	const insights = [
		...new Map(
			[...(feed.payload?.insights ?? []), ...(analisis.payload?.insights ?? [])].map(
				(insight: Insight) => [insight.id, insight]
			)
		).values()
	].sort((a, b) => b.generated_at.localeCompare(a.generated_at));

	return {
		insights: rampingkan(insights),
		items,
		quotes: (watchlist.payload?.quotes ?? {}) as Record<string, Kutipan>,
		risk: (ringkasan.payload?.risk ?? {}) as Record<string, Risiko>,
		schedule: (ringkasan.payload?.schedule ?? {
			last_scan_at: null,
			next_scan_at: null,
			conditions: {}
		}) as Jadwal,
		notifications: (notifikasi.payload?.notifications ?? []) as Notifikasi[],
		harga: Promise.all(
			items.map((item) =>
				ambil(`/watchlist/${item.id}/prices`, cookie, (isi) => (isi.series ?? []) as Harian[])
			)
		).then((daftar) =>
			Object.fromEntries(items.map((item, urutan) => [item.ticker, daftar[urutan] ?? []]))
		),
		indeks: ambil('/market/index/ihsg', cookie, (isi) => isi as SeriIndeks),
		pasar: ambil('/market/stocks', cookie, (isi) =>
			ringkasPasar((isi.stocks ?? []) as SahamPasar[])
		),
		asing: ambil('/market/foreign-flow', cookie, (isi) => isi as RingkasanAsing)
	};
};
