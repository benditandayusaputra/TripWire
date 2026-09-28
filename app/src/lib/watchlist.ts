import type { Insight } from '$lib/insight';
import { labelTransaksi, formatRingkas } from '$lib/insight';

export type Kondisi = {
	id: string;
	condition_type: string;
	config: Record<string, number>;
	is_active: boolean;
};

export type ItemWatchlist = {
	id: string;
	ticker: string;
	company_name: string;
	data_display_pref: string;
	created_at: string;
	conditions: Kondisi[];
};

export type Kutipan = {
	ticker: string;
	last_close_price: number;
	latest_close_date?: string;
	daily_close_change: number | null;
	market_cap: number | null;
	market_cap_rank: number | null;
	high_52w: number | null;
	low_52w: number | null;
	sector?: string;
	sub_sector?: string;
	indices: string[];
};

export type InsightRingkas = {
	id: string;
	subtype: string;
	score: number | null;
	generated_at: string;
	sub_scores?: Record<string, number>;
	multiplier?: number;
};

export type Risiko = {
	red_flag: InsightRingkas | null;
	previous_score: number | null;
	market: InsightRingkas | null;
	history: { score: number; at: string }[];
	insight_count: number;
};

export type Jadwal = {
	last_scan_at: string | null;
	next_scan_at: string | null;
	conditions: Record<string, string>;
};

export type Harian = {
	date: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number;
	volume: number | null;
};

export type HasilHarga = { seri: Harian[]; galat: string };

export type JenisPeristiwa = 'jual' | 'beli' | 'kepemilikan' | 'suspensi';

export type Peristiwa = { tanggal: string; jenis: JenisPeristiwa; teks: string };

export type Baris = {
	item: ItemWatchlist;
	kutipan: Kutipan | null;
	risiko: Risiko | null;
	skor: number | null;
	ubah: number | null;
	aktif: number;
};

export const BATAS_WATCHLIST = 50;
export const BATAS_KRITIS = 86;

export const NAMA_KONDISI: Record<string, string> = {
	daily: 'Harian',
	weekly: 'Mingguan',
	recent_event: 'Kejadian terbaru',
	geopolitical: 'Geopolitik',
	periodic_custom: 'Berkala, atur sendiri'
};

export const NAMA_HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const NAMA_SINYAL: Record<string, string> = {
	insider_clustering: 'Transaksi orang dalam',
	ownership_change: 'Perubahan kepemilikan',
	suspension: 'Riwayat suspensi'
};

const angka = new Intl.NumberFormat('id-ID');
const persen = new Intl.NumberFormat('id-ID', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export const formatHarga = (nilai: number | null | undefined) =>
	nilai === null || nilai === undefined ? '-' : angka.format(nilai);

export function formatUbah(pecahan: number | null | undefined) {
	if (pecahan === null || pecahan === undefined) return { teks: '-', arah: 0 };
	const arah = pecahan > 0 ? 1 : pecahan < 0 ? -1 : 0;
	const simbol = arah > 0 ? '▲' : arah < 0 ? '▼' : '■';
	return { teks: `${simbol} ${persen.format(Math.abs(pecahan * 100))}%`, arah };
}

export const formatRupiah = (nilai: number | null | undefined) =>
	nilai === null || nilai === undefined ? '-' : `Rp${formatRingkas(nilai)}`;

export const tanggalWib = (iso: string) =>
	new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

export function tanggalPendek(tanggal: string) {
	return new Date(`${tanggal.slice(0, 10)}T00:00:00Z`).toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

export function jamCek(iso: string) {
	return new Date(iso)
		.toLocaleString('id-ID', {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		})
		.replace(',', '');
}

export function hitungMundur(iso: string, sekarang: number) {
	const menit = Math.max(0, Math.round((new Date(iso).getTime() - sekarang) / 60000));
	if (menit < 1) return 'sebentar lagi';
	if (menit < 60) return `${menit} mnt lagi`;
	const jam = Math.floor(menit / 60);
	if (jam < 24) return `${jam} jam ${menit % 60} mnt lagi`;
	return `${Math.round(jam / 24)} hari lagi`;
}

export function detailKondisi(kondisi: Kondisi) {
	const { config } = kondisi;
	if (kondisi.condition_type === 'periodic_custom' && config?.interval_hours) {
		return `tiap ${config.interval_hours} jam`;
	}
	if (kondisi.condition_type === 'weekly' && config?.weekday) {
		return `tiap ${NAMA_HARI[config.weekday] ?? ''}`.trim();
	}
	if (config?.min_score !== undefined) return `skor minimal ${config.min_score}`;
	return '';
}

export function batasNotifikasi(kondisi: Kondisi[]) {
	const ambang = kondisi
		.filter((satu) => satu.is_active && satu.config?.min_score !== undefined)
		.map((satu) => satu.config.min_score);
	return ambang.length ? Math.min(...ambang) : BATAS_KRITIS;
}

export function peristiwaDari(insight: Insight | undefined): Peristiwa[] {
	const data = insight?.payload?.supporting_data;
	if (!data) return [];

	const hasil: Peristiwa[] = [];
	for (const satu of data.insider_transactions ?? []) {
		const jual = satu.transaction_type === 'sell';
		hasil.push({
			tanggal: tanggalWib(satu.date),
			jenis: jual ? 'jual' : 'beli',
			teks: `${satu.holder_name} ${labelTransaksi(satu.transaction_type)}${
				satu.transaction_value ? ` senilai ${formatRupiah(satu.transaction_value)}` : ''
			}`
		});
	}
	for (const satu of data.ownership_changes ?? []) {
		const arah = satu.delta_pp > 0 ? 'naik' : 'turun';
		hasil.push({
			tanggal: tanggalWib(satu.last_date),
			jenis: 'kepemilikan',
			teks: `Porsi ${satu.holder_name} ${arah} ${persen.format(Math.abs(satu.delta_pp))} poin`
		});
	}
	for (const satu of data.suspensions ?? []) {
		hasil.push({
			tanggal: tanggalWib(satu.date),
			jenis: 'suspensi',
			teks: `Perdagangan dihentikan bursa: ${satu.reason}`
		});
	}
	return hasil.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

export type KunciUrut = 'skor' | 'ubah' | 'kapitalisasi' | 'kode' | 'kondisi';

const nilaiUrut: Record<KunciUrut, (baris: Baris) => number | string | null> = {
	skor: (baris) => baris.skor,
	ubah: (baris) => baris.ubah,
	kapitalisasi: (baris) => baris.kutipan?.market_cap ?? null,
	kode: (baris) => baris.item.ticker,
	kondisi: (baris) => baris.aktif
};

export function urutkan(daftar: Baris[], kunci: KunciUrut, naik: boolean) {
	const ambil = nilaiUrut[kunci];
	return [...daftar].sort((a, b) => {
		const x = ambil(a);
		const y = ambil(b);
		if (x === y) return a.item.ticker.localeCompare(b.item.ticker);
		if (x === null) return 1;
		if (y === null) return -1;
		const hasil = x < y ? -1 : 1;
		return naik ? hasil : -hasil;
	});
}
