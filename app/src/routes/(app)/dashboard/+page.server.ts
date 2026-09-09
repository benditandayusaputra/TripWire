import { panggilApi } from '$lib/server/api';
import type { Insight } from '$lib/insight';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const jenis = url.searchParams.get('type') ?? '';

	const [feed, ringkasan] = await Promise.all([
		panggilApi(`/insights?limit=20${jenis ? `&type=${jenis}` : ''}`, {}, cookie),
		panggilApi('/account/summary', {}, cookie)
	]);

	return {
		insights: (feed.payload?.insights ?? []) as Insight[],
		summary: (ringkasan.payload?.summary ?? {
			saham_dipantau: 0,
			insight_total: 0,
			insight_kritis: 0,
			kondisi_aktif: 0
		}) as Record<string, number>,
		jenis
	};
};
