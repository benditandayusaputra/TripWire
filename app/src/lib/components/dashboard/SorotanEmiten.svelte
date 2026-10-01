<script lang="ts">
	import { ArrowRight, ChartCandlestick, Layers, ListChecks } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import KondisiLabel from '$lib/components/KondisiLabel.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import {
		formatDesimal,
		formatPersen,
		kelasArah,
		tanggalBursa,
		type BarisDashboard
	} from '$lib/dashboard';
	import { formatAngka, formatRingkas, labelSinyal } from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';
	import { NAMA_SEKTOR, formatHarga, formatRupiah } from '$lib/watchlist';

	let { baris, memuat }: { baris: BarisDashboard; memuat: boolean } = $props();

	const LEBAR = 320;
	const TINGGI = 96;

	const id = $props.id();
	const kutipan = $derived(baris.kutipan);
	const harian = $derived(formatPersen(baris.penutupan?.ubah));
	const subSkor = $derived(
		Object.entries(
			baris.risiko?.red_flag?.sub_scores ?? baris.redFlag?.payload?.sub_scores ?? {}
		) as [string, number][]
	);
	const pola = $derived(baris.redFlag?.payload?.cross_pattern);
	const insightTerbaru = $derived(
		[baris.redFlag, baris.pasar]
			.filter((insight) => insight !== null)
			.sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0] ?? null
	);

	const tutup = $derived(baris.seri.map((bar) => bar.close));
	const arah = $derived(tutup.length > 1 ? Math.sign(tutup[tutup.length - 1] - tutup[0]) : 0);
	const titik = $derived.by(() => {
		if (tutup.length < 2) return [] as [number, number][];
		const rendah = Math.min(...tutup);
		const rentang = Math.max(...tutup) - rendah || 1;
		return tutup.map((harga, i): [number, number] => [
			(i / (tutup.length - 1)) * LEBAR,
			8 + (1 - (harga - rendah) / rentang) * (TINGGI - 16)
		]);
	});
	const garis = $derived(
		titik.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
	);

	const kinerja = $derived([
		{ label: t('1H', '1D'), nilai: formatPersen(baris.penutupan?.ubah) },
		{ label: t('1B', '1M'), nilai: formatPersen(baris.bulan) },
		{ label: t('3B', '3M'), nilai: formatPersen(baris.kuartal) }
	]);

	const statistik = $derived(
		[
			kutipan?.market_cap
				? [t('Kapitalisasi', 'Market cap'), formatRupiah(kutipan.market_cap)]
				: null,
			kutipan?.market_cap_rank
				? [t('Peringkat kapitalisasi', 'Market cap rank'), `#${kutipan.market_cap_rank}`]
				: null,
			baris.volume
				? [
						t('Volume terakhir', 'Latest volume'),
						`${formatRingkas(baris.volume.terakhir)} (${formatDesimal(baris.volume.rasio, 1)}x)`
					]
				: null,
			baris.redFlag?.payload?.supporting_data?.free_float_pct !== undefined
				? [
						t('Saham publik', 'Free float'),
						`${formatAngka(baris.redFlag.payload.supporting_data.free_float_pct, 1)}%`
					]
				: null
		].filter((item): item is string[] => item !== null)
	);
</script>

