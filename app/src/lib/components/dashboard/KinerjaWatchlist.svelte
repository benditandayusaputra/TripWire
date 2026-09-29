<script lang="ts">
	import { ChartNoAxesCombined } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import {
		formatDesimal,
		formatPersen,
		kelasArah,
		tanggalBursa,
		type BarisDashboard
	} from '$lib/dashboard';
	import { garisBantu, type SeriIndeks } from '$lib/pasar';
	import { ronaEmiten } from '$lib/watchlist';

	let {
		baris,
		ihsg,
		memuat,
		pilihan,
		class: kelas = ''
	}: {
		baris: BarisDashboard[];
		ihsg: SeriIndeks | null;
		memuat: boolean;
		pilihan: string | null;
		class?: string;
	} = $props();

	const MAKS_GARIS = 8;
	const PAD_KANAN = 52;
	const PAD_ATAS = 10;
	const PAD_BAWAH = 24;

	let rentang = $state<'1B' | '3B'>('3B');
	let lebar = $state(640);
	let sorot = $state<number | null>(null);
	let fokus = $state<string | null>(null);

	const tinggi = $derived(lebar < 560 ? 200 : 236);
	const lebarPlot = $derived(Math.max(10, lebar - PAD_KANAN));
	const dasar = $derived(tinggi - PAD_BAWAH);
	const disorot = $derived(fokus ?? pilihan);

	const tanggal = $derived.by(() => {
		const kumpulan = new Set<string>((ihsg?.series ?? []).map((titik) => titik.date));
		if (!kumpulan.size)
			for (const satu of baris) for (const bar of satu.seri) kumpulan.add(bar.date);
		const semua = [...kumpulan].sort();
		return rentang === '1B' ? semua.slice(-22) : semua;
	});
	const n = $derived(tanggal.length);

	const seri = $derived.by(() => {
		const sumber = [
			...(ihsg?.series.length
				? [
						{
							kode: 'IHSG',
							indeks: true,
							nilai: new Map(ihsg.series.map((titik) => [titik.date, titik.price]))
						}
					]
				: []),
			...baris
				.filter((satu) => satu.seri.length > 1)
				.slice(0, MAKS_GARIS)
				.map((satu) => ({
					kode: satu.ticker,
					indeks: false,
					nilai: new Map(satu.seri.map((bar) => [bar.date, bar.close]))
				}))
		];
		return sumber.map((satu) => {
			const awal = tanggal.map((hari) => satu.nilai.get(hari)).find((nilai) => nilai !== undefined);
			const titik = tanggal.map((hari, i) => {
				const nilai = satu.nilai.get(hari);
				return nilai === undefined || !awal ? null : { i, ubah: nilai / awal - 1 };
			});
			const akhir = titik.findLast((item) => item !== null)?.ubah ?? null;
			return { kode: satu.kode, indeks: satu.indeks, titik, akhir };
		});
	});

	const batas = $derived.by(() => {
		const semua = seri.flatMap((satu) =>
			satu.titik.flatMap((titik) => (titik ? [titik.ubah] : []))
		);
		const bawah = Math.min(0, ...semua);
		const atas = Math.max(0, ...semua);
		const ruang = Math.max((atas - bawah) * 0.1, 0.005);
		return { bawah: bawah - ruang, atas: atas + ruang };
	});

	const x = (i: number) => (n > 1 ? (i / (n - 1)) * lebarPlot : 0);
	const y = (ubah: number) =>
		PAD_ATAS + ((batas.atas - ubah) / (batas.atas - batas.bawah || 1)) * (dasar - PAD_ATAS);

	const jalur = (titik: ({ i: number; ubah: number } | null)[]) =>
		titik
			.filter((item) => item !== null)
			.map(
				(item, urutan) => `${urutan ? 'L' : 'M'}${x(item.i).toFixed(1)} ${y(item.ubah).toFixed(1)}`
			)
			.join('');

	const warna = (kode: string, indeks: boolean) =>
		indeks
			? 'var(--color-ink)'
			: `light-dark(hsl(${ronaEmiten(kode)} 58% 42%), hsl(${ronaEmiten(kode)} 78% 70%))`;

	const bantu = $derived(n > 1 ? garisBantu(batas.bawah, batas.atas, 4) : []);
	const urutAkhir = $derived([...seri].sort((a, b) => (b.akhir ?? -9) - (a.akhir ?? -9)));

	const info = $derived.by(() => {
		if (sorot === null || !tanggal[sorot]) return null;
		const i = sorot;
		return {
			tanggal: tanggal[i],
			x: x(i),
			nilai: seri
				.map((satu) => ({
					kode: satu.kode,
					indeks: satu.indeks,
					ubah: satu.titik[i]?.ubah ?? null
				}))
				.filter((satu) => satu.ubah !== null)
				.sort((a, b) => (b.ubah ?? 0) - (a.ubah ?? 0))
		};
	});

	function gerak(event: PointerEvent) {
		if (n < 2) return;
		const kotak = (event.currentTarget as HTMLElement).getBoundingClientRect();
		sorot = Math.min(
			n - 1,
			Math.max(0, Math.round(((event.clientX - kotak.left) / kotak.width) * (n - 1)))
		);
	}
