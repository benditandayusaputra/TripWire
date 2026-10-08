<script lang="ts">
	import { ArrowUpRight, ChartNoAxesCombined, TrendingDown, TrendingUp } from 'lucide-svelte';
	import {
		formatAngka,
		formatBertanda,
		formatPoin,
		labelKategori,
		labelKomoditas,
		labelMetrik,
		labelSubtype,
		waktuRelatif,
		type Insight
	} from '$lib/insight';
	import { t } from '$lib/bahasa.svelte';

	let { pasar }: { pasar: Insight } = $props();

	const payload = $derived(pasar.payload ?? {});
	const metrik = $derived(payload.sector_snapshot?.metrics ?? []);
	const eksposur = $derived(payload.commodity_exposure);
	const radar = $derived(payload.license_radar);

	function nilai(angka: number, unit: string) {
		return unit === '%' ? `${formatAngka(angka)}%` : `${formatAngka(angka)}x`;
	}
</script>

<section class="panel" aria-labelledby="judul-pasar" data-testid="pasar-saham">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 id="judul-pasar" class="tw-overline flex items-center gap-2">
			<ChartNoAxesCombined class="size-3.5" aria-hidden="true" />
			{labelSubtype(pasar.subtype)}
		</h2>
		<span class="text-muted text-[12px]">{waktuRelatif(pasar.generated_at)}</span>
	</div>

	{#if eksposur}
		<div class="mb-4 flex items-end gap-3">
			<span class="tw-data text-ink text-[30px] leading-none font-semibold"
				>{Math.round(eksposur.score)}</span
			>
			<span class="pb-0.5">
				<span class="text-ink block text-[13px] font-medium">
					{t('Ketergantungan pada harga komoditas', 'Commodity exposure')}
					{labelKategori(eksposur.category).toLowerCase()}
				</span>
				<span class="text-muted block text-[12px]">{labelKomoditas(eksposur.commodity)}</span>
			</span>
		</div>
		{#if radar}
			<p class="text-secondary mb-4 text-[12.5px]">
				{radar.expiring_soon.length
					? t(
							`${radar.expiring_soon.length} dari ${radar.total_licenses} izin tambang berakhir atau baru berakhir dalam setahun.`,
							`${radar.expiring_soon.length} of ${radar.total_licenses} mining licenses expire or recently expired within a year.`
						)
					: t(
							`Tidak ada dari ${radar.total_licenses} izin tambang yang berakhir dalam setahun.`,
							`None of the ${radar.total_licenses} mining licenses expire within a year.`
						)}
			</p>
		{/if}
	{/if}

	{#if metrik.length}
		<ul class="space-y-1.5">
			{#each metrik as baris (baris.key)}
				<li class="baris" data-testid="metrik-saham" data-kunci={baris.key}>
					<span class="min-w-0 flex-1">
						<span class="text-ink block truncate text-[13px]"
							>{labelMetrik(baris.key, baris.label)}</span
						>
						<span class="tw-data text-muted text-[11.5px]">
							{nilai(baris.value, baris.unit)} · {t('sektor', 'sector')}
							{nilai(baris.sector_average, baris.unit)}
						</span>
					</span>
					<span class="tw-data text-secondary inline-flex flex-none items-center gap-1 text-[12px]">
						{#if baris.position.startsWith('di atas')}
							<TrendingUp class="size-3.5" aria-hidden="true" />
						{:else if baris.position.startsWith('di bawah')}
							<TrendingDown class="size-3.5" aria-hidden="true" />
						{/if}
						{baris.unit === '%'
							? formatPoin(baris.difference)
							: formatBertanda(baris.difference_pct)}
					</span>
				</li>
			{/each}
		</ul>
		<p class="text-muted mt-3 text-[11.5px] leading-relaxed">
			{t(
				'Dibanding rata rata perusahaan sejenis di subsektor yang sama. Di atas atau di bawah rata rata bukan berarti baik atau buruk.',
				'Compared with similar companies in the same subsector. Above or below average is not good or bad in itself.'
			)}
		</p>
	{:else if !eksposur}
		<p class="text-secondary text-[13px]">
			{t(
				'Sectors belum punya data valuasi dan pertumbuhan yang bisa dibandingkan untuk saham ini.',
				'Sectors has no comparable valuation and growth data for this stock yet.'
			)}
		</p>
	{/if}

	<a href="/insights/{pasar.id}" class="tautan mt-4" data-testid="rincian-pasar">
		{t('Rincian analisis', 'Full analysis')}
		<ArrowUpRight class="size-3.5" aria-hidden="true" />
	</a>
</section>

<style>
	.panel {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 20px;
		}
	}

	.baris {
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 7px 2px;
	}

	.baris:last-child {
		border-bottom: 0;
	}

	.tautan {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-diamond-300);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan:hover {
			color: var(--color-diamond-100);
		}
	}
</style>
