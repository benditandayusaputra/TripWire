<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import CincinSkor from '$lib/components/watchlist/CincinSkor.svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import Sparkline from '$lib/components/watchlist/Sparkline.svelte';
	import {
		formatDesimal,
		formatPersen,
		kataArah,
		kelasArah,
		type BarisDashboard
	} from '$lib/dashboard';
	import { formatRingkas } from '$lib/insight';
	import { formatHarga } from '$lib/watchlist';

	let {
		baris,
		pilihan,
		onpilih,
		memuat
	}: {
		baris: BarisDashboard[];
		pilihan: string | null;
		onpilih: (ticker: string) => void;
		memuat: boolean;
	} = $props();

	type Kunci = 'kode' | 'ubah' | 'bulan' | 'kuartal' | 'volume' | 'skor';

	const AMBIL: Record<Kunci, (satu: BarisDashboard) => number | string | null> = {
		kode: (satu) => satu.ticker,
		ubah: (satu) => satu.penutupan?.ubah ?? null,
		bulan: (satu) => satu.bulan,
		kuartal: (satu) => satu.kuartal,
		volume: (satu) => satu.volume?.rasio ?? null,
		skor: (satu) => satu.skor
	};

	let urut = $state<{ kunci: Kunci; naik: boolean }>({ kunci: 'skor', naik: false });

	const tampil = $derived(
		[...baris].sort((a, b) => {
			const x = AMBIL[urut.kunci](a);
			const y = AMBIL[urut.kunci](b);
			if (x === y) return a.ticker.localeCompare(b.ticker);
			if (x === null) return 1;
			if (y === null) return -1;
			return (x < y ? -1 : 1) * (urut.naik ? 1 : -1);
		})
	);

	const KOLOM = $derived<{ kunci: Kunci; label: string; kelas: string; judul: string }[]>([
		{
			kunci: 'kode',
			label: t('Saham', 'Stock'),
			kelas: 'kiri',
			judul: t('Urutkan menurut kode', 'Sort by ticker')
		},
		{
			kunci: 'ubah',
			label: t('Harga', 'Price'),
			kelas: 'kanan',
			judul: t('Urutkan menurut perubahan harian', 'Sort by daily change')
		},
		{
			kunci: 'bulan',
			label: t('1 bln', '1M'),
			kelas: 'kanan kol-kinerja',
			judul: t('Kinerja sebulan', 'One month return')
		},
		{
			kunci: 'kuartal',
			label: t('3 bln', '3M'),
			kelas: 'kanan kol-kinerja',
			judul: t('Kinerja tiga bulan', 'Three month return')
		},
		{
			kunci: 'volume',
			label: t('Volume', 'Volume'),
			kelas: 'kanan kol-lebar',
			judul: t('Volume terakhir dibanding rata rata 20 hari', 'Latest volume versus 20 day average')
		}
	]);

	function susun(kunci: Kunci) {
		urut = urut.kunci === kunci ? { kunci, naik: !urut.naik } : { kunci, naik: kunci === 'kode' };
	}

	const ariaSort = (kunci: Kunci) =>
		urut.kunci === kunci ? (urut.naik ? 'ascending' : 'descending') : undefined;
</script>