<div data-testid="sorotan-emiten" data-ticker={baris.ticker} class="space-y-5">
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<LogoEmiten kode={baris.ticker} ukuran={40} />
			<div class="min-w-0">
				<p class="tw-data text-ink text-[16px] font-semibold tracking-wide">{baris.ticker}</p>
				<p class="text-secondary truncate text-[12.5px]">{baris.nama}</p>
				{#if baris.sektor}
					<p class="text-muted truncate text-[11.5px]">
						{NAMA_SEKTOR[baris.sektor] ?? baris.sektor}
					</p>
				{/if}
			</div>
		</div>
		<div class="flex-none">
			<SkorBadge skor={baris.skor} size="lg" />
		</div>
	</div>

	{#if baris.penutupan}
		<div>
			<p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
				<span
					data-testid="harga-sorotan"
					class="tw-data text-ink text-[28px] leading-none font-medium"
					>{formatHarga(baris.penutupan.harga)}</span
				>
				<span class="tw-data text-[13px] font-medium {kelasArah(harian.arah)}">{harian.teks}</span>
			</p>
			{#if baris.penutupan.tanggal}
				<p class="text-muted mt-1 text-[11.5px]">
					{t('Penutupan', 'Close')}
					{tanggalBursa(baris.penutupan.tanggal, true)}
				</p>
			{/if}
		</div>
	{:else if !memuat}
		<p class="text-muted text-[12.5px]">
			{t(
				'Harga tampil setelah data harian saham ini termuat dari Sectors.',
				'The price appears once daily data for this stock loads from Sectors.'
			)}
		</p>
	{/if}

	{#if titik.length > 1}
		<svg
			viewBox="0 0 {LEBAR} {TINGGI}"
			preserveAspectRatio="none"
			class="grafik"
			data-arah={arah > 0 ? 'naik' : arah < 0 ? 'turun' : 'datar'}
			role="img"
			aria-label={t(
				`Harga ${baris.ticker} tiga bulan terakhir, ${formatPersen(baris.kuartal).teks}`,
				`${baris.ticker} price over the last three months, ${formatPersen(baris.kuartal).teks}`
			)}
		>
			<defs>
				<linearGradient id="isi-{id}" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stop-color="currentColor" stop-opacity="0.22" />
					<stop offset="1" stop-color="currentColor" stop-opacity="0" />
				</linearGradient>
			</defs>
			<line x1="0" x2={LEBAR} y1={titik[0][1]} y2={titik[0][1]} class="acuan" />
			<path d="{garis}L{LEBAR} {TINGGI}L0 {TINGGI}Z" fill="url(#isi-{id})" />
			<path d={garis} class="jejak" />
		</svg>
	{:else if memuat}
		<span class="kerangka" aria-hidden="true"></span>
	{/if}

	<dl class="kinerja">
		{#each kinerja as satu (satu.label)}
			<div>
				<dt>{satu.label}</dt>
				<dd class={kelasArah(satu.nilai.arah)}>{satu.nilai.teks}</dd>
			</div>
		{/each}
	</dl>

	{#if baris.rentang}
		<div class="space-y-2">
			<p class="tw-overline">{t('Rentang 52 minggu', '52 week range')}</p>
			<div class="flex items-center gap-3">
				<span class="tw-data text-muted text-[11.5px]">{formatHarga(baris.rentang.rendah)}</span>
				<span class="rentang">
					<span class="penanda" style="left:{baris.rentang.posisi * 100}%"></span>
				</span>
				<span class="tw-data text-muted text-[11.5px]">{formatHarga(baris.rentang.tinggi)}</span>
			</div>
		</div>
	{/if}

	{#if statistik.length}
		<dl class="grid grid-cols-2 gap-x-4 gap-y-3">
			{#each statistik as [label, nilai] (label)}
				<div class="min-w-0">
					<dt class="text-muted text-[11.5px]">{label}</dt>
					<dd class="tw-data text-ink mt-0.5 truncate text-[13px]">{nilai}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if kutipan?.indices.length}
		<ul
			class="flex flex-wrap gap-1.5"
			aria-label={t(`Indeks yang memuat ${baris.ticker}`, `Indices that include ${baris.ticker}`)}
		>
			{#each kutipan.indices.slice(0, 6) as indeks (indeks)}
				<li class="chip">{indeks}</li>
			{/each}
		</ul>
	{/if}

	{#if subSkor.length}
		<div class="space-y-2.5">
			<p class="tw-overline">{t('Komponen Red Flag Score', 'Red Flag Score components')}</p>
			<ul class="space-y-2">
				{#each subSkor as [kunci, nilai] (kunci)}
					<li class="grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-3">
						<span class="text-secondary truncate text-[12.5px]">{labelSinyal(kunci)}</span>
						<span class="lajur">
							<span
								class="isi"
								style="width:{Math.max(nilai, 3)}%; background:{tierDariSkor(nilai).color}"
							></span>
						</span>
						<span class="tw-data text-ink text-right text-[12px]">{Math.round(nilai)}</span>
					</li>
				{/each}
			</ul>
			{#if pola?.multiplier_applied && pola.multiplier_applied > 1}
				<p class="text-secondary flex items-start gap-2 pt-1 text-[12px] leading-snug">
					<Layers class="text-muted mt-0.5 size-3.5 flex-none" aria-hidden="true" />
					{t(
						`${pola.signals_active_in_window ?? pola.active_signals?.length} sinyal muncul dalam ${pola.window_days ?? 30} hari, skor dikali ${formatAngka(pola.multiplier_applied, 1)}.`,
						`${pola.signals_active_in_window ?? pola.active_signals?.length} signals appeared within ${pola.window_days ?? 30} days, score multiplied by ${formatAngka(pola.multiplier_applied, 1)}.`
					)}
				</p>
			{/if}
		</div>
	{/if}

	<div class="border-line space-y-3 border-t pt-4">
		<p class="text-[12.5px] leading-relaxed">
			{#if baris.kondisiAktif.length}
				<span class="text-muted">{t('Dipantau:', 'Monitored:')}</span>
				<KondisiLabel
					type={baris.kondisiAktif[0].condition_type}
					config={baris.kondisiAktif[0].config}
				/>
				{#if baris.kondisiAktif.length > 1}
					<span class="text-muted"
						>{t(
							`dan ${baris.kondisiAktif.length - 1} kondisi lain`,
							`and ${baris.kondisiAktif.length - 1} more conditions`
						)}</span
					>
				{/if}
			{:else}
				<span class="text-secondary"
					>{t(
						'Belum ada kondisi pemicu, jadi saham ini belum ikut dipindai.',
						'No trigger condition yet, so this stock is not being scanned.'
					)}</span
				>
			{/if}
		</p>
		<div class="flex flex-wrap gap-2">
			{#if insightTerbaru}
				<a href="/insights/{insightTerbaru.id}" class="tw-primary px-3.5 py-2 text-[13px]">
					{t('Buka insight terbaru', 'Open latest insight')}
					<ArrowRight class="size-3.5" aria-hidden="true" />
				</a>
			{/if}
			<a
				href="/stocks/{baris.ticker}"
				class="tw-ghost px-3.5 py-2 text-[13px]"
				data-testid="sorotan-halaman-saham"
			>
				<ChartCandlestick class="size-3.5" aria-hidden="true" />
				{t('Halaman saham', 'Stock page')}
			</a>
			<a href="/watchlist?emiten={baris.ticker}" class="tw-ghost px-3.5 py-2 text-[13px]">
				<ListChecks class="size-3.5" aria-hidden="true" />
				{t('Detail di watchlist', 'Details in watchlist')}
			</a>
		</div>
	</div>
</div>

<style>
	.grafik {
		display: block;
		width: 100%;
		height: 96px;
		overflow: visible;
		color: var(--color-muted);
	}

	.grafik[data-arah='naik'] {
		color: var(--color-naik);
	}

	.grafik[data-arah='turun'] {
		color: var(--color-turun);
	}

	.acuan {
		stroke: var(--edge-strong);
		stroke-dasharray: 3 4;
		vector-effect: non-scaling-stroke;
	}

	.jejak {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}

	.kinerja {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.kinerja div {
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		background: var(--color-void);
		padding: 8px 10px;
	}

	.kinerja dt {
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-muted);
	}

	.kinerja dd {
		margin-top: 2px;
		font-family: var(--font-mono);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.lajur {
		position: relative;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
	}

	.rentang {
		position: relative;
		height: 4px;
		flex: 1;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 14%, transparent);
	}

	.penanda {
		position: absolute;
		top: 50%;
		width: 11px;
		height: 11px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}

	.chip {
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-secondary);
	}

	.kerangka {
		display: block;
		height: 96px;
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
