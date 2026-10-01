<script lang="ts">
	import CincinSkor from './CincinSkor.svelte';
	import LogoEmiten from './LogoEmiten.svelte';
	import Sparkline from './Sparkline.svelte';
	import { formatHarga, formatUbah, type Penutupan } from '$lib/watchlist';
	import { t } from '$lib/bahasa.svelte';

	let {
		kode,
		nama,
		tren,
		penutupan,
		skor,
		selisih = 0,
		catatan = '',
		href,
		aktif = false,
		memuat = false,
		tur = false
	}: {
		kode: string;
		nama: string;
		tren: number[] | null;
		penutupan: Penutupan | null;
		skor: number | null;
		selisih?: number;
		catatan?: string;
		href?: string;
		aktif?: boolean;
		memuat?: boolean;
		tur?: boolean;
	} = $props();

	const ubah = $derived(formatUbah(penutupan?.ubah));
	const arahBulan = $derived(
		tren && tren.length > 1 ? formatUbah(tren[tren.length - 1] / tren[0] - 1) : null
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	data-sveltekit-noscroll={href ? '' : undefined}
	aria-current={aktif ? 'true' : undefined}
	class="baris"
	data-tur={tur ? 'baris' : undefined}
>
	<LogoEmiten {kode} />

	<span class="min-w-0">
		<span class="flex min-w-0 items-center gap-1.5">
			<span class="kode">{kode}</span>
			{#if catatan}
				<span class="catatan">{catatan}</span>
			{/if}
		</span>
		<span class="nama">{nama}</span>
	</span>

	<span class="kolom-tren">
		{#if tren && tren.length > 1 && arahBulan}
			<Sparkline
				nilai={tren}
				label="{t(
					`Harga ${kode} sebulan terakhir`,
					`${kode} price over the past month`
				)} {arahBulan.arah > 0
					? t('naik', 'up')
					: arahBulan.arah < 0
						? t('turun', 'down')
						: t('tetap', 'unchanged')} {arahBulan.teks.slice(2)}"
			/>
		{:else if memuat}
			<span class="kerangka h-5 w-full" aria-hidden="true"></span>
		{/if}
	</span>

	<span class="kolom-harga">
		{#if penutupan}
			<span class="harga">{formatHarga(penutupan.harga)}</span>
			<span class="pil" data-arah={ubah.arah}>{ubah.teks}</span>
		{:else if memuat}
			<span class="kerangka h-3.5 w-14" aria-hidden="true"></span>
			<span class="kerangka mt-1.5 h-3 w-11" aria-hidden="true"></span>
		{:else}
			<span class="text-muted text-[11.5px] leading-tight"
				>{t('Belum ada harga', 'No price yet')}</span
			>
		{/if}
	</span>

	<span class="kolom-risiko" data-tur={tur ? 'skor' : undefined}>
		<CincinSkor {skor} />
		{#if selisih !== 0}
			<span
				class="selisih"
				title={t(
					`Berubah ${selisih} dari pemindaian sebelumnya`,
					`Changed by ${selisih} since the previous scan`
				)}>{selisih > 0 ? '+' : ''}{selisih}</span
			>
		{/if}
	</span>
</svelte:element>

<style>
	.baris {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 48px 76px 36px;
		align-items: center;
		gap: 10px;
		border: 1px solid transparent;
		border-radius: 14px;
		padding: 9px 10px;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	@media (min-width: 640px) {
		.baris {
			grid-template-columns: auto minmax(0, 1fr) 84px 96px 38px;
			gap: 14px;
			padding: 10px 14px;
		}
	}

	@media (min-width: 1024px) {
		.baris {
			grid-template-columns: auto minmax(0, 1fr) 64px 86px 38px;
			gap: 12px;
		}
	}

	a.baris {
		cursor: pointer;
	}

	@media (hover: hover) {
		a.baris:hover {
			background: color-mix(in srgb, var(--cahaya) 3.5%, transparent);
		}
	}

	.baris[aria-current='true'] {
		border-color: color-mix(in srgb, var(--color-diamond-500) 40%, transparent);
		background: rgba(74, 158, 255, 0.08);
	}

	.baris[aria-current='true']::before {
		content: '';
		position: absolute;
		left: -1px;
		top: 14px;
		bottom: 14px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--color-diamond-500);
	}

	.kode {
		font-family: var(--font-mono);
		font-size: 14.5px;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--color-ink);
	}

	.catatan {
		flex: none;
		border: 1px dashed var(--edge-strong);
		border-radius: 999px;
		padding: 0 6px;
		font-size: 10px;
		line-height: 16px;
		color: var(--color-muted);
	}

	.nama {
		display: block;
		overflow: hidden;
		font-size: 12px;
		line-height: 1.45;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.kolom-tren {
		display: flex;
		align-items: center;
	}

	@media (max-width: 359.98px) {
		.baris {
			grid-template-columns: auto minmax(0, 1fr) 76px 36px;
		}

		.kolom-tren {
			display: none;
		}
	}

	.kolom-harga {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
	}

	.harga {
		font-family: var(--font-mono);
		font-size: 14.5px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1.3;
		color: var(--color-ink);
	}

	.pil {
		margin-top: 3px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
		padding: 1px 6px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		font-variant-numeric: tabular-nums;
		line-height: 1.5;
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

	.kolom-risiko {
		position: relative;
		justify-self: end;
	}

	.selisih {
		position: absolute;
		top: -5px;
		right: -7px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		background: var(--color-raised);
		padding: 0 4px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		line-height: 14px;
		color: var(--color-secondary);
	}

	.kerangka {
		display: block;
		border-radius: 6px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--kilau) 6%, transparent),
			color-mix(in srgb, var(--kilau) 14%, transparent),
			color-mix(in srgb, var(--kilau) 6%, transparent)
		);
		background-size: 200% 100%;
		animation: kilau 1.4s ease-in-out infinite;
	}

	@keyframes kilau {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
</style>
