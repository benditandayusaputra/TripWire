import { lokal, t } from '$lib/bahasa.svelte';

export type SubScores = Record<string, number>;

export type Suspensi = {
	date: string;
	reason: string;
	severity_tier: number;
	pdf_url?: string;
};

export type TransaksiInsider = {
	date: string;
	holder_name: string;
	holder_type?: string;
	transaction_type: string;
	transaction_value: number;
	share_pct_before?: number;
	share_pct_after?: number;
	source_url?: string;
};

export type PerubahanKepemilikan = {
	holder_name: string;
	share_pct_before: number;
	share_pct_after: number;
	delta_pp: number;
	first_date: string;
	last_date: string;
	filings: number;
};

export type PemegangSaham = { name: string; percentage: number };

export type DataPendukung = {
	suspensions?: Suspensi[];
	insider_transactions?: TransaksiInsider[];
	ownership_changes?: PerubahanKepemilikan[];
	major_shareholders?: PemegangSaham[];
	free_float_pct?: number;
	free_float_factor?: number;
	insider_count_in_window?: number;
	insider_net_direction?: number;
	delta_concentration_pp?: number;
};

export type MetrikSektor = {
	key: string;
	label: string;
	unit: string;
	year: number;
	value: number;
	sector_average: number;
	difference: number;
	difference_pct: number | null;
	position: string;
	basis: string;
};

export type SnapshotSektor = {
	sector?: string;
	sub_sector?: string;
	industry?: string;
	sub_industry?: string;
	metrics?: MetrikSektor[];
};

export type EksposurKomoditas = {
	score: number;
	category: string;
	base_score: number;
	components: {
		production_trend: number | null;
		commodity_price_trend: number | null;
		reserve_life: number | null;
	};
	entity_type: string;
	entity_factor: number;
	commodity: string;
};

export type TrenProduksi = {
	commodity: string;
	year: number;
	previous_year: number;
	rows: {
		sub_type: string;
		unit: string;
		production: number;
		previous_production: number | null;
		yoy_pct: number | null;
	}[];
	yoy_pct: number | null;
	reserve_life_years: number | null;
	reserve_unit?: string;
	reserves: number | null;
};

export type HargaKomoditas = {
	commodity: string;
	unit: string;
	latest: number;
	latest_date: string;
	previous: number | null;
	previous_date?: string;
	yoy_pct: number | null;
	series: { date: string; price: number }[];
};

export type LisensiTambang = {
	license_id: string;
	license_type?: string;
	commodity: string;
	status: string;
	province?: string;
	city?: string;
	expires_at: string;
	expired: boolean;
};

export type SitusTambang = {
	name: string;
	commodity: string;
	province: string;
	city: string;
	region: string;
	latitude: number | null;
	longitude: number | null;
	production_volume: number | null;
	unit?: string;
	year?: number;
};

export type InsightPayload = {
	category?: string;
	base_score?: number;
	sub_scores?: SubScores;
	cross_pattern?: {
		window_days?: number;
		active_signals?: string[];
		multiplier_applied?: number;
		signals_active_in_window?: number;
	};
	supporting_data?: DataPendukung;
	data_sources?: string[];
	mode?: string;
	sector_snapshot?: SnapshotSektor;
	mining_profile?: {
		slug: string;
		name: string;
		company_type: string;
		key_operation: string;
		commodities: string[];
		site_count: number;
	};
	commodity_exposure?: EksposurKomoditas;
	production_trend?: TrenProduksi;
	commodity_price?: HargaKomoditas;
	license_radar?: {
		window_days: number;
		total_licenses: number;
		expiring_soon: LisensiTambang[];
		has_expiring_license: boolean;
	};
	mine_sites?: SitusTambang[];
};

export type Insight = {
	id: string;
	ticker: string;
	company_name: string;
	insight_type: string;
	subtype: string;
	score: number | null;
	payload: InsightPayload;
	signature: string;
	prev_hash: string | null;
	current_hash: string;
	generated_at: string;
};

type Pasangan = [string, string];

const LABEL_SINYAL: Record<string, Pasangan> = {
	suspension: ['Suspensi saham', 'Trading suspension'],
	insider_clustering: ['Transaksi orang dalam', 'Insider transactions'],
	ownership_change: ['Perubahan pemegang saham', 'Shareholder changes']
};

const LABEL_SUBTYPE: Record<string, Pasangan> = {
	governance_risk_composite: ['Risiko tata kelola', 'Governance risk'],
	sector_relative_snapshot: ['Perbandingan sektor', 'Sector comparison'],
	mining_deep_dive: ['Analisis tambang', 'Mining analysis']
};

