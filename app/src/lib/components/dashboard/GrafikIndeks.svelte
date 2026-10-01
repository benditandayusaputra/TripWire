<script lang="ts">
	import { ChartSpline, RotateCw } from 'lucide-svelte';
	import { request } from '$lib/api/client';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import { formatDesimal, formatPersen, kataArah, kelasArah, tanggalBursa } from '$lib/dashboard';
	import { garisBantu, type SeriIndeks } from '$lib/pasar';

	let {
		ihsg,
		memuat,
		class: kelas = ''
	}: { ihsg: SeriIndeks | null; memuat: boolean; class?: string } = $props();

	const INDEKS = [
		{ kode: 'ihsg', label: 'IHSG' },
		{ kode: 'lq45', label: 'LQ45' },
		{ kode: 'idx30', label: 'IDX30' }
	] as const;
	type Kode = (typeof INDEKS)[number]['kode'];
	type Status = SeriIndeks | 'memuat' | 'galat';

	const PAD_KANAN = 66;
	const PAD_ATAS = 14;
	const PAD_BAWAH = 26;
	const HARI_SEBULAN = 22;

	const id = $props.id();

	let kode = $state<Kode>('ihsg');
	let rentang = $state<'1B' | '3B'>('3B');
	let sorot = $state<number | null>(null);
	let lebar = $state(640);
	let lain = $state<Partial<Record<Kode, Status>>>({});

	const label = $derived(INDEKS.find((satu) => satu.kode === kode)?.label ?? 'IHSG');
	const status = $derived<Status>(
		kode === 'ihsg' ? (ihsg ?? (memuat ? 'memuat' : 'galat')) : (lain[kode] ?? 'memuat')
	);
	const seri = $derived(typeof status === 'object' ? status.series : []);
	const tampil = $derived(rentang === '1B' ? seri.slice(-HARI_SEBULAN) : seri);
	const n = $derived(tampil.length);

	const tinggi = $derived(lebar < 560 ? 208 : 256);
	const lebarPlot = $derived(Math.max(10, lebar - PAD_KANAN));
	const dasar = $derived(tinggi - PAD_BAWAH);

	const batas = $derived.by(() => {
		const nilai = tampil.map((titik) => titik.price);
		const rendah = Math.min(...nilai);
		const puncak = Math.max(...nilai);
		const ruang = Math.max((puncak - rendah) * 0.14, puncak * 0.002);
		return { bawah: rendah - ruang, atas: puncak + ruang };
	});

	const x = (i: number) => (n > 1 ? (i / (n - 1)) * lebarPlot : lebarPlot / 2);
	const y = (nilai: number) =>
		PAD_ATAS + ((batas.atas - nilai) / (batas.atas - batas.bawah || 1)) * (dasar - PAD_ATAS);

	const garis = $derived(
		tampil
			.map((titik, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(titik.price).toFixed(1)}`)
			.join('')
	);
	const bantu = $derived(n > 1 ? garisBantu(batas.bawah, batas.atas, 4) : []);
	const labelTanggal = $derived(
		n < 2 ? [] : [...new Set([0, 0.34, 0.67, 1].map((posisi) => Math.round(posisi * (n - 1))))]
	);

	const terakhir = $derived(seri.at(-1) ?? null);
	const kemarin = $derived(seri.at(-2) ?? null);
	const harian = $derived(
		terakhir && kemarin
			? { selisih: terakhir.price - kemarin.price, ubah: terakhir.price / kemarin.price - 1 }
			: null
	);
	const periode = $derived(n > 1 ? tampil[n - 1].price / tampil[0].price - 1 : null);
	const arahPeriode = $derived(Math.sign(periode ?? 0));
	const ubahHarian = $derived(formatPersen(harian?.ubah));
	const ubahPeriode = $derived(formatPersen(periode));
	const ekstrem = $derived.by(() => {
		if (!n) return null;
		const urut = [...tampil].sort((a, b) => a.price - b.price);
		return { rendah: urut[0], tinggi: urut[urut.length - 1] };
	});

	const info = $derived.by(() => {
		if (sorot === null || !tampil[sorot]) return null;
		const titik = tampil[sorot];
		const lalu = seri[seri.length - n + sorot - 1];
		return {
			titik,
			ubah: formatPersen(lalu ? titik.price / lalu.price - 1 : null),
			x: x(sorot),
			y: y(titik.price)
		};
	});

	const yTag = $derived(info ? info.y : n ? y(tampil[n - 1].price) : 0);

	const teksSlider = $derived.by(() => {
		const i = sorot ?? n - 1;
		const titik = tampil[i];
		if (!titik) return '';
		const lalu = seri[seri.length - n + i - 1];
		const ubah = formatPersen(lalu ? titik.price / lalu.price - 1 : null);
		return `${tanggalBursa(titik.date, true)}, ${label} ${formatDesimal(titik.price)}, ${kataArah(ubah.arah)} ${ubah.angka}`;
	});

	async function pilih(baru: Kode) {
		kode = baru;
		sorot = null;
		if (baru === 'ihsg' || (lain[baru] && lain[baru] !== 'galat')) return;
		lain[baru] = 'memuat';
		try {
			lain[baru] = await request<SeriIndeks>(`/market/index/${baru}`);
		} catch {
			lain[baru] = 'galat';
		}
	}

	function gerak(event: PointerEvent) {
		if (n < 2) return;
		const kotak = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const posisi = (event.clientX - kotak.left) / Math.max(1, kotak.width);
		sorot = Math.min(n - 1, Math.max(0, Math.round(posisi * (n - 1))));
	}

	function tombol(event: KeyboardEvent) {
		const langkah = (
			{ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 } as Record<string, number>
		)[event.key];
		if (event.key === 'Home') sorot = 0;
		else if (event.key === 'End') sorot = n - 1;
		else if (langkah) sorot = Math.min(n - 1, Math.max(0, (sorot ?? n - 1) + langkah));
		else return;
		event.preventDefault();
	}
</script>

<Panel
	judul={t('Indeks pasar', 'Market index')}
	keterangan={t(
		'Nilai penutupan harian dari Sectors, bukan harga berjalan',
		'Daily closing values from Sectors, not live prices'
	)}
	ikon={ChartSpline}
	testid="panel-indeks"
	class={kelas}
>
	{#snippet aksi()}
		<div class="pilihan" role="tablist" aria-label={t('Pilih indeks', 'Choose an index')}>
			{#each INDEKS as satu (satu.kode)}
				<button
					type="button"
					role="tab"
					aria-selected={kode === satu.kode}
					aria-controls="grafik-{id}"
					data-testid="tab-indeks-{satu.kode}"
					onclick={() => pilih(satu.kode)}>{satu.label}</button
				>
			{/each}
		</div>
	{/snippet}

	<div id="grafik-{id}" data-testid="grafik-indeks" data-kode={label} role="tabpanel">
		<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<div class="min-w-0">
				{#if typeof status === 'object' && terakhir}
					<p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<span data-testid="nilai-indeks" class="nilai">{formatDesimal(terakhir.price)}</span>
						{#if harian}
							<span data-testid="ubah-indeks" class="ubah {kelasArah(ubahHarian.arah)}">
								{ubahHarian.arah > 0 ? '+' : harian.selisih < 0 ? '-' : ''}{formatDesimal(
									Math.abs(harian.selisih)
								)}
								({ubahHarian.teks})
							</span>
						{/if}
					</p>
					<p class="text-muted mt-1 text-[12px]">
						{t('Penutupan', 'Close')}
						{tanggalBursa(terakhir.date, true)}
					</p>
				{:else if status === 'memuat'}
					<span class="kerangka h-9 w-44" aria-hidden="true"></span>
					<span class="kerangka mt-2 h-3 w-28" aria-hidden="true"></span>
				{/if}
			</div>

			<div class="pilihan kecil" role="group" aria-label={t('Rentang waktu', 'Time range')}>
				{#each ['1B', '3B'] as const as satu (satu)}
					<button
						type="button"
						aria-pressed={rentang === satu}
						onclick={() => {
							rentang = satu;
							sorot = null;
						}}
						>{satu === '1B' ? t('1B', '1M') : t('3B', '3M')}
						<span class="sr-only"
							>{satu === '1B'
								? t('satu bulan', 'one month')
								: t('tiga bulan', 'three months')}</span
						></button
					>
				{/each}
			</div>
		</div>

		<div class="bingkai" bind:clientWidth={lebar} style="height:{tinggi}px">
			{#if status === 'memuat'}
				<span class="kerangka h-full w-full" aria-hidden="true"></span>
			{:else if status === 'galat' || n < 2}
				<div class="kosong">
					<p class="text-secondary text-[13px]">
						{t(
							`Data ${label} belum bisa dimuat dari Sectors.`,
							`${label} data could not be loaded from Sectors.`
						)}
					</p>
					{#if kode !== 'ihsg'}
						<button type="button" class="ulang" onclick={() => pilih(kode)}>
							<RotateCw class="size-3.5" aria-hidden="true" />
							{t('Coba lagi', 'Try again')}
						</button>
					{/if}
				</div>
			{:else}
				{#key `${kode}-${rentang}`}
					<svg
						viewBox="0 0 {lebar} {tinggi}"
						width={lebar}
						height={tinggi}
						class="block"
						data-arah={arahPeriode > 0 ? 'naik' : arahPeriode < 0 ? 'turun' : 'datar'}
						aria-hidden="true"
					>
						<defs>
							<linearGradient id="isi-{id}" x1="0" x2="0" y1="0" y2="1">
								<stop offset="0" stop-color="currentColor" stop-opacity="0.24" />
								<stop offset="1" stop-color="currentColor" stop-opacity="0" />
							</linearGradient>
						</defs>

						{#each bantu as nilai (nilai)}
							<line x1="0" x2={lebarPlot} y1={y(nilai)} y2={y(nilai)} class="bantu" />
							{#if Math.abs(y(nilai) - yTag) > 14}
								<text x={lebar - 4} y={y(nilai) + 3.5} text-anchor="end" class="sumbu"
									>{formatDesimal(nilai, nilai % 1 === 0 ? 0 : 2)}</text
								>
							{/if}
						{/each}

						<line
							x1="0"
							x2={lebarPlot}
							y1={y(tampil[0].price)}
							y2={y(tampil[0].price)}
							class="acuan"
						/>
						<path d="{garis}L{x(n - 1)} {dasar}L0 {dasar}Z" fill="url(#isi-{id})" class="area" />
						<path d={garis} pathLength="1" class="jejak" />

						{#each labelTanggal as i (i)}
							<text
								x={x(i)}
								y={tinggi - 8}
								text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
								class="sumbu">{tanggalBursa(tampil[i].date)}</text
							>
						{/each}

						{#if info}
							<line x1={info.x} x2={info.x} y1={PAD_ATAS - 6} y2={dasar} class="silang" />
							<circle cx={info.x} cy={info.y} r="4.5" class="titik" />
						{:else}
							<circle cx={x(n - 1)} cy={y(tampil[n - 1].price)} r="4" class="titik akhir" />
						{/if}
						<rect
							x={lebarPlot + 4}
							y={yTag - 10}
							width={PAD_KANAN - 6}
							height="20"
							rx="5"
							class="tag"
						/>
						<text
							x={lebarPlot + 4 + (PAD_KANAN - 6) / 2}
							y={yTag + 4}
							text-anchor="middle"
							class="tag-teks"
							>{formatDesimal(info ? info.titik.price : tampil[n - 1].price, 0)}</text
						>
					</svg>
				{/key}

				<div
					class="penjelajah"
					style="width:{lebarPlot}px; height:{dasar}px"
					role="slider"
					tabindex="0"
					aria-label={t(`Telusuri grafik ${label} per hari`, `Explore the ${label} chart by day`)}
					aria-valuemin="1"
					aria-valuemax={n}
					aria-valuenow={(sorot ?? n - 1) + 1}
					aria-valuetext={teksSlider}
					onpointermove={gerak}
					onpointerdown={gerak}
					onpointerleave={() => (sorot = null)}
					onkeydown={tombol}
					onblur={() => (sorot = null)}
				></div>

				{#if info}
					<div
						class="tooltip"
						style="left:{Math.min(Math.max(info.x - 74, 0), Math.max(0, lebarPlot - 148))}px"
						aria-hidden="true"
					>
						<p class="text-muted text-[11px]">{tanggalBursa(info.titik.date, true)}</p>
						<p class="tw-data text-ink text-[14px] leading-tight">
							{formatDesimal(info.titik.price)}
						</p>
						<p class="tw-data text-[11.5px] {kelasArah(info.ubah.arah)}">{info.ubah.teks}</p>
					</div>
				{/if}
			{/if}
		</div>

		{#if ekstrem && n > 1}
			<dl class="statistik">
				<div>
					<dt>{t('Perubahan periode', 'Period change')}</dt>
					<dd class={kelasArah(ubahPeriode.arah)}>{ubahPeriode.teks}</dd>
				</div>
				<div>
					<dt>{t('Tertinggi', 'High')}</dt>
					<dd>{formatDesimal(ekstrem.tinggi.price)}</dd>
				</div>
				<div>
					<dt>{t('Terendah', 'Low')}</dt>
					<dd>{formatDesimal(ekstrem.rendah.price)}</dd>
				</div>
				<div>
					<dt>{t('Hari bursa', 'Trading days')}</dt>
					<dd>{n}</dd>
				</div>
			</dl>
		{/if}
	</div>
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
		padding: 5px 11px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		color: var(--color-secondary);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.pilihan.kecil button {
		padding: 4px 10px;
		font-size: 11.5px;
	}

	.pilihan button[aria-selected='true'],
	.pilihan button[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-diamond-500) 16%, transparent);
		color: var(--color-diamond-100);
	}

	@media (hover: hover) {
		.pilihan button:hover {
			color: var(--color-ink);
		}
	}

	.nilai {
		font-family: var(--font-mono);
		font-size: 32px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1;
		letter-spacing: -0.02em;
		color: var(--color-ink);
	}

	@media (min-width: 640px) {
		.nilai {
			font-size: 38px;
		}
	}

	.ubah {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.bingkai {
		position: relative;
		margin-top: 16px;
	}

	svg {
		overflow: visible;
		color: var(--color-muted);
	}

	svg[data-arah='naik'] {
		color: var(--color-naik);
	}

	svg[data-arah='turun'] {
		color: var(--color-turun);
	}

	.bantu {
		stroke: var(--edge-soft);
	}

	.acuan {
		stroke: var(--edge-strong);
		stroke-dasharray: 3 4;
	}

	.sumbu {
		fill: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10.5px;
	}

	.jejak {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1;
		animation: gambar 1.3s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.area {
		animation: muncul 0.9s ease both 0.35s;
	}

	.silang {
		stroke: var(--edge-strong);
		stroke-dasharray: 2 3;
	}

	.titik {
		fill: currentColor;
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.titik.akhir {
		animation: muncul 0.4s ease both 1.1s;
	}

	.tag {
		fill: currentColor;
	}

	.tag-teks {
		fill: var(--color-base);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
	}

	.penjelajah {
		position: absolute;
		top: 0;
		left: 0;
		cursor: crosshair;
		touch-action: pan-y;
		border-radius: 8px;
	}

	.tooltip {
		position: absolute;
		top: 0;
		width: 148px;
		pointer-events: none;
		border: 1px solid var(--edge-strong);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 7px 10px;
		box-shadow: 0 14px 30px -18px var(--bayang);
	}

	.kosong {
		display: grid;
		height: 100%;
		place-content: center;
		justify-items: center;
		gap: 10px;
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 16px;
		text-align: center;
	}

	.ulang {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--color-diamond-300);
	}

	.statistik {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		margin-top: 14px;
		border-top: 1px solid var(--edge-soft);
		padding-top: 14px;
	}

	@media (min-width: 640px) {
		.statistik {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.statistik dt {
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.statistik dd {
		margin-top: 2px;
		font-family: var(--font-mono);
		font-size: 13.5px;
		font-variant-numeric: tabular-nums;
		color: var(--color-ink);
	}

	.kerangka {
		display: block;
		border-radius: 8px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--kilau) 6%, transparent),
			color-mix(in srgb, var(--kilau) 14%, transparent),
			color-mix(in srgb, var(--kilau) 6%, transparent)
		);
		background-size: 200% 100%;
		animation: kilap 1.4s ease-in-out infinite;
	}

	@keyframes gambar {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes muncul {
		from {
			opacity: 0;
		}
	}

	@keyframes kilap {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
</style>
