import { error } from '@sveltejs/kit';
import { teks } from '$lib/bahasa.svelte';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Insight } from '$lib/insight';
import type { ProfilEmiten } from '$lib/profil';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, locals }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const kode = encodeURIComponent(params.ticker.toUpperCase());

	const [profil, feed] = await Promise.all([
		panggilApi(`/market/${kode}/profile`, {}, cookie),
		panggilApi(`/insights?ticker=${kode}&type=red_flag&limit=1`, {}, cookie).catch(() => null)
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

	return {
		profil: profil.payload as unknown as ProfilEmiten,
		redFlag: ((feed?.payload?.insights ?? []) as Insight[])[0] ?? null
	};
};
