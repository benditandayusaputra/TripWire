<script lang="ts">
	import { LoaderCircle } from 'lucide-svelte';
	import GrafikEmiten from '$lib/components/watchlist/GrafikEmiten.svelte';
	import { formatRingkas } from '$lib/insight';
	import { t } from '$lib/bahasa.svelte';
	import {
		formatHarga,
		formatUbah,
		type Harian,
		type HasilHarga,
		type Kutipan,
		type Peristiwa
	} from '$lib/watchlist';

	let {
		kode,
		harga,
		kutipan,
		riwayat,
		batas,
		peristiwa
	}: {
		kode: string;
		harga: Promise<HasilHarga>;
		kutipan: Kutipan | null;
		riwayat: { score: number; at: string }[];
		batas: number;
		peristiwa: Peristiwa[];
	} = $props();

	const posisi52 = $derived.by(() => {
		if (!kutipan?.high_52w || !kutipan.low_52w || kutipan.high_52w <= kutipan.low_52w) return null;
		const nilai =
			(kutipan.last_close_price - kutipan.low_52w) / (kutipan.high_52w - kutipan.low_52w);
		return Math.min(1, Math.max(0, nilai));
	});

	function kinerja(seri: Harian[], hari: number) {
		if (seri.length < 2) return null;
		const awal = seri[Math.max(0, seri.length - 1 - hari)].close;
		return formatUbah((seri[seri.length - 1].close - awal) / awal);
	}
</script>

<section
	class="panel h-full"
	aria-label={t(`Harga harian ${kode}`, `${kode} daily prices`)}
	data-testid="harga-saham"
>
	{#await harga}
		<div class="kerangka" aria-live="polite">
			<LoaderCircle class="text-diamond-300 size-5 animate-spin" aria-hidden="true" />
			<span class="text-secondary text-[13px]">
				{t(
					`Memuat harga harian ${kode} dari Sectors`,
					`Loading daily prices for ${kode} from Sectors`
				)}
			</span>
		</div>
	{:then hasil}
		{#if hasil.seri.length > 1}
			<GrafikEmiten {kode} seri={hasil.seri} {riwayat} {batas} {peristiwa} />
			<dl class="mt-4 grid grid-cols-3 gap-2.5">
				{#each [{ label: t('Kinerja 1 bulan', '1-month return'), nilai: kinerja(hasil.seri, 21) }, { label: t('Kinerja 3 bulan', '3-month return'), nilai: kinerja(hasil.seri, 999) }] as sel (sel.label)}
					<div class="sel">
						<dt class="text-muted text-[11.5px]">{sel.label}</dt>
						<dd
							class="tw-data mt-0.5 text-[14px] {sel.nilai && sel.nilai.arah > 0
								? 'text-naik'
								: sel.nilai && sel.nilai.arah < 0
									? 'text-turun'
									: 'text-ink'}"
						>
							{sel.nilai?.teks ?? '-'}
						</dd>
					</div>
				{/each}
				<div class="sel">
					<dt class="text-muted text-[11.5px]">Volume</dt>
					<dd class="tw-data text-ink mt-0.5 text-[14px]">
						{hasil.seri.at(-1)?.volume
							? `${formatRingkas(hasil.seri.at(-1)?.volume ?? 0)} ${t('lbr', 'shares')}`
							: '-'}
					</dd>
				</div>
			</dl>
		{:else}
			<p data-testid="harga-kosong" class="kerangka text-secondary text-[13px]">
				{hasil.galat ||
					t(`Belum ada data harga harian untuk ${kode}.`, `No daily price data for ${kode} yet.`)}
			</p>
		{/if}
	{/await}

	{#if posisi52 !== null && kutipan}
		<div class="mt-5">
			<div class="text-muted flex justify-between text-[11.5px]">
				<span>{t('Terendah 52 minggu', '52-week low')}</span>
				<span>{t('Tertinggi 52 minggu', '52-week high')}</span>
			</div>
			<div
				class="rentang mt-1.5"
				role="img"
				aria-label={t(
					`Harga ${formatHarga(kutipan.last_close_price)} berada di ${Math.round(posisi52 * 100)} persen rentang 52 minggu`,
					`Price ${formatHarga(kutipan.last_close_price)} sits at ${Math.round(posisi52 * 100)} percent of the 52-week range`
				)}
			>
				<span class="penanda" style="left:{posisi52 * 100}%"></span>
			</div>
			<div class="tw-data text-secondary mt-1 flex justify-between text-[12px]">
				<span>{formatHarga(kutipan.low_52w)}</span>
				<span>{formatHarga(kutipan.high_52w)}</span>
			</div>
		</div>
	{/if}
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

	.kerangka {
		display: flex;
		min-height: 220px;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 20px;
		text-align: center;
	}

	.sel {
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		background: color-mix(in srgb, var(--cahaya) 2%, transparent);
		padding: 8px 10px;
	}

	.rentang {
		position: relative;
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--kilau) 10%, transparent),
			color-mix(in srgb, var(--kilau) 28%, transparent)
		);
	}

	.penanda {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border: 2px solid var(--color-base);
		border-radius: 3px;
		background: var(--color-ink);
		transform: rotate(45deg);
	}
</style>