</script>

<Panel
	judul={t('Kinerja watchlist dibanding IHSG', 'Watchlist versus IHSG')}
	keterangan={t(
		'Perubahan harga sejak awal periode, semua garis mulai dari 0%',
		'Price change since the start of the period, every line starts at 0%'
	)}
	ikon={ChartNoAxesCombined}
	testid="panel-kinerja"
	class={kelas}
>
	{#snippet aksi()}
		<div class="pilihan" role="group" aria-label={t('Rentang waktu', 'Time range')}>
			{#each ['1B', '3B'] as const as satu (satu)}
				<button type="button" aria-pressed={rentang === satu} onclick={() => (rentang = satu)}
					>{satu === '1B' ? t('1B', '1M') : t('3B', '3M')}</button
				>
			{/each}
		</div>
	{/snippet}

	{#if n > 1 && seri.length}
		<div class="bingkai" bind:clientWidth={lebar} style="height:{tinggi}px">
			<svg viewBox="0 0 {lebar} {tinggi}" width={lebar} height={tinggi} aria-hidden="true">
				{#each bantu as nilai (nilai)}
					<line
						x1="0"
						x2={lebarPlot}
						y1={y(nilai)}
						y2={y(nilai)}
						class={nilai === 0 ? 'nol' : 'bantu'}
					/>
					<text x={lebar - 4} y={y(nilai) + 3.5} text-anchor="end" class="sumbu"
						>{nilai > 0 ? '+' : ''}{formatDesimal(
							nilai * 100,
							Math.abs(nilai * 100) % 1 ? 1 : 0
						)}%</text
					>
				{/each}
				{#each seri as satu (satu.kode)}
					<path
						d={jalur(satu.titik)}
						class="garis"
						class:indeks={satu.indeks}
						class:redup={disorot !== null && disorot !== satu.kode && !satu.indeks}
						class:tebal={disorot === satu.kode}
						style="stroke:{warna(satu.kode, satu.indeks)}"
					/>
				{/each}
				{#each [0, n - 1] as i (i)}
					<text x={x(i)} y={tinggi - 7} text-anchor={i ? 'end' : 'start'} class="sumbu"
						>{tanggalBursa(tanggal[i])}</text
					>
				{/each}
				{#if info}
					<line x1={info.x} x2={info.x} y1={PAD_ATAS} y2={dasar} class="silang" />
				{/if}
			</svg>
			<div
				class="penjelajah"
				style="width:{lebarPlot}px; height:{dasar}px"
				role="presentation"
				onpointermove={gerak}
				onpointerleave={() => (sorot = null)}
			></div>
			{#if info}
				<div
					class="tooltip"
					style="left:{info.x > lebarPlot / 2 ? info.x - 168 : info.x + 12}px"
					aria-hidden="true"
				>
					<p class="text-muted text-[11px]">{tanggalBursa(info.tanggal, true)}</p>
					<ul class="mt-1 space-y-0.5">
						{#each info.nilai as satu (satu.kode)}
							{@const ubah = formatPersen(satu.ubah)}
							<li class="flex items-center justify-between gap-3 text-[11.5px]">
								<span class="flex items-center gap-1.5">
									<span
										class="garis-legenda"
										class:indeks={satu.indeks}
										style="background:{warna(satu.kode, satu.indeks)}"
									></span>
									<span class="tw-data text-ink">{satu.kode}</span>
								</span>
								<span class="tw-data {kelasArah(ubah.arah)}">{ubah.teks}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<ul class="legenda" aria-label={t('Kinerja per saham', 'Return per stock')}>
			{#each urutAkhir as satu (satu.kode)}
				{@const ubah = formatPersen(satu.akhir)}
				<li>
					<button
						type="button"
						data-testid="legenda-kinerja"
						data-kode={satu.kode}
						aria-pressed={disorot === satu.kode}
						onmouseenter={() => (fokus = satu.kode)}
						onmouseleave={() => (fokus = null)}
						onfocus={() => (fokus = satu.kode)}
						onblur={() => (fokus = null)}
					>
						<span
							class="garis-legenda"
							class:indeks={satu.indeks}
							style="background:{warna(satu.kode, satu.indeks)}"
						></span>
						<span class="tw-data text-ink text-[12px] font-semibold">{satu.kode}</span>
						<span class="tw-data text-[11.5px] {kelasArah(ubah.arah)}">{ubah.teks}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if baris.filter((satu) => satu.seri.length > 1).length > MAKS_GARIS}
			<p class="text-muted mt-2 text-[11.5px]">
				{t(
					`Menampilkan ${MAKS_GARIS} saham pertama sesuai urutan watchlist.`,
					`Showing the first ${MAKS_GARIS} stocks in watchlist order.`
				)}
			</p>
		{/if}
	{:else if memuat}
		<span class="kerangka" aria-hidden="true"></span>
	{:else}
		<p class="text-muted text-[13px]">
			{t(
				'Grafik kinerja muncul setelah harga harian saham watchlist termuat dari Sectors.',
				'The chart appears once daily prices for your watchlist load from Sectors.'
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
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-secondary);
	}

	.pilihan button[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-diamond-500) 16%, transparent);
		color: var(--color-diamond-100);
	}

	.bingkai {
		position: relative;
	}

	svg {
		display: block;
		overflow: visible;
	}

	.bantu {
		stroke: var(--edge-soft);
	}

	.nol {
		stroke: var(--edge-strong);
		stroke-dasharray: 3 4;
	}

	.sumbu {
		fill: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10.5px;
	}

	.garis {
		fill: none;
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition:
			opacity 0.2s ease,
			stroke-width 0.2s ease;
	}

	.garis.indeks {
		stroke-width: 2;
		stroke-dasharray: 5 4;
	}

	.garis.redup {
		opacity: 0.22;
	}

	.garis.tebal {
		stroke-width: 2.8;
	}

	.silang {
		stroke: var(--edge-strong);
		stroke-dasharray: 2 3;
	}

	.penjelajah {
		position: absolute;
		top: 0;
		left: 0;
		cursor: crosshair;
		touch-action: pan-y;
	}

	.tooltip {
		position: absolute;
		top: 4px;
		width: 156px;
		pointer-events: none;
		border: 1px solid var(--edge-strong);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 7px 10px;
		box-shadow: 0 14px 30px -18px var(--bayang);
	}

	.legenda {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 12px;
	}

	.legenda button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 4px 10px;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.legenda button[aria-pressed='true'] {
		border-color: var(--edge-strong);
		background: color-mix(in srgb, var(--kilau) 6%, transparent);
	}

	.garis-legenda {
		width: 12px;
		height: 3px;
		border-radius: 2px;
	}

	.garis-legenda.indeks {
		width: 12px;
		background: repeating-linear-gradient(
			90deg,
			var(--color-ink) 0 4px,
			transparent 4px 7px
		) !important;
	}

	.kerangka {
		display: block;
		height: 220px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
		animation: denyut 1.4s ease-in-out infinite;
	}

	@keyframes denyut {
		50% {
			opacity: 0.45;
		}
	}
</style>
