import { apiBaseUrl } from '$lib/api/client';
import { teks } from '$lib/bahasa.svelte';
import type { PageServerLoad } from './$types';

type Verifikasi = {
	id: string;
	ticker: string;
	insight_type: string;
	subtype: string;
	score: number | null;
	generated_at: string;
	algorithm: string;
	public_key: string;
	digest: string;
	signature: string;
	prev_hash: string | null;
	current_hash: string;
	valid: boolean;
	signature_valid: boolean;
	hash_valid: boolean;
	chain_valid: boolean;
	reason?: string;
};

export const load: PageServerLoad = async ({ url, locals }) => {
	const id = (url.searchParams.get('id') ?? '').trim();
	if (!id) return { id: '', hasil: null, galat: '' };

	try {
		const response = await fetch(`${apiBaseUrl}/insights/verify/${encodeURIComponent(id)}`, {
			headers: { Accept: 'application/json' }
		});

		if (response.status === 404) {
			return {
				id,
				hasil: null,
				galat: teks(
					locals.bahasa,
					'Insight dengan ID itu tidak ditemukan.',
					'No insight was found with that ID.'
				)
			};
		}

		if (response.status !== 200 && response.status !== 409) {
			return {
				id,
				hasil: null,
				galat: teks(
					locals.bahasa,
					'Verifikasi belum bisa dijalankan, coba lagi sebentar lagi.',
					'Verification could not run, please try again shortly.'
				)
			};
		}

		const payload = (await response.json()) as Verifikasi;
		return { id, hasil: payload, galat: '' };
	} catch {
		return {
			id,
			hasil: null,
			galat: teks(
				locals.bahasa,
				'Tidak bisa menghubungi server verifikasi.',
				"Couldn't reach the verification server."
			)
		};
	}
};
