export type Tier = 'low' | 'moderate' | 'high' | 'critical';

type TierInfo = {
	tier: Tier;
	label: string;
	range: string;
	color: string;
	text: string;
	border: string;
	background: string;
};

const TIER: Record<Tier, TierInfo> = {
	low: {
		tier: 'low',
		label: 'Rendah',
		range: '0 sampai 30',
		color: 'var(--color-tier-low)',
		text: 'text-tier-low',
		border: 'border-tier-low/35',
		background: 'bg-tier-low/12'
	},
	moderate: {
		tier: 'moderate',
		label: 'Sedang',
		range: '31 sampai 60',
		color: 'var(--color-tier-moderate)',
		text: 'text-tier-moderate',
		border: 'border-tier-moderate/35',
		background: 'bg-tier-moderate/12'
	},
	high: {
		tier: 'high',
		label: 'Tinggi',
		range: '61 sampai 85',
		color: 'var(--color-tier-high)',
		text: 'text-tier-high',
		border: 'border-tier-high/35',
		background: 'bg-tier-high/12'
	},
	critical: {
		tier: 'critical',
		label: 'Kritis',
		range: '86 sampai 100',
		color: 'var(--color-tier-critical)',
		text: 'text-tier-critical',
		border: 'border-tier-critical/35',
		background: 'bg-tier-critical/12'
	}
};

export function tierDariSkor(skor: number | null | undefined): TierInfo {
	if (skor === null || skor === undefined) return TIER.low;
	if (skor >= 86) return TIER.critical;
	if (skor >= 61) return TIER.high;
	if (skor >= 31) return TIER.moderate;
	return TIER.low;
}

export function bulatkanSkor(skor: number | null | undefined): string {
	if (skor === null || skor === undefined) return '0';
	return String(Math.round(skor));
}
