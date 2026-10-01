import { fail, redirect } from '@sveltejs/kit';
import { panggilApi, pesanGalat } from '$lib/server/api';
import { teks } from '$lib/bahasa.svelte';
import type { Insight } from '$lib/insight';
import {
	ringkasTren,
	type HasilHarga,
	type ItemWatchlist,
	type Jadwal,
	type Kutipan,
	type Risiko,
	type SahamPasar,
	type Tren
} from '$lib/watchlist';
import type { Actions, PageServerLoad } from './$types';

function konteks(request: Request) {
	return request.headers.get('cookie') ?? '';
}

function csrfHeader(cookies: { get: (name: string) => string | undefined }) {
	return { 'X-CSRF-Token': cookies.get('tw_csrf') ?? '' };
}

async function ambilHarga(id: string, cookie: string, galat: string): Promise<HasilHarga> {
	try {
		const { response, payload } = await panggilApi(`/watchlist/${id}/prices`, {}, cookie);
		if (!response.ok) return { seri: [], galat: pesanGalat(payload, galat) };
		return { seri: payload?.series ?? [], galat: '' };
	} catch {
		return { seri: [], galat };
	}
}

async function ambilTeratas(cookie: string): Promise<SahamPasar[]> {
	try {
		const { response, payload } = await panggilApi('/market/top', {}, cookie);
		return response.ok ? ((payload?.stocks ?? []) as SahamPasar[]) : [];
	} catch {
		return [];
	}
}

async function ambilInsight(ticker: string, cookie: string): Promise<Insight[]> {
	try {
		const { payload } = await panggilApi(`/insights?ticker=${ticker}&limit=6`, {}, cookie);
		return (payload?.insights ?? []) as Insight[];
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ request, url, locals }) => {
	const cookie = konteks(request);

	const [daftar, ringkasan] = await Promise.all([
		panggilApi('/watchlist', {}, cookie),
		panggilApi('/watchlist/overview', {}, cookie)
	]);

	const items = (daftar.payload?.items ?? []) as ItemWatchlist[];
	const risk = (ringkasan.payload?.risk ?? {}) as Record<string, Risiko>;

	const diminta = (url.searchParams.get('emiten') ?? '').toUpperCase();
	const skor = (item: ItemWatchlist) => risk[item.ticker]?.red_flag?.score ?? -1;
	const terpilih =
		items.find((item) => item.ticker === diminta) ??
		[...items].sort((a, b) => skor(b) - skor(a) || a.ticker.localeCompare(b.ticker))[0];

	const galatHarga = teks(
		locals.bahasa,
		'Harga harian belum bisa dimuat',
		'Daily prices could not be loaded'
	);
	const semuaHarga = Promise.all(items.map((item) => ambilHarga(item.id, cookie, galatHarga)));

	return {
		items,
		quotes: (daftar.payload?.quotes ?? {}) as Record<string, Kutipan>,
		risk,
		schedule: (ringkasan.payload?.schedule ?? {
			last_scan_at: null,
			next_scan_at: null,
			conditions: {}
		}) as Jadwal,
		kode: terpilih?.ticker ?? null,
		dipilih: Boolean(terpilih) && terpilih.ticker === diminta,
		tren: semuaHarga.then((daftarHarga) => {
			const peta: Record<string, Tren> = {};
			items.forEach((item, urutan) => {
				const tren = ringkasTren(daftarHarga[urutan].seri);
				if (tren) peta[item.ticker] = tren;
			});
			return peta;
		}),
		harga: terpilih ? semuaHarga.then((daftarHarga) => daftarHarga[items.indexOf(terpilih)]) : null,
		insights: terpilih ? ambilInsight(terpilih.ticker, cookie) : null,
		teratas: ambilTeratas(cookie)
	};
};

export const actions: Actions = {
	tambah: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const ticker = String(form.get('ticker') ?? '')
			.trim()
			.toUpperCase();
		const cookie = konteks(request);

		const { response, payload } = await panggilApi(
			'/watchlist',
			{
				method: 'POST',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ ticker, data_display_pref: 'insight_plus_data' })
			},
			cookie
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'tambah',
				error:
					payload?.fields?.ticker ??
					pesanGalat(
						payload,
						teks(locals.bahasa, 'Gagal menambah emiten', 'Could not add this stock')
					),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		const item = payload?.item as ItemWatchlist;
		if (form.get('pantau_harian') === 'on') {
			await panggilApi(
				`/watchlist/${item.id}/conditions`,
				{
					method: 'POST',
					headers: csrfHeader(cookies),
					body: JSON.stringify({ condition_type: 'daily', config: {} })
				},
				cookie
			);
		}

		await panggilApi(
			`/watchlist/${item.id}/scan`,
			{ method: 'POST', headers: csrfHeader(cookies) },
			cookie
		).catch(() => null);

		if (form.get('tetap') === '1') return { aksi: 'tambah', sukses: true, ticker: item.ticker };
		redirect(303, `/watchlist?emiten=${item.ticker}`);
	},

	hapus: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}`,
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'hapus',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal menghapus emiten', 'Could not remove this stock')
				)
			});
		}

		redirect(303, '/watchlist');
	},

	ubahTampilan: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}`,
			{
				method: 'PATCH',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ data_display_pref: String(form.get('data_display_pref') ?? '') })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'tampilan',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal mengubah tampilan data', 'Could not change the data view')
				)
			});
		}

		return { aksi: 'tampilan', sukses: true };
	},

	tambahKondisi: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionType = String(form.get('condition_type') ?? '');

		const config: Record<string, number> = {};
		const angka = (nama: string) => Number(form.get(nama) ?? 0);
		if (conditionType === 'periodic_custom' && angka('interval_hours') > 0) {
			config.interval_hours = angka('interval_hours');
		}
		if (conditionType === 'weekly' && angka('weekday') > 0) config.weekday = angka('weekday');
		if (
			(conditionType === 'recent_event' || conditionType === 'geopolitical') &&
			form.get('min_score') !== null
		) {
			config.min_score = angka('min_score');
		}

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions`,
			{
				method: 'POST',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ condition_type: conditionType, config })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal menambah kondisi', 'Could not add the condition')
				),
				fields: (payload?.fields ?? {}) as Record<string, string>
			});
		}

		return { aksi: 'kondisi', sukses: true };
	},

	ubahKondisi: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionId = String(form.get('condition_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions/${conditionId}`,
			{
				method: 'PATCH',
				headers: csrfHeader(cookies),
				body: JSON.stringify({ is_active: form.get('is_active') === 'true' })
			},
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal mengubah kondisi', 'Could not update the condition')
				)
			});
		}

		return { aksi: 'kondisi', sukses: true };
	},

	hapusKondisi: async ({ request, cookies, locals }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const conditionId = String(form.get('condition_id') ?? '');

		const { response, payload } = await panggilApi(
			`/watchlist/${id}/conditions/${conditionId}`,
			{ method: 'DELETE', headers: csrfHeader(cookies) },
			konteks(request)
		);

		if (!response.ok) {
			return fail(response.status, {
				aksi: 'kondisi',
				error: pesanGalat(
					payload,
					teks(locals.bahasa, 'Gagal menghapus kondisi', 'Could not delete the condition')
				)
			});
		}

		return { aksi: 'kondisi', sukses: true };
	}
};
