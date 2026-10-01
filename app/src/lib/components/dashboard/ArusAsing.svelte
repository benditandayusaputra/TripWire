<script lang="ts">
	import { Globe } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import Panel from './Panel.svelte';
	import { tanggalBursa } from '$lib/dashboard';
	import type { RingkasanAsing } from '$lib/pasar';
	import { formatRupiah } from '$lib/watchlist';

	let {
		asing,
		memuat,
		dipantau,
		class: kelas = ''
	}: {
		asing: RingkasanAsing | null;
		memuat: boolean;
		dipantau: string[];
		class?: string;
	} = $props();

	let tab = $state<'beli' | 'jual'>('beli');

	const daftar = $derived((tab === 'beli' ? asing?.top_buy : asing?.top_sell)?.slice(0, 8) ?? []);
	const puncak = $derived(Math.max(1, ...daftar.map((satu) => Math.abs(satu.net_foreign_inflow))));
	const totalBeli = $derived(
		asing?.top_buy.reduce((total, satu) => total + satu.net_foreign_inflow, 0) ?? 0
	);
	const totalJual = $derived(
		asing?.top_sell.reduce((total, satu) => total + satu.net_foreign_inflow, 0) ?? 0
	);
</script>

<Panel
	judul={t('Arus dana asing', 'Foreign flow')}
	keterangan={asing?.date
		? t(
				`Net beli dan jual investor asing, ${tanggalBursa(asing.date, true)}`,
				`Foreign net buy and sell, ${tanggalBursa(asing.date, true)}`
			)
		: t('Net beli dan jual investor asing', 'Foreign investor net buy and sell')}
	ikon={Globe}
	testid="panel-asing"
	class={kelas}
>
	{#snippet aksi()}
		<div class="pilihan" role="tablist" aria-label={t('Arah arus asing', 'Flow direction')}>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'beli'}
				data-testid="tab-asing-beli"
				onclick={() => (tab = 'beli')}>{t('Net beli', 'Net buy')}</button
			>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'jual'}
				data-testid="tab-asing-jual"
				onclick={() => (tab = 'jual')}>{t('Net jual', 'Net sell')}</button
			>
		</div>
	{/snippet}

	{#if asing}
		<p class="ringkas">
			<span class="text-naik">▲ {formatRupiah(totalBeli)}</span>
			<span class="text-muted">{t('masuk ke 10 saham teratas', 'into the top 10')}</span>
			<span class="text-turun">▼ {formatRupiah(Math.abs(totalJual))}</span>
			<span class="text-muted">{t('keluar dari 10 saham teratas', 'out of the top 10')}</span>
		</p>
		{#if daftar.length}
			<div role="tabpanel">
				<ol class="mt-3">
					{#each daftar as satu (satu.ticker)}
						<li data-testid="asing-item" data-ticker={satu.ticker}>
							<a
								href="/stocks/{satu.ticker}"
								class="baris"
								title={t(
									`Beli ${formatRupiah(satu.foreign_buy_idr)}, jual ${formatRupiah(satu.foreign_sell_idr)}`,
									`Bought ${formatRupiah(satu.foreign_buy_idr)}, sold ${formatRupiah(satu.foreign_sell_idr)}`
								)}
							>
								<LogoEmiten kode={satu.ticker} ukuran={28} />
								<span class="min-w-0">
									<span class="flex items-center gap-1.5">
										<span class="tw-data text-ink text-[13px] font-semibold tracking-wide"
											>{satu.ticker}</span
										>
										{#if dipantau.includes(satu.ticker)}
											<span class="tanda">{t('watchlist', 'watchlist')}</span>
										{/if}
									</span>
									<span class="lajur">
										<span
											class={tab === 'beli' ? 'bg-naik' : 'bg-turun'}
											style="width:{(Math.abs(satu.net_foreign_inflow) / puncak) * 100}%"
										></span>
									</span>
								</span>
								<span class="tw-data text-[12.5px] {tab === 'beli' ? 'text-naik' : 'text-turun'}">
									{tab === 'beli' ? '▲' : '▼'}
									{formatRupiah(Math.abs(satu.net_foreign_inflow))}
								</span>
							</a>
						</li>
					{/each}
				</ol>
			</div>
		{:else}
			<p class="text-muted mt-3 text-[13px]">
				{t('Tidak ada data untuk arah ini.', 'No data for this direction.')}
			</p>
		{/if}
	{:else if memuat}
		<ul class="space-y-3" aria-hidden="true">
			{#each [0, 1, 2, 3, 4] as urutan (urutan)}
				<li class="kerangka"></li>
			{/each}
		</ul>
	{:else}
		<p class="text-muted text-[13px]">
			{t(
				'Data arus asing belum bisa dimuat dari Sectors.',
				'Foreign flow data could not be loaded from Sectors.'
			)}
		</p>
	{/if}
</Panel>

<style>
	.pilihan {
		display: inline-flex;
		gap: 2px;
		border: 1px solid var(--edge);
		border-radius: 11px;
		background: var(--color-void);
		padding: 3px;
	}

	.pilihan button {
		border-radius: 8px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-secondary);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.pilihan button[aria-selected='true'] {
		background: color-mix(in srgb, var(--color-diamond-500) 16%, transparent);
		color: var(--color-diamond-100);
	}

	.ringkas {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 2px 8px;
		font-size: 12px;
	}

	.ringkas span:nth-child(odd) {
		font-family: var(--font-mono);
	}

	.baris {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		border-top: 1px solid var(--edge-soft);
		padding: 8px 0;
	}

	@media (hover: hover) {
		.baris:hover .tw-data.text-ink {
			color: var(--color-diamond-300);
		}
	}

	.lajur {
		display: block;
		height: 4px;
		margin-top: 5px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.lajur span {
		display: block;
		height: 100%;
		border-radius: 999px;
		opacity: 0.8;
	}

	.tanda {
		border: 1px solid var(--color-diamond-700);
		border-radius: 999px;
		padding: 0 6px;
		font-size: 9.5px;
		line-height: 15px;
		color: var(--color-diamond-300);
	}

	.kerangka {
		height: 30px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
		animation: denyut 1.4s ease-in-out infinite;
	}

	@keyframes denyut {
		50% {
			opacity: 0.45;
		}
	}
</style>