const LABEL_METRIK: Record<string, Pasangan> = {
	pe: ['PER, harga dibanding laba', 'P/E, price to earnings'],
	pb: ['PBV, harga dibanding nilai buku', 'P/B, price to book value'],
	ps: ['PSR, harga dibanding penjualan', 'P/S, price to sales'],
	revenue_growth: ['Pertumbuhan pendapatan', 'Revenue growth'],
	earnings_growth: ['Pertumbuhan laba', 'Earnings growth']
};

const SATUAN: Record<string, Pasangan> = {
	mt: ['juta ton', 'million tons'],
	koz: ['ribu ons', 'thousand ounces'],
	wmt: ['juta ton basah', 'million wet tons'],
	dmt: ['juta ton kering', 'million dry tons'],
	tni: ['ton nikel', 'tons of nickel'],
	t: ['ton', 'tons'],
	kg: ['kg', 'kg']
};

const TIPE_PERUSAHAAN: Record<string, Pasangan> = {
	mine_owner: ['Pemilik tambang', 'Mine owner'],
	trader: ['Pedagang komoditas', 'Commodity trader'],
	trading: ['Pedagang komoditas', 'Commodity trader'],
	holding: ['Perusahaan induk', 'Holding company'],
	contractor: ['Kontraktor tambang', 'Mining contractor'],
	consultant: ['Konsultan tambang', 'Mining consultant'],
	manufacturer: ['Produsen', 'Manufacturer']
};

