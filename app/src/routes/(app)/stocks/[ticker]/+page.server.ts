import { error } from '@sveltejs/kit';
import { teks } from '$lib/bahasa.svelte';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Insight } from '$lib/insight';
import type { ProfilEmiten } from '$lib/profil';
import { BATAS_WATCHLIST, type HasilHarga, type ItemWatchlist, type Risiko } from '$lib/watchlist';
import type { PageServerLoad } from './$types';

async function ambilHarga(kode: string, cookie: string, galat: string): Promise<HasilHarga> {
	try {
		const { response, payload } = await panggilApi(`/market/${kode}/prices`, {}, cookie);
		if (!response.ok) return { seri: [], galat: pesanGalat(payload, galat) };
		return { seri: payload?.series ?? [], galat: '' };
	} catch {
		return { seri: [], galat };
	}
}

export const load: PageServerLoad = async ({ params, request, locals, depends }) => {
	depends('tripwire:saham');
	const cookie = request.headers.get('cookie') ?? '';
	const kode = encodeURIComponent(params.ticker.toUpperCase());

	const terbaru = (jenis: string) =>
		panggilApi(`/insights?ticker=${kode}&type=${jenis}&limit=1`, {}, cookie)
			.then(({ payload }) => ((payload?.insights ?? []) as Insight[])[0] ?? null)
			.catch(() => null);

	const [profil, daftar, ringkasan, redFlag, pasar] = await Promise.all([
		panggilApi(`/market/${kode}/profile`, {}, cookie),
		panggilApi('/watchlist', {}, cookie).catch(() => null),
		panggilApi('/watchlist/overview', {}, cookie).catch(() => null),
		terbaru('red_flag'),
		terbaru('market_intelligence')
	]);

	if (profil.response.status === 404 || profil.response.status === 422) {
		error(
			404,
			teks(locals.bahasa, 'Saham ini tidak terdaftar di BEI', 'This stock is not listed on IDX')
		);
	}
	if (!profil.response.ok || !profil.payload) {
		error(
			profil.response.status === 503 ? 503 : 502,
			pesanGalat(
				profil.payload,
				teks(locals.bahasa, 'Data Sectors belum bisa dimuat', 'Sectors data could not be loaded')
			)
		);
	}

	const data = profil.payload as unknown as ProfilEmiten;
	const items = (daftar?.payload?.items ?? []) as ItemWatchlist[];

	return {
		profil: data,
		item: items.find((satu) => satu.ticker === data.ticker) ?? null,
		penuh: items.length >= BATAS_WATCHLIST,
		risiko: ((ringkasan?.payload?.risk ?? {}) as Record<string, Risiko>)[data.ticker] ?? null,
		redFlag,
		pasar,
		harga: ambilHarga(
			kode,
			cookie,
			teks(locals.bahasa, 'Harga harian belum bisa dimuat', 'Daily prices could not be loaded')
		)
	};
};
