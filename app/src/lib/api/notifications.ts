import { request } from './client';

export type RingkasanInsight = {
	notification_id: string;
	insight_id: string;
	ticker: string;
	company_name: string;
	insight_type: string;
	subtype: string;
	score: number | null;
	category?: string;
	generated_at?: string;
};

export type Notifikasi = {
	id: string;
	insight_event_id: string;
	sent_at: string;
	read_at: string | null;
	ticker?: string;
	insight_type?: string;
	subtype?: string;
	score?: number | null;
	generated_at?: string;
};

export type RiwayatNotifikasi = {
	notifications: Notifikasi[];
	unread: number;
	online: boolean;
};

export function riwayatNotifikasi(fetcher: typeof fetch = fetch) {
	return request<RiwayatNotifikasi>('/notifications', {}, fetcher);
}

export function tandaiDibaca(id: string, fetcher: typeof fetch = fetch) {
	return request<{ notification: Notifikasi }>(
		`/notifications/${id}/read`,
		{ method: 'PATCH' },
		fetcher
	);
}

export function kunciPublikPush(fetcher: typeof fetch = fetch) {
	return request<{ public_key: string; enabled: boolean }>('/push/public-key', {}, fetcher);
}

export function berlanggananPush(
	langganan: { endpoint: string; p256dh: string; auth: string },
	fetcher: typeof fetch = fetch
) {
	return request<{ subscription: { id: string; endpoint: string } }>(
		'/push/subscribe',
		{ method: 'POST', body: JSON.stringify(langganan) },
		fetcher
	);
}
