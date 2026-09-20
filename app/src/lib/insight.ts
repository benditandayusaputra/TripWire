export type SubScores = Record<string, number>;

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
	supporting_data?: Record<string, unknown>;
	mode?: string;
	sector_snapshot?: Record<string, unknown>;
	commodity_exposure?: Record<string, unknown>;
	license_radar?: Record<string, unknown>;
	mine_sites?: unknown[];
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
	suspension: 'Suspensi',
	insider_clustering: 'Klaster insider',
	ownership_change: 'Perubahan kepemilikan'
};

const LABEL_SUBTYPE: Record<string, string> = {
	governance_risk_composite: 'Risiko tata kelola',
	sector_relative_snapshot: 'Snapshot sektor',
	mining_deep_dive: 'Mode mendalam tambang'
};

export function labelSinyal(kunci: string): string {
	return LABEL_SINYAL[kunci] ?? kunci.replace(/_/g, ' ');
}

export function labelSubtype(subtype: string): string {
	return LABEL_SUBTYPE[subtype] ?? subtype.replace(/_/g, ' ');
}

export function judulInsight(insight: Insight): string {
	const pola = insight.payload?.cross_pattern;

	if (pola?.multiplier_applied && pola.multiplier_applied > 1 && pola.active_signals?.length) {
		const sinyal = pola.active_signals.map(labelSinyal).join(', ');
		return `Pola silang terdeteksi: ${sinyal} dalam ${pola.window_days ?? 30} hari`;
	}

	if (insight.insight_type === 'red_flag') {
		return `Skor risiko tata kelola ${insight.payload?.category ?? ''}`.trim();
	}

	if (insight.subtype === 'mining_deep_dive') {
		return 'Eksposur komoditas dan radar lisensi tambang';
	}

	return 'Snapshot fundamental terhadap rata rata sektor';
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
