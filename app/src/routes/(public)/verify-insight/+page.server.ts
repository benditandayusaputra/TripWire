import { apiBaseUrl } from '$lib/api/client';
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

export const load: PageServerLoad = async ({ url }) => {
	const id = (url.searchParams.get('id') ?? '').trim();
	if (!id) return { id: '', hasil: null, galat: '' };

	try {
		const response = await fetch(`${apiBaseUrl}/insights/verify/${encodeURIComponent(id)}`, {
			headers: { Accept: 'application/json' }
		});

		if (response.status === 404) {
			return { id, hasil: null, galat: 'Insight dengan ID itu tidak ditemukan.' };
		}

		const payload = (await response.json()) as Verifikasi;
		return { id, hasil: payload, galat: '' };
	} catch {
		return { id, hasil: null, galat: 'Tidak bisa menghubungi server verifikasi.' };
	}
};
