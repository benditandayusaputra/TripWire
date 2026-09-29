<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, LoaderCircle, Plus, TrendingUp } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import Panel from './Panel.svelte';
	import { formatPersen } from '$lib/dashboard';
	import type { RingkasanPasar } from '$lib/pasar';
	import { formatHarga, formatRupiah } from '$lib/watchlist';

	let {
		pasar,
		memuat,
		dipantau,
		penuh,
		class: kelas = ''
	}: {
		pasar: RingkasanPasar | null;
		memuat: boolean;
		dipantau: string[];
		penuh: boolean;
		class?: string;
	} = $props();

	type Tab = 'naik' | 'turun' | 'besar';

	let tab = $state<Tab>('naik');
	let mengirim = $state('');
	let galat = $state('');

	const TAB = $derived<{ kunci: Tab; label: string }[]>([
		{ kunci: 'naik', label: t('Naik', 'Gainers') },
		{ kunci: 'turun', label: t('Turun', 'Losers') },
		{ kunci: 'besar', label: t('Terbesar', 'Largest') }
	]);

	const daftar = $derived(
		(tab === 'naik'
			? pasar?.naikTertinggi
			: tab === 'turun'
				? pasar?.turunTerdalam
				: pasar?.terbesar) ?? []
	);
</script>

<Panel
	judul={t('Penggerak pasar', 'Market movers')}
	keterangan={t(
		'Saham berkapitalisasi di atas Rp1 T, perubahan harian terakhir',
		'Stocks above Rp1T market cap, latest daily change'
	)}
	ikon={TrendingUp}
	testid="panel-penggerak"
	class={kelas}
>
	{#snippet aksi()}
		<div class="pilihan" role="tablist" aria-label={t('Jenis penggerak', 'Mover type')}>
			{#each TAB as satu (satu.kunci)}
				<button
					type="button"
					role="tab"
					aria-selected={tab === satu.kunci}
					data-testid="tab-penggerak-{satu.kunci}"
					onclick={() => (tab = satu.kunci)}>{satu.label}</button
				>
			{/each}
		</div>
	{/snippet}

	{#if pasar}
		{#if daftar.length}
			<div role="tabpanel">
				<ol class="-my-1">
					{#each daftar as saham, urutan (saham.ticker)}
						{@const ubah = formatPersen(saham.daily_close_change)}
						{@const sudah = dipantau.includes(saham.ticker)}
						<li data-testid="penggerak-item" data-ticker={saham.ticker} class="baris">
							<span class="tw-data text-muted w-4 text-right text-[11px]">{urutan + 1}</span>
							<LogoEmiten kode={saham.ticker} ukuran={30} />
							<span class="min-w-0">
								<span class="tw-data text-ink block text-[13px] font-semibold tracking-wide"
									>{saham.ticker}</span
								>
								<span class="text-muted block truncate text-[11.5px]">{saham.company_name}</span>
							</span>
							<span class="flex flex-col items-end">
								<span class="tw-data text-ink text-[13px]"
									>{formatHarga(saham.last_close_price)}</span
								>
								{#if tab === 'besar'}
									<span class="tw-data text-muted text-[11px]"
										>{formatRupiah(saham.market_cap)}</span
									>
								{:else}
									<span class="pil" data-arah={ubah.arah}>{ubah.teks}</span>
								{/if}
							</span>
							<form
								method="POST"
								action="/watchlist?/tambah"
								use:enhance={() => {
									mengirim = saham.ticker;
									galat = '';
									return async ({ result, update }) => {
										if (result.type === 'failure') {
											galat =
												(result.data as { error?: string } | undefined)?.error ??
												t('Saham gagal ditambahkan', 'Could not add the stock');
										} else {
											await update();
										}
										mengirim = '';
									};
								}}
							>
								<input type="hidden" name="ticker" value={saham.ticker} />
								<input type="hidden" name="pantau_harian" value="on" />
								<input type="hidden" name="tetap" value="1" />
								<button
									type="submit"
									class="pantau"
									disabled={penuh || sudah || mengirim !== ''}
									aria-label={sudah
										? t(`${saham.ticker} sudah dipantau`, `${saham.ticker} is already watched`)
										: t(`Pantau ${saham.ticker}`, `Watch ${saham.ticker}`)}
									title={sudah
										? t('Sudah di watchlist', 'Already in watchlist')
										: t('Pantau', 'Watch')}
								>
									{#if mengirim === saham.ticker}
										<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
									{:else if sudah}
										<Check class="size-3.5" aria-hidden="true" />
									{:else}
										<Plus class="size-3.5" aria-hidden="true" />
									{/if}
								</button>
							</form>
						</li>
					{/each}
				</ol>
			</div>
		{:else}
			<p class="text-muted text-[13px]">
				{tab === 'naik'
					? t(
							'Tidak ada saham besar yang naik pada penutupan terakhir.',
							'No large-cap stock rose at the last close.'
						)
					: t(
							'Tidak ada saham besar yang turun pada penutupan terakhir.',
							'No large-cap stock fell at the last close.'
						)}
			</p>
		{/if}
		{#if galat}
			<p role="alert" class="text-tier-critical mt-3 text-[12.5px]">{galat}</p>
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
				'Daftar penggerak pasar belum bisa dimuat dari Sectors.',
				'Market movers could not be loaded from Sectors.'
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

	.baris {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 8px 0;
	}

	.baris:last-child {
		border-bottom: 0;
	}

	.pil {
		margin-top: 2px;
		border-radius: 6px;
		padding: 0 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.6;
		white-space: nowrap;
		color: var(--color-secondary);
	}

	.pil[data-arah='1'] {
		background: color-mix(in srgb, var(--color-naik) 15%, transparent);
		color: var(--color-naik);
	}

	.pil[data-arah='-1'] {
		background: color-mix(in srgb, var(--color-turun) 15%, transparent);
		color: var(--color-turun);
	}

	.pantau {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 9px;
		background: color-mix(in srgb, var(--color-diamond-500) 8%, transparent);
		color: var(--color-diamond-100);
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.pantau:disabled {
		border-color: var(--edge);
		background: transparent;
		color: var(--color-muted);
		opacity: 1;
	}

	@media (hover: hover) {
		.pantau:not(:disabled):hover {
			border-color: var(--color-diamond-500);
			background: color-mix(in srgb, var(--color-diamond-500) 18%, transparent);
		}
	}

	.kerangka {
		height: 34px;
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
