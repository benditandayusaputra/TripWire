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

const LABEL_SINYAL: Record<string, string> = {
	suspension: 'Suspensi saham',
	insider_clustering: 'Transaksi orang dalam',
	ownership_change: 'Perubahan pemegang saham'
};

const LABEL_SUBTYPE: Record<string, string> = {
	governance_risk_composite: 'Risiko tata kelola',
	sector_relative_snapshot: 'Perbandingan sektor',
	mining_deep_dive: 'Analisis tambang'
};

const LABEL_METRIK: Record<string, string> = {
	pe: 'PER, harga dibanding laba',
	pb: 'PBV, harga dibanding nilai buku',
	ps: 'PSR, harga dibanding penjualan',
	revenue_growth: 'Pertumbuhan pendapatan',
	earnings_growth: 'Pertumbuhan laba'
};

const SATUAN: Record<string, string> = {
	mt: 'juta ton',
	koz: 'ribu ons',
	wmt: 'juta ton basah',
	dmt: 'juta ton kering',
	tni: 'ton nikel',
	t: 'ton',
	kg: 'kg'
};

const TIPE_PERUSAHAAN: Record<string, string> = {
	mine_owner: 'Pemilik tambang',
	trader: 'Pedagang komoditas',
	trading: 'Pedagang komoditas',
	holding: 'Perusahaan induk',
	contractor: 'Kontraktor tambang',
	consultant: 'Konsultan tambang',
	manufacturer: 'Produsen'
};

const SUMBER: [RegExp, string][] = [
	[/^\/company\/report\//, 'Laporan perusahaan'],
	[/^\/suspensions\//, 'Riwayat suspensi IDX'],
	[/^\/filings\//, 'Laporan transaksi KSEI'],
	[/^\/subsector\/report\//, 'Laporan subsektor'],
	[/^\/mining\/companies\/performance\//, 'Kinerja produksi tambang'],
	[/^\/mining\/companies\/[^/]+\/$/, 'Profil dan izin tambang'],
	[/^\/mining\/companies\/$/, 'Daftar perusahaan tambang'],
	[/^\/mining\/commodities\//, 'Harga komoditas'],
	[/^\/mining\/sites\//, 'Lokasi tambang']
];

const LABEL_KEPARAHAN: Record<number, string> = {
	1: 'Rutin',
	2: 'Operasional',
	3: 'Serius'
};

const LABEL_TRANSAKSI: Record<string, string> = {
	sell: 'melepas',
	buy: 'menambah',
	others: 'transaksi lain'
};

const LABEL_KOMODITAS: Record<string, string> = {
	coal: 'Batu bara',
	nickel: 'Nikel',
	gold: 'Emas',
	silver: 'Perak',
	copper: 'Tembaga',
	bauxite: 'Bauksit',
	aluminium: 'Aluminium',
	'zinc and lead': 'Seng dan timbal'
};

export function labelKeparahan(tier: number): string {
	return LABEL_KEPARAHAN[tier] ?? 'Operasional';
}

export function labelTransaksi(jenis: string): string {
	return LABEL_TRANSAKSI[jenis] ?? jenis;
}

export function labelKomoditas(nama: string): string {
	return LABEL_KOMODITAS[nama.toLowerCase()] ?? nama;
}

export function labelMetrik(kunci: string, cadangan: string): string {
	return LABEL_METRIK[kunci] ?? cadangan;
}

export function satuanAwam(satuan: string | undefined): string {
	if (!satuan) return '';
	return SATUAN[satuan.toLowerCase()] ?? satuan;
}

export function labelTipePerusahaan(tipe: string): string {
	const kunci = tipe.trim().toLowerCase().split(/\s+/).join('_');
	return TIPE_PERUSAHAAN[kunci] ?? tipe;
}

export function labelSumber(daftar: string[]): string[] {
	const hasil: string[] = [];
	for (const endpoint of daftar) {
		const label = SUMBER.find(([pola]) => pola.test(endpoint))?.[1] ?? 'Data Sectors';
		if (!hasil.includes(label)) hasil.push(label);
	}
	return hasil;
}

export function formatPoin(nilai: number | null | undefined): string {
	if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '-';
	if (nilai === 0) return 'tetap';
	return `${nilai > 0 ? 'naik' : 'turun'} ${formatAngka(Math.abs(nilai), 2)} poin`;
}

export function formatAngka(nilai: number | null | undefined, digit = 2): string {
	if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '-';
	return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digit }).format(nilai);
}

export function formatRingkas(nilai: number): string {
	return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(
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
	return LABEL_SINYAL[kunci] ?? kunci.replace(/_/g, ' ');
}

export function labelSubtype(subtype: string): string {
	return LABEL_SUBTYPE[subtype] ?? subtype.replace(/_/g, ' ');
}

export function judulInsight(insight: Insight): string {
	const pola = insight.payload?.cross_pattern;

	if (pola?.multiplier_applied && pola.multiplier_applied > 1 && pola.active_signals?.length) {
		const sinyal = pola.active_signals.map((kunci) => labelSinyal(kunci).toLowerCase());
		const daftar =
			sinyal.length > 1 ? `${sinyal.slice(0, -1).join(', ')} dan ${sinyal.at(-1)}` : sinyal[0];
		return `Tanda bahaya muncul berdekatan: ${daftar} dalam ${pola.window_days ?? 30} hari`;
	}

	if (insight.insight_type === 'red_flag') {
		return `Risiko tata kelola ${(insight.payload?.category ?? '').toLowerCase()}`.trim();
	}

	if (insight.subtype === 'mining_deep_dive') {
		return 'Pengaruh harga komoditas dan izin tambang';
	}

	return 'Kinerja dibanding rata rata sektor';
}

export function waktuRelatif(iso: string): string {
	const selisih = Date.now() - new Date(iso).getTime();
	const menit = Math.round(selisih / 60000);

	if (menit < 1) return 'baru saja';
	if (menit < 60) return `${menit} mnt lalu`;

	const jam = Math.round(menit / 60);
	if (jam < 24) return `${jam} jam lalu`;

	const hari = Math.round(jam / 24);
	return `${hari} hari lalu`;
}

export function formatTanggal(iso: string): string {
	return new Date(iso).toLocaleString('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Jakarta'
	});
}

export function formatTanggalSaja(iso: string): string {
	return new Date(iso).toLocaleDateString('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Jakarta'
	});
}
