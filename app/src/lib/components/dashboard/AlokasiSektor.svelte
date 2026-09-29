<script lang="ts">
	import { ChartPie } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import { NAMA_SEKTOR } from '$lib/watchlist';

	let { alokasi, total }: { alokasi: { nama: string; tickers: string[] }[]; total: number } =
		$props();

	const namaSektor = (nama: string) =>
		nama ? t(NAMA_SEKTOR[nama] ?? nama, nama) : t('Belum diketahui', 'Unknown');
</script>

<Panel
	judul={t('Sebaran sektor watchlist', 'Watchlist by sector')}
	keterangan={t('Komposisi saham yang kamu pantau', 'Composition of the stocks you watch')}
	ikon={ChartPie}
	testid="panel-alokasi"
>
	<ul class="space-y-3">
		{#each alokasi as item (item.nama)}
			<li>
				<div class="flex items-baseline justify-between gap-3 text-[13px]">
					<span class="text-secondary truncate">{namaSektor(item.nama)}</span>
					<span class="tw-data text-ink"
						>{Math.round((item.tickers.length / Math.max(1, total)) * 100)}%</span
					>
				</div>
				<div class="mt-1.5 flex items-center gap-2.5">
					<span class="lajur">
						<span class="isi" style="width:{(item.tickers.length / Math.max(1, total)) * 100}%"
						></span>
					</span>
					<span class="tw-data text-muted w-24 flex-none truncate text-[11px]"
						>{item.tickers.join(', ')}</span
					>
				</div>
			</li>
		{/each}
	</ul>
</Panel>

<style>
	.lajur {
		position: relative;
		height: 6px;
		flex: 1;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		background: var(--color-secondary);
	}
</style>
