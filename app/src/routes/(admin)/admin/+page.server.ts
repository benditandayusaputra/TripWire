import { fail } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

type Statistik = {
	total_users: number;
	total_watchlist: number;
	total_insight: number;
	kondisi_aktif: number;
};

type Run = {
	mulai_pada: string;
	selesai_pada: string;
	durasi_ms: number;
	pemicu: string;
	kondisi_ditinjau: number;
	ticker_diproses: number;
	insight_baru: number;
	dilewati: number;
	gagal: number;
	catatan: string[];
};

type Pengguna = {
	id: string;
	email: string;
	full_name: string;
	role: string;
	tier: string;
	is_active: boolean;
	totp_enabled: boolean;
	watchlist_count: number;
	last_login_at: string | null;
	created_at: string;
};

export const load: PageServerLoad = async ({ request }) => {
	const cookie = request.headers.get('cookie') ?? '';

	const [stats, credits, scheduler, users] = await Promise.all([
		panggilApi('/admin/stats', {}, cookie),
		panggilApi('/admin/system/credits', {}, cookie),
		panggilApi('/admin/system/scheduler-status', {}, cookie),
		panggilApi('/admin/users?limit=25', {}, cookie)
	]);

	return {
		stats: (stats.payload?.stats ?? {
			total_users: 0,
			total_watchlist: 0,
			total_insight: 0,
			kondisi_aktif: 0
		}) as Statistik,
		credits: (credits.payload?.credits ?? {
			credits_used: 0,
			credits_remaining: 0,
			credit_budget: 0,
			circuit_open: false
		}) as Record<string, number | boolean>,
		terakhir: (scheduler.payload?.scheduler?.terakhir ?? null) as Run | null,
		riwayat: (scheduler.payload?.scheduler?.riwayat ?? []) as Run[],
		users: (users.payload?.users ?? []) as Pengguna[]
	};
};

export const actions: Actions = {
	scan: async ({ request, cookies }) => {
		const { response, payload } = await panggilApi(
			'/admin/system/trigger-scan',
			{ method: 'POST', headers: { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' } },
			request.headers.get('cookie') ?? ''
		);

		if (!response.ok) {
			return fail(response.status, { error: pesanGalat(payload, 'Scan manual gagal dijalankan') });
		}

		return { sukses: true, run: payload?.run as Run };
	}
};
