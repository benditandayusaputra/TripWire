<script lang="ts">
	import { Factory } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import GrafikHarga from '$lib/components/Chart/GrafikHarga.svelte';
	import Panel from './Panel.svelte';
	import { formatPersen, kelasArah, type Komoditas } from '$lib/dashboard';
	import { formatAngka, labelKomoditas, satuanAwam } from '$lib/insight';

	let { komoditas }: { komoditas: Komoditas[] } = $props();
</script>

<Panel
	judul={t('Harga komoditas', 'Commodity prices')}
	keterangan={t(
		'Komoditas yang memengaruhi saham tambangmu',
		'Commodities that move your mining stocks'
	)}
	ikon={Factory}
	testid="panel-komoditas"
>
	<ul class="space-y-5">
		{#each komoditas as item (item.commodity)}
			{@const tahunan = formatPersen(item.yoy_pct === null ? null : item.yoy_pct / 100, 1)}
			<li>
				<div class="flex items-baseline justify-between gap-3">
					<span class="text-ink text-[14px] font-medium">{labelKomoditas(item.commodity)}</span>
					<span class="tw-data text-muted text-[11px]">{item.tickers.join(', ')}</span>
				</div>
				<p class="mt-1 flex flex-wrap items-baseline gap-x-2">
					<span class="tw-data text-ink text-[17px]">{formatAngka(item.latest)}</span>
					<span class="text-muted text-[11.5px]">{satuanAwam(item.unit)}</span>
					{#if item.yoy_pct !== null}
						<span class="tw-data text-[12px] {kelasArah(tahunan.arah)}"
							>{tahunan.teks} {t('setahun', 'year on year')}</span
						>
					{/if}
				</p>
				<div class="mt-2">
					<GrafikHarga seri={item.series} />
				</div>
			</li>
		{/each}
	</ul>
</Panel>