const SUMBER: [RegExp, string, string][] = [
	[/^\/company\/report\//, 'Laporan perusahaan', 'Company report'],
	[/^\/suspensions\//, 'Riwayat suspensi IDX', 'IDX suspension history'],
	[/^\/filings\//, 'Laporan transaksi KSEI', 'KSEI transaction filings'],
	[/^\/subsector\/report\//, 'Laporan subsektor', 'Subsector report'],
	[
		/^\/mining\/companies\/performance\//,
		'Kinerja produksi tambang',
		'Mine production performance'
	],
	[/^\/mining\/companies\/[^/]+\/$/, 'Profil dan izin tambang', 'Mining profile and licenses'],
	[/^\/mining\/companies\/$/, 'Daftar perusahaan tambang', 'Mining company list'],
	[/^\/mining\/commodities\//, 'Harga komoditas', 'Commodity prices'],
	[/^\/mining\/sites\//, 'Lokasi tambang', 'Mine locations']
];

const LABEL_KEPARAHAN: Record<string, Pasangan> = {
	1: ['Rutin', 'Routine'],
	2: ['Operasional', 'Operational'],
	3: ['Serius', 'Serious']
};

const LABEL_TRANSAKSI: Record<string, Pasangan> = {
	sell: ['melepas', 'sold'],
	buy: ['menambah', 'bought'],
	others: ['transaksi lain', 'other transaction']
};

const LABEL_KOMODITAS: Record<string, Pasangan> = {
	coal: ['Batu bara', 'Coal'],
	nickel: ['Nikel', 'Nickel'],
	gold: ['Emas', 'Gold'],
	silver: ['Perak', 'Silver'],
	copper: ['Tembaga', 'Copper'],
	bauxite: ['Bauksit', 'Bauxite'],
	aluminium: ['Aluminium', 'Aluminium'],
	'zinc and lead': ['Seng dan timbal', 'Zinc and lead']
};

const KATEGORI_INGGRIS: Record<string, string> = {
	rendah: 'Low',
	sedang: 'Moderate',
	tinggi: 'High',
	kritis: 'Critical',
	'sangat tinggi': 'Very high'
};

function baca(peta: Record<string, Pasangan>, kunci: string | number): string | undefined {
	const pasangan = peta[kunci];
	return pasangan && t(...pasangan);
}

export function labelKeparahan(tier: number): string {
	return baca(LABEL_KEPARAHAN, tier) ?? t('Operasional', 'Operational');
}

export function labelTransaksi(jenis: string): string {
	return baca(LABEL_TRANSAKSI, jenis) ?? jenis;
}

export function labelKomoditas(nama: string): string {
	return baca(LABEL_KOMODITAS, nama.toLowerCase()) ?? nama;
}

export function labelKategori(kategori: string): string {
	return t(kategori, KATEGORI_INGGRIS[kategori.toLowerCase()] ?? kategori);
}

export function labelMetrik(kunci: string, cadangan: string): string {
	return baca(LABEL_METRIK, kunci) ?? cadangan;
}

export function satuanAwam(satuan: string | undefined): string {
	if (!satuan) return '';
	return baca(SATUAN, satuan.toLowerCase()) ?? satuan;
}

export function labelTipePerusahaan(tipe: string): string {
	const kunci = tipe.trim().toLowerCase().split(/\s+/).join('_');
	return baca(TIPE_PERUSAHAAN, kunci) ?? tipe;
}

export function labelSumber(daftar: string[]): string[] {
	const hasil: string[] = [];
	for (const endpoint of daftar) {
		const cocok = SUMBER.find(([pola]) => pola.test(endpoint));
		const label = cocok ? t(cocok[1], cocok[2]) : t('Data Sectors', 'Sectors data');
		if (!hasil.includes(label)) hasil.push(label);
	}
	return hasil;
}

export function formatPoin(nilai: number | null | undefined): string {
	if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '-';
	if (nilai === 0) return t('tetap', 'unchanged');
	const angka = formatAngka(Math.abs(nilai), 2);
	return t(
		`${nilai > 0 ? 'naik' : 'turun'} ${angka} poin`,
		`${nilai > 0 ? 'up' : 'down'} ${angka} ${angka === '1' ? 'point' : 'points'}`
	);
}

export function formatAngka(nilai: number | null | undefined, digit = 2): string {
	if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '-';
	return new Intl.NumberFormat(lokal(), { maximumFractionDigits: digit }).format(nilai);
}

export function formatRingkas(nilai: number): string {
	return new Intl.NumberFormat(lokal(), { notation: 'compact', maximumFractionDigits: 1 }).format(
		nilai
	);
}

export function formatBertanda(nilai: number | null | undefined, akhiran = '%'): string {
	if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '-';
	const tanda = nilai > 0 ? '+' : '';
	return `${tanda}${formatAngka(nilai, 2)}${akhiran}`;
}

export function selisihHari(tujuan: string, dari: string | Date = new Date()): number {
	const awal = typeof dari === 'string' ? new Date(dari) : dari;
	return Math.round((new Date(tujuan).getTime() - awal.getTime()) / 86_400_000);
}

export function labelSinyal(kunci: string): string {
	return baca(LABEL_SINYAL, kunci) ?? kunci.replace(/_/g, ' ');
}

export function labelSubtype(subtype: string): string {
	return baca(LABEL_SUBTYPE, subtype) ?? subtype.replace(/_/g, ' ');
}

export function judulInsight(insight: Insight): string {
	const pola = insight.payload?.cross_pattern;

	if (pola?.multiplier_applied && pola.multiplier_applied > 1 && pola.active_signals?.length) {
		const sinyal = pola.active_signals.map((kunci) => labelSinyal(kunci).toLowerCase());
		const daftar =
			sinyal.length > 1
				? `${sinyal.slice(0, -1).join(', ')} ${t('dan', 'and')} ${sinyal.at(-1)}`
				: sinyal[0];
		const hari = pola.window_days ?? 30;
		return t(
			`Tanda bahaya muncul berdekatan: ${daftar} dalam ${hari} hari`,
			`Red flags appeared close together: ${daftar} within ${hari} ${hari === 1 ? 'day' : 'days'}`
		);
	}

	if (insight.insight_type === 'red_flag') {
		const kategori = insight.payload?.category ?? '';
		return t(
			`Risiko tata kelola ${kategori.toLowerCase()}`.trim(),
			kategori ? `${labelKategori(kategori)} governance risk` : 'Governance risk'
		);
	}

	if (insight.subtype === 'mining_deep_dive') {
		return t(
			'Pengaruh harga komoditas dan izin tambang',
			'Impact of commodity prices and mining licenses'
		);
	}

	return t('Kinerja dibanding rata rata sektor', 'Performance versus the sector average');
}

export function waktuRelatif(iso: string): string {
	const selisih = Date.now() - new Date(iso).getTime();
	const menit = Math.round(selisih / 60000);

	if (menit < 1) return t('baru saja', 'just now');
	if (menit < 60) return t(`${menit} mnt lalu`, `${menit} min ago`);

	const jam = Math.round(menit / 60);
	if (jam < 24) return t(`${jam} jam lalu`, `${jam} ${jam === 1 ? 'hour' : 'hours'} ago`);

	const hari = Math.round(jam / 24);
	return t(`${hari} hari lalu`, `${hari} ${hari === 1 ? 'day' : 'days'} ago`);
}

export function formatTanggal(iso: string): string {
	return new Date(iso).toLocaleString(lokal(), {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Jakarta'
	});
}

export function formatTanggalSaja(iso: string): string {
	return new Date(iso).toLocaleDateString(lokal(), {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Jakarta'
	});
}
