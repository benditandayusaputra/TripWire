<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
</script>

<div
	data-testid="disclaimer-bar"
	class="rounded-glass border-tier-moderate/32 from-tier-moderate/13 to-tier-moderate/5 flex items-start gap-3 border bg-linear-to-b px-4 py-3.5"
>
	<TriangleAlert class="text-tier-moderate mt-0.5 size-4 flex-none" aria-hidden="true" />
	<p class="text-secondary text-[13.5px] leading-relaxed">
		<span class="text-ink font-medium"
			>{t(
				'Informasi dan analisis, bukan rekomendasi beli atau jual.',
				'Information and analysis, not a recommendation to buy or sell.'
			)}</span
		>
		{t(
			'TripWire tidak berlisensi sebagai penasihat investasi. Semua keputusan transaksi ada di tangan kamu.',
			'TripWire is not a licensed investment adviser. Every trading decision is yours to make.'
		)}
	</p>
</div>
