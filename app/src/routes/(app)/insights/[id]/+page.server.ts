import { error } from '@sveltejs/kit';
import { panggilApi } from '$lib/server/api';
import type { Insight } from '$lib/insight';
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

export const load: PageServerLoad = async ({ params, request, locals }) => {
	const { response, payload } = await panggilApi(
		`/insights/${params.id}`,
		{},
		request.headers.get('cookie') ?? ''
	);

	if (!response.ok || !payload) {
		error(404, teks(locals.bahasa, 'Insight tidak ditemukan', 'Insight not found'));
	}

	return {
		insight: payload as unknown as Insight,
		verification: payload.verification as Verifikasi | null
	};
};
