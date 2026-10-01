import { panggilApi } from '$lib/server/api';
import type {
	EmitenDipantau,
	Notifikasi,
	PerangkatPush,
	RingkasanNotifikasi
} from '$lib/api/notifications';
import type { PageServerLoad } from './$types';

const PILIHAN: Record<string, string[]> = {
	status: ['unread'],
	type: ['red_flag', 'market_intelligence'],
	tier: ['critical', 'high', 'moderate', 'low']
};

export const load: PageServerLoad = async ({ request, url }) => {
	const cookie = request.headers.get('cookie') ?? '';

	const filter = {
		status: url.searchParams.get('status') ?? '',
		type: url.searchParams.get('type') ?? '',
		tier: url.searchParams.get('tier') ?? '',
		ticker: (url.searchParams.get('ticker') ?? '')
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, '')
			.slice(0, 6)
	};
	for (const [kunci, izin] of Object.entries(PILIHAN)) {
		const nilai = filter[kunci as keyof typeof filter];
		if (!izin.includes(nilai)) filter[kunci as keyof typeof filter] = '';
	}

	const query = new URLSearchParams(Object.entries(filter).filter(([, nilai]) => nilai)).toString();

	const [riwayat, ringkasan, watchlist, perangkat] = await Promise.all([
		panggilApi(`/notifications${query ? `?${query}` : ''}`, {}, cookie),
		panggilApi('/notifications/summary', {}, cookie),
		panggilApi('/watchlist', {}, cookie),
		panggilApi('/push/subscriptions', {}, cookie)
	]);

	return {
		filter,
		query,
		notifications: (riwayat.payload?.notifications ?? []) as Notifikasi[],
		nextCursor: (riwayat.payload?.next_cursor ?? null) as string | null,
		summary: (ringkasan.payload ?? null) as RingkasanNotifikasi | null,
		watchlist: (watchlist.payload?.items ?? []) as EmitenDipantau[],
		devices: (perangkat.payload?.subscriptions ?? []) as PerangkatPush[]
	};
};
