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
	company_name?: string;
	insight_type?: string;
	subtype?: string;
	score?: number | null;
	prev_score?: number | null;
	category?: string;
	sub_scores?: Record<string, number>;
	signals?: string[];
	generated_at?: string;
};

export type RiwayatNotifikasi = {
	notifications: Notifikasi[];
	unread: number;
	online: boolean;
	next_cursor: string | null;
};

export type HariNotifikasi = {
	date: string;
	total: number;
	critical: number;
	high: number;
	moderate: number;
	low: number;
	market: number;
};

export type EmitenNotifikasi = {
	ticker: string;
	company_name?: string;
	total: number;
	recent_30_days: number;
	unread: number;
	latest_score: number | null;
	latest_at: string;
	scores: number[];
};

export type RingkasanNotifikasi = {
	total: number;
	unread: number;
	last_7_days: number;
	critical_7_days: number;
	last_30_days: number;
	previous_30_days: number;
	red_flag: number;
	market_intelligence: number;
	critical: number;
	high: number;
	moderate: number;
	low: number;
	last_sent_at: string | null;
	daily: HariNotifikasi[];
	tickers: EmitenNotifikasi[];
	peak_30_days: {
		notification_id: string;
		insight_id: string;
		ticker: string;
		score: number;
		sent_at: string;
	} | null;
	push_devices: number;
	push_enabled: boolean;
	online: boolean;
};

export type PerangkatPush = { id: string; endpoint: string; created_at: string };

export function riwayatNotifikasi(query = '', fetcher: typeof fetch = fetch) {
	return request<RiwayatNotifikasi>(`/notifications${query ? `?${query}` : ''}`, {}, fetcher);
}

export function ringkasanNotifikasi() {
	return request<RingkasanNotifikasi>('/notifications/summary');
}

export function tandaiDibaca(id: string, fetcher: typeof fetch = fetch) {
	return request<{ notification: Notifikasi }>(
		`/notifications/${id}/read`,
		{ method: 'PATCH' },
		fetcher
	);
}

export function tandaiBelumDibaca(id: string) {
	return request<{ notification: Notifikasi }>(`/notifications/${id}/read`, { method: 'DELETE' });
}

export function tandaiSemuaDibaca() {
	return request<{ updated: number }>('/notifications/read-all', { method: 'POST' });
}

export function hapusNotifikasi(id: string) {
	return request<null>(`/notifications/${id}`, { method: 'DELETE' });
}

export function hapusYangDibaca() {
	return request<{ deleted: number }>('/notifications/read', { method: 'DELETE' });
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

export function perangkatPush() {
	return request<{ subscriptions: PerangkatPush[] }>('/push/subscriptions');
}

export function cabutPerangkat(endpoint: string) {
	const kunci = btoa(String.fromCharCode(...new TextEncoder().encode(endpoint)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
	return request<null>(`/push/subscribe/${kunci}`, { method: 'DELETE' });
}

export function kirimContohNotifikasi() {
	return request<{ insight_id: string; ticker: string; via_sse: boolean; via_web_push: boolean }>(
		'/notifications/demo',
		{ method: 'POST' }
	);
}

export function kirimPushUji() {
	return request<{ devices: number; delivered: number }>('/push/test', { method: 'POST' });
}

export type KondisiPeringatan = {
	id: string;
	condition_type: string;
	config: Record<string, number> | null;
	is_active: boolean;
};

export type EmitenDipantau = {
	id: string;
	ticker: string;
	company_name?: string;
	conditions: KondisiPeringatan[];
};

export function ubahKondisiPeringatan(itemId: string, kondisiId: string, aktif: boolean) {
	return request<{ condition: KondisiPeringatan }>(`/watchlist/${itemId}/conditions/${kondisiId}`, {
		method: 'PATCH',
		body: JSON.stringify({ is_active: aktif })
	});
}