{#snippet kepala(kolom: { kunci: Kunci; label: string; kelas: string; judul: string })}
	<th scope="col" class={kolom.kelas} aria-sort={ariaSort(kolom.kunci)}>
		<button type="button" title={kolom.judul} onclick={() => susun(kolom.kunci)}>
			{kolom.label}
			{#if urut.kunci === kolom.kunci}
				{#if urut.naik}
					<ArrowUp class="size-3" aria-hidden="true" />
				{:else}
					<ArrowDown class="size-3" aria-hidden="true" />
				{/if}
			{/if}
		</button>
	</th>
{/snippet}

{#snippet kerangka(lebar: string)}
	<span class="kerangka" style="width:{lebar}" aria-hidden="true"></span>
{/snippet}

<div class="wadah" data-testid="tabel-watchlist">
	<table>
		<thead>
			<tr>
				{@render kepala(KOLOM[0])}
				<th scope="col" class="kol-tren">{t('Tren 1 bln', '1M trend')}</th>
				{@render kepala(KOLOM[1])}
				{@render kepala(KOLOM[2])}
				{@render kepala(KOLOM[3])}
				{@render kepala(KOLOM[4])}
				<th scope="col" class="kol-lebar">{t('Rentang 52 mgg', '52 wk range')}</th>
				<th scope="col" class="kanan" aria-sort={ariaSort('skor')}>
					<button
						type="button"
						title={t('Urutkan menurut Red Flag Score', 'Sort by Red Flag Score')}
						onclick={() => susun('skor')}
					>
						{t('Skor', 'Score')}
						{#if urut.kunci === 'skor'}
							{#if urut.naik}
								<ArrowUp class="size-3" aria-hidden="true" />
							{:else}
								<ArrowDown class="size-3" aria-hidden="true" />
							{/if}
						{/if}
					</button>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each tampil as satu (satu.ticker)}
				{@const harian = formatPersen(satu.penutupan?.ubah)}
				{@const bulan = formatPersen(satu.bulan)}
				{@const kuartal = formatPersen(satu.kuartal)}
				{@const selisih =
					satu.skor !== null && satu.skorLalu !== null
						? Math.round(satu.skor) - Math.round(satu.skorLalu)
						: 0}
				<tr
					data-testid="baris-watchlist"
					data-ticker={satu.ticker}
					class:terpilih={pilihan === satu.ticker}
					onclick={() => onpilih(satu.ticker)}
				>
					<td class="kiri">
						<button
							type="button"
							class="saham"
							aria-pressed={pilihan === satu.ticker}
							onclick={(event) => {
								event.stopPropagation();
								onpilih(satu.ticker);
							}}
						>
							<LogoEmiten kode={satu.ticker} ukuran={32} />
							<span class="min-w-0 text-left">
								<span class="kode">{satu.ticker}</span>
								<span class="nama">{satu.nama}</span>
							</span>
						</button>
					</td>
					<td class="kol-tren">
						{#if satu.tren && satu.tren.length > 1}
							<Sparkline
								nilai={satu.tren}
								label={t(
									`Harga ${satu.ticker} sebulan terakhir ${kataArah(bulan.arah)} ${bulan.angka}`,
									`${satu.ticker} price over the last month ${kataArah(bulan.arah)} ${bulan.angka}`
								)}
							/>
						{:else if memuat}
							{@render kerangka('100%')}
						{/if}
					</td>
					<td class="kanan">
						{#if satu.penutupan}
							<span class="harga">{formatHarga(satu.penutupan.harga)}</span>
							<span class="pil" data-arah={harian.arah}>{harian.teks}</span>
						{:else if memuat}
							{@render kerangka('56px')}
						{:else}
							<span class="text-muted text-[11.5px]">{t('Belum ada harga', 'No price yet')}</span>
						{/if}
					</td>
					<td class="kanan kol-kinerja tw-data {kelasArah(bulan.arah)}">
						{#if satu.bulan !== null}{bulan.teks}{:else if memuat}{@render kerangka(
								'44px'
							)}{:else}-{/if}
					</td>
					<td class="kanan kol-kinerja tw-data {kelasArah(kuartal.arah)}">
						{#if satu.kuartal !== null}{kuartal.teks}{:else if memuat}{@render kerangka(
								'44px'
							)}{:else}-{/if}
					</td>
					<td class="kanan kol-lebar">
						{#if satu.volume}
							<span
								class="volume"
								class:ramai={satu.volume.rasio >= 1.5}
								title={t(
									`Volume terakhir ${formatRingkas(satu.volume.terakhir)} lembar, rata rata 20 hari ${formatRingkas(satu.volume.rataRata)}`,
									`Latest volume ${formatRingkas(satu.volume.terakhir)} shares, 20 day average ${formatRingkas(satu.volume.rataRata)}`
								)}
							>
								{formatDesimal(satu.volume.rasio, 1)}x
							</span>
						{:else if memuat}
							{@render kerangka('36px')}
						{:else}
							<span class="text-muted">-</span>
						{/if}
					</td>
					<td class="kol-lebar">
						{#if satu.rentang}
							<span
								class="rentang"
								role="img"
								aria-label={t(
									`Harga di ${Math.round(satu.rentang.posisi * 100)} persen rentang 52 minggu, ${formatHarga(satu.rentang.rendah)} sampai ${formatHarga(satu.rentang.tinggi)}`,
									`Price at ${Math.round(satu.rentang.posisi * 100)} percent of the 52 week range, ${formatHarga(satu.rentang.rendah)} to ${formatHarga(satu.rentang.tinggi)}`
								)}
							>
								<span class="jalur"
									><span class="penanda" style="left:{satu.rentang.posisi * 100}%"></span></span
								>
								<span class="ujung"
									><span>{formatHarga(satu.rentang.rendah)}</span><span
										>{formatHarga(satu.rentang.tinggi)}</span
									></span
								>
							</span>
						{:else}
							<span class="text-muted">-</span>
						{/if}
					</td>
					<td class="kanan">
						<span class="skor">
							<CincinSkor skor={satu.skor} />
							{#if selisih !== 0}
								<span
									class="selisih"
									title={t(
										`Berubah ${selisih} dari pemindaian sebelumnya`,
										`Changed ${selisih} since the previous scan`
									)}>{selisih > 0 ? '+' : ''}{selisih}</span
								>
							{/if}
						</span>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.wadah {
		container-type: inline-size;
		margin-inline: -8px;
	}

	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}

	th {
		padding: 0 8px 8px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--color-muted);
	}

	th button {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		text-transform: inherit;
		letter-spacing: inherit;
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		th button:hover {
			color: var(--color-ink);
		}
	}

	th[aria-sort] button {
		color: var(--color-secondary);
	}

	td {
		border-top: 1px solid var(--edge-soft);
		padding: 9px 8px;
		vertical-align: middle;
		font-size: 12.5px;
		white-space: nowrap;
	}

	.kiri {
		text-align: left;
	}

	.kanan {
		text-align: right;
	}

	tbody tr {
		cursor: pointer;
		transition: background 0.2s ease;
	}

	@media (hover: hover) {
		tbody tr:hover {
			background: color-mix(in srgb, var(--kilau) 4%, transparent);
		}
	}

	tr.terpilih {
		background: color-mix(in srgb, var(--color-diamond-500) 9%, transparent);
	}

	tr.terpilih td:first-child {
		box-shadow: inset 3px 0 0 var(--color-diamond-500);
	}

	.saham {
		display: flex;
		max-width: 210px;
		align-items: center;
		gap: 10px;
		border-radius: 8px;
	}

	.kode {
		display: block;
		font-family: var(--font-mono);
		font-size: 13.5px;
		font-weight: 600;
		letter-spacing: 0.03em;
		color: var(--color-ink);
	}

	.nama {
		display: block;
		max-width: 150px;
		overflow: hidden;
		font-size: 11.5px;
		text-overflow: ellipsis;
		color: var(--color-muted);
	}

	.kol-tren {
		display: none;
		width: 72px;
	}

	.kol-kinerja,
	.kol-lebar {
		display: none;
	}

	@container (min-width: 440px) {
		.kol-tren {
			display: table-cell;
		}
	}

	@container (min-width: 580px) {
		.kol-kinerja {
			display: table-cell;
		}
	}

	@container (min-width: 720px) {
		.kol-lebar {
			display: table-cell;
		}
	}

	.harga {
		display: block;
		font-family: var(--font-mono);
		font-size: 13.5px;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.pil {
		display: inline-block;
		margin-top: 2px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
		padding: 0 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 1.6;
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

	.volume {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--color-secondary);
	}

	.volume.ramai {
		border-radius: 6px;
		background: color-mix(in srgb, var(--kilau) 12%, transparent);
		padding: 1px 6px;
		font-weight: 600;
		color: var(--color-ink);
	}

	.rentang {
		display: block;
		width: 92px;
	}

	.jalur {
		position: relative;
		display: block;
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 16%, transparent);
	}

	.penanda {
		position: absolute;
		top: 50%;
		width: 9px;
		height: 9px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}

	.ujung {
		display: flex;
		justify-content: space-between;
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 9.5px;
		color: var(--color-muted);
	}

	.skor {
		position: relative;
		display: inline-flex;
	}

	.selisih {
		position: absolute;
		top: -5px;
		right: -8px;
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
		display: inline-block;
		height: 12px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--kilau) 10%, transparent);
		animation: denyut 1.4s ease-in-out infinite;
	}

	@keyframes denyut {
		50% {
			opacity: 0.45;
		}
	}
</style>
