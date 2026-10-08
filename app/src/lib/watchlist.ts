import type { Insight } from '$lib/insight';
import { labelTransaksi, formatRingkas } from '$lib/insight';
import { lokal, t } from '$lib/bahasa.svelte';

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

export type Tren = { tutup: number[]; tanggal: string };

export type Penutupan = { harga: number; ubah: number | null; tanggal: string };

export type SahamPasar = {
	ticker: string;
	company_name: string;
	sector?: string;
	last_close_price: number | null;
	daily_close_change: number | null;
	market_cap: number | null;
};

function dwibahasa<T extends Record<string, string> | string[]>(
	wadah: T,
	pasangan: Record<string, [string, string]> | [string, string][]
): T {
	for (const [kunci, [id, en]] of Object.entries(pasangan)) {
		Object.defineProperty(wadah, kunci, { get: () => t(id, en), enumerable: true });
	}
	return wadah;
}

export const NAMA_SEKTOR = dwibahasa<Record<string, string>>(
	{},
	{
		Financials: ['Keuangan', 'Financials'],
		'Consumer Non-Cyclicals': ['Konsumen primer', 'Consumer Non-Cyclicals'],
		Energy: ['Energi', 'Energy'],
		'Basic Materials': ['Barang baku', 'Basic Materials'],
		Infrastructures: ['Infrastruktur', 'Infrastructures'],
		'Consumer Cyclicals': ['Konsumen nonprimer', 'Consumer Cyclicals'],
		'Properties & Real Estate': ['Properti', 'Properties & Real Estate'],
		Healthcare: ['Kesehatan', 'Healthcare'],
		Technology: ['Teknologi', 'Technology'],
		Industrials: ['Perindustrian', 'Industrials'],
		'Transportation & Logistic': ['Transportasi', 'Transportation & Logistics'],
		Banks: ['Bank', 'Banks'],
		'Financing Service': ['Pembiayaan', 'Financing Service'],
		'Investment Service': ['Jasa investasi', 'Investment Service'],
		Insurance: ['Asuransi', 'Insurance'],
		'Holding & Investment Companies': [
			'Perusahaan induk dan investasi',
			'Holding & Investment Companies'
		],
		'Oil, Gas & Coal': ['Minyak, gas, dan batu bara', 'Oil, Gas & Coal'],
		'Alternative Energy': ['Energi alternatif', 'Alternative Energy'],
		'Industrial Goods': ['Barang industri', 'Industrial Goods'],
		'Industrial Services': ['Jasa industri', 'Industrial Services'],
		'Multi-sector Holdings': ['Induk multisektor', 'Multi-sector Holdings'],
		'Food & Staples Retailing': ['Ritel bahan pokok', 'Food & Staples Retailing'],
		'Food & Beverage': ['Makanan dan minuman', 'Food & Beverage'],
		Tobacco: ['Rokok', 'Tobacco'],
		'Nondurable Household Products': ['Produk rumah tangga', 'Nondurable Household Products'],
		'Automobiles & Components': ['Otomotif dan komponen', 'Automobiles & Components'],
		'Household Goods': ['Perabot rumah tangga', 'Household Goods'],
		'Consumer Durables & Apparel': ['Barang tahan lama dan pakaian', 'Consumer Durables & Apparel'],
		'Consumer Services': ['Jasa konsumen', 'Consumer Services'],
		'Media & Entertainment': ['Media dan hiburan', 'Media & Entertainment'],
		Retailing: ['Ritel', 'Retailing'],
		'Leisure Goods': ['Barang rekreasi', 'Leisure Goods'],
		'Healthcare Equipment & Providers': [
			'Alat dan layanan kesehatan',
			'Healthcare Equipment & Providers'
		],
		'Pharmaceuticals & Health Care Research': [
			'Farmasi dan riset kesehatan',
			'Pharmaceuticals & Health Care Research'
		],
		'Software & IT Services': ['Perangkat lunak dan jasa TI', 'Software & IT Services'],
		'Technology Hardware & Equipment': [
			'Perangkat keras teknologi',
			'Technology Hardware & Equipment'
		],
		Utilities: ['Utilitas', 'Utilities'],
		Telecommunication: ['Telekomunikasi', 'Telecommunication'],
		'Heavy Constructions & Civil Engineering': [
			'Konstruksi berat',
			'Heavy Constructions & Civil Engineering'
		],
		'Transportation Infrastructure': [
			'Infrastruktur transportasi',
			'Transportation Infrastructure'
		],
		Transportation: ['Transportasi', 'Transportation'],
		'Logistics & Deliveries': ['Logistik dan pengiriman', 'Logistics & Deliveries']
	}
);

