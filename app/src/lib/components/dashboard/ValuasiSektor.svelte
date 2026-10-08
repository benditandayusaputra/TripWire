<script lang="ts">
	import { Scale } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import type { BarisValuasi } from '$lib/dashboard';
	import { formatAngka } from '$lib/insight';

	let { valuasi }: { valuasi: BarisValuasi[] } = $props();
</script>

<Panel
	judul={t('Valuasi dibanding sektor', 'Valuation versus sector')}
	keterangan={t('Selisih terhadap rata rata subsektor', 'Difference from the sub-sector average')}
	ikon={Scale}
	testid="panel-valuasi"
>
	<table class="w-full text-left">
		<thead>
			<tr class="tw-overline">
				<th class="pb-2 font-medium">{t('Saham', 'Stock')}</th>
				<th
					class="pb-2 text-right font-medium"
					title={t('Harga dibanding laba', 'Price to earnings')}>PER</th
				>
				<th
					class="pb-2 text-right font-medium"
					title={t('Harga dibanding nilai buku', 'Price to book value')}>PBV</th
				>
				<th
					class="pb-2 text-right font-medium"
					title={t('Harga dibanding penjualan', 'Price to sales')}>PSR</th
				>
			</tr>
		</thead>
		<tbody>
			{#each valuasi as item (item.ticker)}
				<tr class="border-line/60 border-t">
					<td class="py-2.5">
						<span class="tw-data text-ink block text-[12.5px] font-semibold">{item.ticker}</span>
						<span class="text-muted block max-w-32 truncate text-[11px]">{item.subSektor}</span>
					</td>
					{#each ['pe', 'pb', 'ps'] as kunci (kunci)}
						{@const metrik = item.metrik[kunci]}
						<td class="py-2.5 text-right">
							{#if metrik}
								<span class="tw-data text-ink block text-[12.5px]"
									>{formatAngka(metrik.value, 1)}x</span
								>
								<span class="tw-data text-muted block text-[11px]">
									{metrik.difference_pct === null
										? t(
												`sektor ${formatAngka(metrik.sector_average, 1)}x`,
												`sector ${formatAngka(metrik.sector_average, 1)}x`
											)
										: `${metrik.difference_pct > 0 ? '▲' : '▼'} ${formatAngka(Math.abs(metrik.difference_pct), 0)}%`}
								</span>
							{:else}
								<span class="text-muted text-[12px]">-</span>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
	<p class="text-muted mt-3 text-[11.5px] leading-snug">
		{t(
			'Di atas atau di bawah rata rata bukan penilaian baik buruk, hanya konteks.',
			'Above or below average is not a verdict, only context.'
		)}
	</p>
</Panel>
