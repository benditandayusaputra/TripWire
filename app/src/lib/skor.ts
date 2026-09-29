import { t } from '$lib/bahasa.svelte';

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
		get label() {
			return t('Rendah', 'Low');
		},
		get range() {
			return t('0 sampai 30', '0 to 30');
		},
		color: 'var(--color-tier-low)',
		text: 'text-tier-low',
		border: 'border-tier-low/35',
		background: 'bg-tier-low/12'
	},
	moderate: {
		tier: 'moderate',
		get label() {
			return t('Sedang', 'Moderate');
		},
		get range() {
			return t('31 sampai 60', '31 to 60');
		},
		color: 'var(--color-tier-moderate)',
		text: 'text-tier-moderate',
		border: 'border-tier-moderate/35',
		background: 'bg-tier-moderate/12'
	},
	high: {
		tier: 'high',
		get label() {
			return t('Tinggi', 'High');
		},
		get range() {
			return t('61 sampai 85', '61 to 85');
		},
		color: 'var(--color-tier-high)',
		text: 'text-tier-high',
		border: 'border-tier-high/35',
		background: 'bg-tier-high/12'
	},
	critical: {
		tier: 'critical',
		get label() {
			return t('Kritis', 'Critical');
		},
		get range() {
			return t('86 sampai 100', '86 to 100');
		},
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