export type JenisPeristiwa = 'jual' | 'beli' | 'kepemilikan' | 'suspensi';

export type Peristiwa = { tanggal: string; jenis: JenisPeristiwa; teks: string };

export type Baris = {
	item: ItemWatchlist;
	kutipan: Kutipan | null;
	penutupan: Penutupan | null;
	tren: number[] | null;
	risiko: Risiko | null;
	skor: number | null;
	ubah: number | null;
	aktif: number;
};

export const BATAS_WATCHLIST = 50;
export const BATAS_KRITIS = 86;
export const HARI_TREN = 22;

export function ringkasTren(seri: Harian[]): Tren | null {
	if (!seri.length) return null;
	return {
		tutup: seri.slice(-HARI_TREN).map((bar) => bar.close),
		tanggal: seri[seri.length - 1].date
	};
}

export function penutupanTerbaru(kutipan: Kutipan | null, tren: Tren | null): Penutupan | null {
	const dariKutipan = kutipan && {
		harga: kutipan.last_close_price,
		ubah: kutipan.daily_close_change,
		tanggal: kutipan.latest_close_date ?? ''
	};
	if (!tren || (dariKutipan && dariKutipan.tanggal >= tren.tanggal)) return dariKutipan;
	const [kemarin, terakhir] = tren.tutup.length > 1 ? tren.tutup.slice(-2) : [null, tren.tutup[0]];
	return { harga: terakhir, ubah: kemarin ? terakhir / kemarin - 1 : null, tanggal: tren.tanggal };
}

export function ronaEmiten(kode: string) {
	return 195 + ([...kode].reduce((jumlah, huruf) => jumlah * 31 + huruf.charCodeAt(0), 7) % 130);
}

export const NAMA_KONDISI = dwibahasa<Record<string, string>>(
	{},
	{
		daily: ['Harian', 'Daily'],
		weekly: ['Mingguan', 'Weekly'],
		recent_event: ['Kejadian terbaru', 'Recent events'],
		geopolitical: ['Geopolitik', 'Geopolitical'],
		periodic_custom: ['Berkala, atur sendiri', 'Custom interval']
	}
);

export const NAMA_HARI = dwibahasa<string[]>(
	[],
	[
		['', ''],
		['Senin', 'Monday'],
		['Selasa', 'Tuesday'],
		['Rabu', 'Wednesday'],
		['Kamis', 'Thursday'],
		['Jumat', 'Friday'],
		['Sabtu', 'Saturday'],
		['Minggu', 'Sunday']
	]
);

export const NAMA_SINYAL = dwibahasa<Record<string, string>>(
	{},
	{
		insider_clustering: ['Transaksi orang dalam', 'Insider transactions'],
		ownership_change: ['Perubahan kepemilikan', 'Ownership changes'],
		suspension: ['Riwayat suspensi', 'Suspension history']
	}
);

const persen = (nilai: number) =>
	nilai.toLocaleString(lokal(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatHarga = (nilai: number | null | undefined) =>
	nilai === null || nilai === undefined ? '-' : nilai.toLocaleString(lokal());

export function formatUbah(pecahan: number | null | undefined) {
	if (pecahan === null || pecahan === undefined) return { teks: '-', arah: 0 };
	const arah = pecahan > 0 ? 1 : pecahan < 0 ? -1 : 0;
	const simbol = arah > 0 ? '▲' : arah < 0 ? '▼' : '■';
	return { teks: `${simbol} ${persen(Math.abs(pecahan * 100))}%`, arah };
}

export const formatRupiah = (nilai: number | null | undefined) =>
	nilai === null || nilai === undefined ? '-' : `Rp${formatRingkas(nilai)}`;

export const tanggalWib = (iso: string) =>
	new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });

export function tanggalPendek(tanggal: string) {
	return new Date(`${tanggal.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lokal(), {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC'
	});
}

export function jamCek(iso: string) {
	return new Date(iso)
		.toLocaleString(lokal(), {
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZone: 'Asia/Jakarta'
		})
		.replace(',', '');
}

export function hitungMundur(iso: string, sekarang: number) {
	const menit = Math.max(0, Math.round((new Date(iso).getTime() - sekarang) / 60000));
	if (menit < 1) return t('sebentar lagi', 'any moment now');
	if (menit < 60) return t(`${menit} mnt lagi`, `in ${menit} min`);
	const jam = Math.floor(menit / 60);
	if (jam < 24) return t(`${jam} jam ${menit % 60} mnt lagi`, `in ${jam} hr ${menit % 60} min`);
	const hari = Math.round(jam / 24);
	return t(`${hari} hari lagi`, `in ${hari} ${hari === 1 ? 'day' : 'days'}`);
}

export function detailKondisi(kondisi: Kondisi) {
	const { config } = kondisi;
	if (kondisi.condition_type === 'periodic_custom' && config?.interval_hours) {
		const jam = config.interval_hours;
		return t(`tiap ${jam} jam`, `every ${jam} ${jam === 1 ? 'hour' : 'hours'}`);
	}
	if (kondisi.condition_type === 'weekly' && config?.weekday) {
		return t(
			`tiap ${NAMA_HARI[config.weekday] ?? ''}`,
			`every ${NAMA_HARI[config.weekday] ?? ''}`
		).trim();
	}
	if (config?.min_score !== undefined) {
		return t(`skor minimal ${config.min_score}`, `minimum score ${config.min_score}`);
	}
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
		const jenis = satu.transaction_type;
		hasil.push({
			tanggal: tanggalWib(satu.date),
			jenis: jenis === 'sell' ? 'jual' : jenis === 'buy' ? 'beli' : 'kepemilikan',
			teks: `${satu.holder_name} ${labelTransaksi(satu.transaction_type)}${
				satu.transaction_value
					? t(' senilai ', ' worth ') + formatRupiah(satu.transaction_value)
					: ''
			}`
		});
	}
	for (const satu of data.ownership_changes ?? []) {
		const arah = satu.delta_pp > 0 ? t('naik', 'up') : t('turun', 'down');
		const poin = persen(Math.abs(satu.delta_pp));
		hasil.push({
			tanggal: tanggalWib(satu.last_date),
			jenis: 'kepemilikan',
			teks: t(
				`Porsi ${satu.holder_name} ${arah} ${poin} poin persen`,
				`Stake of ${satu.holder_name} ${arah} ${poin} percentage points`
			)
		});
	}
	for (const satu of data.suspensions ?? []) {
		hasil.push({
			tanggal: tanggalWib(satu.date),
			jenis: 'suspensi',
			teks: t(
				`Perdagangan dihentikan bursa: ${satu.reason}`,
				`Trading suspended by the exchange: ${satu.reason}`
			)
		});
	}
	return hasil.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

export type TabPanel = 'harga' | 'risiko' | 'pemantauan';

export type KunciUrut = 'skor' | 'ubah' | 'kapitalisasi' | 'kode';

const nilaiUrut: Record<KunciUrut, (baris: Baris) => number | string | null> = {
	skor: (baris) => baris.skor,
	ubah: (baris) => baris.ubah,
	kapitalisasi: (baris) => baris.kutipan?.market_cap ?? null,
	kode: (baris) => baris.item.ticker
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
