<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte';
</script>

<div
	data-testid="disclaimer-bar"
	class="rounded-glass border-tier-moderate/32 from-tier-moderate/13 to-tier-moderate/5 flex items-start gap-3 border bg-linear-to-b px-4 py-3.5"
>
	<TriangleAlert class="text-tier-moderate mt-0.5 size-4 flex-none" aria-hidden="true" />
	<p class="text-secondary text-[13.5px] leading-relaxed">
		<span class="text-ink font-medium"
			>Informasi dan analisis, bukan rekomendasi beli atau jual.</span
		>
		TripWire tidak berlisensi sebagai penasihat investasi. Semua keputusan transaksi ada di tangan kamu.
	</p>
</div>
