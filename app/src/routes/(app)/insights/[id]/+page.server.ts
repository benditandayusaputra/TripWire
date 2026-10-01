import { error } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Insight } from '$lib/insight';
import { batasNotifikasi, type HasilHarga, type ItemWatchlist, type Risiko } from '$lib/watchlist';
import { teks } from '$lib/bahasa.svelte';
import type { PageServerLoad } from './$types';

type Verifikasi = {
	valid: boolean;
	signature_valid: boolean;
	hash_valid: boolean;
	chain_valid: boolean;
	algorithm: string;
	public_key: string;
	digest: string;
	reason?: string;
};

async function ambilHarga(kode: string, cookie: string, galat: string): Promise<HasilHarga> {
	try {
		const { response, payload } = await panggilApi(`/market/${kode}/prices`, {}, cookie);
		if (!response.ok) return { seri: [], galat: pesanGalat(payload, galat) };
		return { seri: payload?.series ?? [], galat: '' };
	} catch {
		return { seri: [], galat };
	}
}

export const load: PageServerLoad = async ({ params, request, locals }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const [detail, daftar, ringkasan] = await Promise.all([
		panggilApi(`/insights/${params.id}`, {}, cookie),
		panggilApi('/watchlist', {}, cookie).catch(() => null),
		panggilApi('/watchlist/overview', {}, cookie).catch(() => null)
	]);

	if (!detail.response.ok || !detail.payload) {
		error(404, teks(locals.bahasa, 'Insight tidak ditemukan', 'Insight not found'));
	}

	const insight = detail.payload as unknown as Insight;
	const item = ((daftar?.payload?.items ?? []) as ItemWatchlist[]).find(
		(satu) => satu.ticker === insight.ticker
	);
	const risiko = ((ringkasan?.payload?.risk ?? {}) as Record<string, Risiko>)[insight.ticker];

	return {
		insight,
		verification: detail.payload.verification as Verifikasi | null,
		riwayat: risiko?.history ?? [],
		batas: batasNotifikasi(item?.conditions ?? []),
		harga:
			insight.insight_type === 'red_flag'
				? ambilHarga(
						encodeURIComponent(insight.ticker),
						cookie,
						teks(
							locals.bahasa,
							'Harga harian belum bisa dimuat',
							'Daily prices could not be loaded'
						)
					)
				: null
	};
};
