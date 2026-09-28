<script lang="ts">
	import { Ban, ChartPie, UserMinus, UserPlus } from 'lucide-svelte';
	import { tierDariSkor } from '$lib/skor';
	import {
		formatHarga,
		formatUbah,
		tanggalPendek,
		tanggalWib,
		type Harian,
		type JenisPeristiwa,
		type Peristiwa
	} from '$lib/watchlist';
	import { formatRingkas } from '$lib/insight';

	let {
		kode,
		seri,
		riwayat,
		batas,
		peristiwa
	}: {
		kode: string;
		seri: Harian[];
		riwayat: { score: number; at: string }[];
		batas: number;
		peristiwa: Peristiwa[];
	} = $props();

	const PAD_KIRI = 8;
	const PAD_KANAN = 58;
	const JALUR = 30;
	const TINGGI_SKOR = 64;
	const SUMBU = 22;
	const RENTANG = [
		{ kunci: '1B', label: '1 bulan', jumlah: 22 },
		{ kunci: '3B', label: '3 bulan', jumlah: 999 }
	];
	const URUTAN_JENIS: JenisPeristiwa[] = ['suspensi', 'jual', 'kepemilikan', 'beli'];
	const IKON = { jual: UserMinus, beli: UserPlus, kepemilikan: ChartPie, suspensi: Ban };

	let lebar = $state(640);
	let rentang = $state('3B');
	let sorot = $state<number | null>(null);

	const tampil = $derived(seri.slice(-(RENTANG.find((r) => r.kunci === rentang)?.jumlah ?? 999)));
	const n = $derived(tampil.length);
	const akhir = $derived(n - 1);

	const bawahAtas = $derived.by(() => {
		const rendah = Math.min(...tampil.map((b) => b.low ?? b.close));
		const tinggi = Math.max(...tampil.map((b) => b.high ?? b.close));
		const ruang = Math.max((tinggi - rendah) * 0.12, tinggi * 0.01);
		return { bawah: rendah - ruang, atas: tinggi + ruang };
	});
	const volumeMaks = $derived(Math.max(1, ...tampil.map((b) => b.volume ?? 0)));

	const tinggiHarga = $derived(lebar < 520 ? 176 : 224);
	const atasSkor = $derived(tinggiHarga + JALUR);
	const tinggiTotal = $derived(atasSkor + TINGGI_SKOR + SUMBU);
	const lebarPlot = $derived(Math.max(10, lebar - PAD_KIRI - PAD_KANAN));
	const slot = $derived(lebarPlot / Math.max(1, n));
	const badan = $derived(Math.max(2.5, Math.min(11, slot * 0.64)));

	const xBar = (i: number) => PAD_KIRI + slot * (i + 0.5);
	const xTepi = (i: number) => PAD_KIRI + slot * i;
	const yHarga = (nilai: number) =>
		8 + ((bawahAtas.atas - nilai) / (bawahAtas.atas - bawahAtas.bawah || 1)) * (tinggiHarga - 16);
	const ySkor = (nilai: number) => atasSkor + 6 + (1 - nilai / 100) * (TINGGI_SKOR - 12);
	const tinggiVolume = (volume: number | null) => ((volume ?? 0) / volumeMaks) * tinggiHarga * 0.18;

	const garisHarga = $derived.by(() => {
		const { bawah, atas } = bawahAtas;
		const kasar = (atas - bawah) / 4;
		const langkah =
			[1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].find(
				(nilai) => nilai >= kasar
			) ?? 20000;
		const hasil: number[] = [];
		for (let nilai = Math.ceil(bawah / langkah) * langkah; nilai < atas; nilai += langkah)
			hasil.push(nilai);
		return hasil;
	});

	const titikSkor = $derived(
		riwayat.map((titik) => ({ tanggal: tanggalWib(titik.at), skor: titik.score }))
	);

	const skorBar = $derived(
		tampil.map((bar, i) => {
			const sampai = i === akhir ? '9999-12-31' : bar.date;
			return titikSkor.findLast((titik) => titik.tanggal <= sampai)?.skor ?? null;
		})
	);
	const skorTerakhir = $derived(skorBar[akhir] ?? null);
	const tersentuh = $derived(skorTerakhir !== null && skorTerakhir >= batas);

	const peristiwaBar = $derived.by(() => {
		const kelompok = new Map<number, Peristiwa[]>();
		if (n === 0) return kelompok;
		for (const satu of peristiwa) {
			if (satu.tanggal < tampil[0].date) continue;
			let i = tampil.findIndex((bar) => bar.date >= satu.tanggal);
			if (i < 0) i = akhir;
			kelompok.set(i, [...(kelompok.get(i) ?? []), satu]);
		}
		return kelompok;
	});

	const penanda = $derived.by(() => {
		const gugus: { i: number; daftar: Peristiwa[] }[] = [];
		for (const [i, daftar] of [...peristiwaBar].sort((a, b) => a[0] - b[0])) {
			const lalu = gugus.at(-1);
			if (lalu && xBar(i) - xBar(lalu.i) < 24) lalu.daftar = [...lalu.daftar, ...daftar];
			else gugus.push({ i, daftar });
		}
		return gugus.map(({ i, daftar }) => {
			const utama = URUTAN_JENIS.find((jenis) => daftar.some((d) => d.jenis === jenis)) ?? 'beli';
			return { i, daftar, jenis: utama, Ikon: IKON[utama] };
		});
	});

	const yTag = $derived(
		n === 0
			? -99
			: yHarga(sorot !== null && tampil[sorot] ? tampil[sorot].close : tampil[akhir].close)
	);

	const tersembunyi = $derived(
		n ? peristiwa.filter((satu) => satu.tanggal < tampil[0].date).length : 0
	);

	const labelSumbu = $derived(
		n < 2 ? [] : [...new Set([0, 0.25, 0.5, 0.75, 1].map((posisi) => Math.round(posisi * akhir)))]
	);

	const info = $derived.by(() => {
		if (sorot === null || !tampil[sorot]) return null;
		const bar = tampil[sorot];
		const kemarin = sorot > 0 ? tampil[sorot - 1] : (seri[seri.length - n - 1] ?? null);
		const x = xBar(sorot);
		return {
			bar,
			tanggal: new Date(`${bar.date}T00:00:00Z`).toLocaleDateString('id-ID', {
				weekday: 'short',
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				timeZone: 'UTC'
			}),
			ubah: kemarin ? formatUbah((bar.close - kemarin.close) / kemarin.close) : null,
			skor: skorBar[sorot],
			peristiwa: peristiwaBar.get(sorot) ?? [],
			kiri: x + 226 > lebar ? Math.max(4, x - 226) : x + 14
		};
	});

	const teksNilai = $derived.by(() => {
		const i = sorot ?? akhir;
		const bar = tampil[i];
		if (!bar) return '';
		const skor = skorBar[i];
		return `${tanggalPendek(bar.date)}, harga tutup ${formatHarga(bar.close)}${
			skor === null ? '' : `, Red Flag Score ${Math.round(skor)}`
		}`;
	});

	const segmenSkor = $derived.by(() => {
		const hasil: { x0: number; x1: number; skor: number; yLalu: number | null }[] = [];
		skorBar.forEach((skor, i) => {
			if (skor === null) return;
			const lalu = hasil.at(-1);
			if (lalu && lalu.skor === skor && Math.abs(lalu.x1 - xTepi(i)) < 0.5) {
				lalu.x1 = xTepi(i + 1);
				return;
			}
			const sambung = lalu && Math.abs(lalu.x1 - xTepi(i)) < 0.5 ? ySkor(lalu.skor) : null;
			hasil.push({ x0: xTepi(i), x1: xTepi(i + 1), skor, yLalu: sambung });
		});
		return hasil;
	});

	function sorotDari(event: PointerEvent) {
		const kotak = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const i = Math.round((event.clientX - kotak.left - PAD_KIRI) / slot - 0.5);
		sorot = Math.max(0, Math.min(akhir, i));
	}

	function tombol(event: KeyboardEvent) {
		const geser: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1
		};
		const awal = sorot ?? akhir;
		if (event.key === 'Home') sorot = 0;
		else if (event.key === 'End') sorot = akhir;
		else if (event.key in geser) sorot = Math.max(0, Math.min(akhir, awal + geser[event.key]));
		else return;
		event.preventDefault();
	}

	function lepas(event: PointerEvent) {
		if (event.pointerType === 'mouse') sorot = null;
	}
</script>

<figure data-testid="grafik-emiten" aria-labelledby="judul-grafik-{kode}" class="space-y-3">
	<figcaption id="judul-grafik-{kode}" class="flex flex-wrap items-center justify-between gap-2">
		<span class="tw-overline">Harga harian dan Red Flag Score</span>
		<span
			class="bg-void/60 border-line inline-flex rounded-lg border p-0.5"
			role="group"
			aria-label="Rentang grafik"
		>
			{#each RENTANG as pilihan (pilihan.kunci)}
				<button
					type="button"
					aria-pressed={rentang === pilihan.kunci}
					aria-label="Tampilkan {pilihan.label}"
					onclick={() => {
						rentang = pilihan.kunci;
						sorot = null;
					}}
					class="tw-data rounded-md px-2.5 py-1 text-[11.5px] font-medium transition {rentang ===
					pilihan.kunci
						? 'bg-diamond-500/15 text-diamond-100'
						: 'text-muted hover:text-ink'}"
				>
					{pilihan.kunci}
				</button>
			{/each}
		</span>
	</figcaption>

	<div class="relative" bind:clientWidth={lebar} style="height:{tinggiTotal}px">
		<svg width={lebar} height={tinggiTotal} class="block overflow-visible" aria-hidden="true">
			{#each garisHarga as nilai (nilai)}
				<line
					x1={PAD_KIRI}
					x2={PAD_KIRI + lebarPlot}
					y1={yHarga(nilai)}
					y2={yHarga(nilai)}
					class="grid-garis"
				/>
				{#if Math.abs(yHarga(nilai) - yTag) > 16}
					<text x={PAD_KIRI + lebarPlot + 8} y={yHarga(nilai) + 3.5} class="label-sumbu"
						>{formatHarga(nilai)}</text
					>
				{/if}
			{/each}

			{#each tampil as bar, i (bar.date)}
				{@const buka = bar.open ?? bar.close}
				{@const naik = bar.close >= buka}
				<rect
					x={xBar(i) - badan / 2}
					y={tinggiHarga - tinggiVolume(bar.volume)}
					width={badan}
					height={tinggiVolume(bar.volume)}
					class="volume {naik ? 'fill-naik' : 'fill-turun'}"
				/>
				<g class="lilin" class:turun={!naik} style="--urut:{Math.min(i, 60)}">
					<line
						x1={xBar(i)}
						x2={xBar(i)}
						y1={yHarga(bar.high ?? Math.max(buka, bar.close))}
						y2={yHarga(bar.low ?? Math.min(buka, bar.close))}
					/>
					<rect
						x={xBar(i) - badan / 2}
						y={yHarga(Math.max(buka, bar.close))}
						width={badan}
						height={Math.max(1.5, Math.abs(yHarga(buka) - yHarga(bar.close)))}
						rx="1"
					/>
				</g>
			{/each}

			{#if n > 0 && sorot === null}
				{@const terakhir = tampil[akhir]}
				{@const naik = terakhir.close >= tampil[0].close}
				{@const y = yHarga(terakhir.close)}
				<line
					x1={PAD_KIRI}
					x2={PAD_KIRI + lebarPlot}
					y1={y}
					y2={y}
					class="garis-terakhir"
					class:turun={!naik}
				/>
				<rect
					x={PAD_KIRI + lebarPlot + 2}
					y={y - 9}
					width={PAD_KANAN - 4}
					height="18"
					rx="4"
					class={naik ? 'fill-naik' : 'fill-turun'}
				/>
				<text x={PAD_KIRI + lebarPlot + 7} y={y + 4} class="label-harga"
					>{formatHarga(terakhir.close)}</text
				>
			{/if}

			<line
				x1={PAD_KIRI}
				x2={PAD_KIRI + lebarPlot}
				y1={atasSkor}
				y2={atasSkor}
				class="grid-garis"
			/>
			<text
				x={PAD_KIRI + 4}
				y={batas >= 50 ? atasSkor + TINGGI_SKOR - 6 : atasSkor + 14}
				class="label-panel">Red Flag Score</text
			>

			{#each segmenSkor as segmen (segmen.x0)}
				{@const warna = tierDariSkor(segmen.skor).color}
				<rect
					x={segmen.x0}
					y={ySkor(segmen.skor)}
					width={Math.max(0, segmen.x1 - segmen.x0)}
					height={atasSkor + TINGGI_SKOR - ySkor(segmen.skor)}
					fill={warna}
					fill-opacity="0.1"
				/>
				{#if segmen.yLalu !== null}
					<line
						x1={segmen.x0}
						x2={segmen.x0}
						y1={segmen.yLalu}
						y2={ySkor(segmen.skor)}
						stroke={warna}
						class="garis-skor"
					/>
				{/if}
				<line
					x1={segmen.x0}
					x2={segmen.x1}
					y1={ySkor(segmen.skor)}
					y2={ySkor(segmen.skor)}
					stroke={warna}
					class="garis-skor"
				/>
			{/each}

			<g class="kawat" class:putus={tersentuh}>
				<line x1={PAD_KIRI} x2={PAD_KIRI + lebarPlot} y1={ySkor(batas)} y2={ySkor(batas)} />
			</g>
			<text
				x={PAD_KIRI + lebarPlot + 8}
				y={ySkor(batas) + 3.5}
				class="label-kawat"
				class:putus={tersentuh}>{batas}</text
			>

			{#if skorTerakhir !== null}
				<rect
					x={xBar(akhir) - 4.5}
					y={ySkor(skorTerakhir) - 4.5}
					width="9"
					height="9"
					rx="2"
					transform="rotate(45 {xBar(akhir)} {ySkor(skorTerakhir)})"
					class="titik-skor"
					style="fill:{tierDariSkor(skorTerakhir).color}"
				/>
			{:else}
				<text x={PAD_KIRI + lebarPlot / 2} y={ySkor(46)} text-anchor="middle" class="label-sumbu">
					Belum ada skor di rentang ini
				</text>
			{/if}

			{#each labelSumbu as i (i)}
				<text
					x={i === 0 ? PAD_KIRI : i === akhir ? PAD_KIRI + lebarPlot : xBar(i)}
					y={tinggiTotal - 6}
					text-anchor={i === 0 ? 'start' : i === akhir ? 'end' : 'middle'}
					class="label-sumbu">{tanggalPendek(tampil[i].date)}</text
				>
			{/each}

			{#if info}
				{@const x = xBar(sorot ?? 0)}
				<line x1={x} x2={x} y1="0" y2={atasSkor + TINGGI_SKOR} class="silang" />
				<line
					x1={PAD_KIRI}
					x2={PAD_KIRI + lebarPlot}
					y1={yHarga(info.bar.close)}
					y2={yHarga(info.bar.close)}
					class="silang"
				/>
				<rect
					x={PAD_KIRI + lebarPlot + 2}
					y={yHarga(info.bar.close) - 9}
					width={PAD_KANAN - 4}
					height="18"
					rx="4"
					class="tag-silang"
				/>
				<text x={PAD_KIRI + lebarPlot + 7} y={yHarga(info.bar.close) + 4} class="label-harga terang"
					>{formatHarga(info.bar.close)}</text
				>
				{#if info.skor !== null}
					<circle cx={x} cy={ySkor(info.skor)} r="4" class="titik-sorot" />
				{/if}
			{/if}
		</svg>

		{#each penanda as item (item.i)}
			<span
				class="lencana {item.jenis}"
				style="left:{xBar(item.i)}px; top:{tinggiHarga + JALUR / 2}px"
				data-testid="penanda-peristiwa"
			>
				<item.Ikon class="size-3" aria-hidden="true" />
				{#if item.daftar.length > 1}
					<span class="jumlah tw-data">{item.daftar.length}</span>
				{/if}
			</span>
		{/each}

		{#if info}
			<div class="tooltip" style="left:{info.kiri}px">
				<p class="text-muted text-[11.5px]">{info.tanggal}</p>
				<p class="mt-1 flex items-baseline gap-2">
					<span class="tw-data text-ink text-[15px] font-medium">{formatHarga(info.bar.close)}</span
					>
					<span class="text-muted text-[11.5px]">tutup</span>
					{#if info.ubah}
						<span
							class="tw-data ml-auto text-[12px] {info.ubah.arah >= 0 ? 'text-naik' : 'text-turun'}"
							>{info.ubah.teks}</span
						>
					{/if}
				</p>
				<dl class="tw-data text-secondary mt-1.5 grid grid-cols-3 gap-x-2 text-[11px]">
					<div>
						<dt class="text-muted">Buka</dt>
						<dd>{formatHarga(info.bar.open)}</dd>
					</div>
					<div>
						<dt class="text-muted">Tinggi</dt>
						<dd>{formatHarga(info.bar.high)}</dd>
					</div>
					<div>
						<dt class="text-muted">Rendah</dt>
						<dd>{formatHarga(info.bar.low)}</dd>
					</div>
				</dl>
				{#if info.bar.volume}
					<p class="text-muted mt-1 text-[11px]">
						Volume <span class="tw-data text-secondary"
							>{formatRingkas(info.bar.volume)} lembar</span
						>
					</p>
				{/if}
				{#if info.skor !== null}
					<p class="mt-1.5 flex items-center gap-2">
						<span class="h-0.5 w-3 rounded-full" style="background:{tierDariSkor(info.skor).color}"
						></span>
						<span class="tw-data text-ink text-[13px] font-medium">{Math.round(info.skor)}</span>
						<span class="text-muted text-[11.5px]"
							>Red Flag Score, {tierDariSkor(info.skor).label}</span
						>
					</p>
				{/if}
				{#if info.peristiwa.length}
					<ul
						class="border-line text-secondary mt-2 space-y-1 border-t pt-2 text-[11.5px] leading-snug"
					>
						{#each info.peristiwa.slice(0, 3) as satu, urutan (urutan)}
							<li>{satu.teks}</li>
						{/each}
						{#if info.peristiwa.length > 3}
							<li class="text-muted">dan {info.peristiwa.length - 3} peristiwa lain</li>
						{/if}
					</ul>
				{/if}
			</div>
		{/if}

		<div
			class="absolute inset-x-0 top-0 cursor-crosshair"
			style="height:{atasSkor + TINGGI_SKOR}px; touch-action: pan-y"
			role="slider"
			tabindex="0"
			aria-label="Telusuri grafik {kode} per hari bursa"
			aria-valuemin={0}
			aria-valuemax={akhir}
			aria-valuenow={sorot ?? akhir}
			aria-valuetext={teksNilai}
			onpointermove={sorotDari}
			onpointerdown={sorotDari}
			onpointerleave={lepas}
			onkeydown={tombol}
			onblur={() => (sorot = null)}
		></div>
	</div>

	<ul class="text-muted flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
		<li class="flex items-center gap-1.5">
			<span class="contoh-naik"></span>Naik, candle berongga
		</li>
		<li class="flex items-center gap-1.5"><span class="contoh-turun"></span>Turun, candle padat</li>
		<li class="flex items-center gap-1.5">
			<span class="contoh-kawat" class:putus={tersentuh}></span>Batas notifikasi {batas}
		</li>
		{#if tersembunyi}
			<li>{tersembunyi} peristiwa lebih lama di luar rentang</li>
		{/if}
	</ul>
</figure>

<style>
	.grid-garis {
		stroke: rgba(180, 205, 255, 0.07);
	}

	.label-sumbu,
	.label-panel,
	.label-harga,
	.label-kawat {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}

	.label-sumbu {
		fill: var(--color-muted);
		font-size: 10px;
	}

	.label-sumbu,
	.label-panel {
		paint-order: stroke;
		stroke: var(--color-base);
		stroke-width: 3px;
		stroke-linejoin: round;
	}

	.label-panel {
		fill: var(--color-secondary);
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
	}

	.label-harga {
		fill: #04101f;
		font-weight: 600;
	}

	.label-harga.terang {
		fill: var(--color-ink);
	}

	.tag-silang {
		fill: var(--color-raised);
		stroke: rgba(180, 205, 255, 0.3);
	}

	.lilin {
		transform-box: fill-box;
		transform-origin: center;
		animation: tumbuh 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--urut, 0) * 9ms);
	}

	.lilin line {
		stroke: var(--color-naik);
		stroke-width: 1;
	}

	.lilin rect {
		fill: color-mix(in srgb, var(--color-naik) 22%, var(--color-base));
		stroke: var(--color-naik);
		stroke-width: 1;
	}

	.lilin.turun line {
		stroke: var(--color-turun);
	}

	.lilin.turun rect {
		fill: var(--color-turun);
		stroke: var(--color-turun);
	}

	.volume {
		opacity: 0.18;
	}

	@keyframes tumbuh {
		from {
			opacity: 0;
			transform: scaleY(0.2);
		}
	}

	.garis-terakhir {
		stroke: var(--color-naik);
		stroke-opacity: 0.55;
		stroke-dasharray: 1 3;
	}

	.garis-terakhir.turun {
		stroke: var(--color-turun);
	}

	.garis-skor {
		stroke-width: 2;
		stroke-linecap: round;
	}

	.kawat line {
		stroke: var(--color-secondary);
		stroke-width: 1.25;
		stroke-opacity: 0.6;
		stroke-dasharray: 4 3;
	}

	.kawat.putus line {
		stroke: var(--color-tier-critical);
		stroke-opacity: 1;
		stroke-dasharray: none;
		filter: drop-shadow(0 0 5px var(--color-tier-critical));
	}

	.kawat.putus {
		animation: getar 0.7s ease-out 0.6s;
	}

	@keyframes getar {
		15% {
			transform: translateY(-3px);
		}
		30% {
			transform: translateY(3px);
		}
		45% {
			transform: translateY(-2px);
		}
		60% {
			transform: translateY(1.5px);
		}
		80% {
			transform: translateY(-0.5px);
		}
	}

	.label-kawat {
		fill: var(--color-secondary);
		font-weight: 600;
	}

	.label-kawat.putus {
		fill: var(--color-tier-critical);
	}

	.titik-skor {
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.silang {
		stroke: rgba(214, 236, 255, 0.35);
		stroke-width: 1;
	}

	.titik-sorot {
		fill: var(--color-ink);
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.lencana {
		position: absolute;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		margin: -11px 0 0 -11px;
		border-radius: 999px;
		border: 1px solid rgba(180, 205, 255, 0.22);
		background: var(--color-raised);
		color: var(--color-secondary);
		pointer-events: none;
		animation: letup 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) 0.5s backwards;
	}

	.jumlah {
		position: absolute;
		top: -7px;
		right: -8px;
		min-width: 15px;
		border-radius: 999px;
		background: var(--color-line);
		padding: 0 3px;
		font-size: 9.5px;
		line-height: 14px;
		color: var(--color-ink);
		text-align: center;
	}

	@keyframes letup {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
	}

	.tooltip {
		position: absolute;
		top: 8px;
		z-index: 5;
		width: 212px;
		border: 1px solid rgba(180, 205, 255, 0.18);
		border-radius: 10px;
		background: rgba(13, 18, 32, 0.96);
		padding: 10px 12px;
		box-shadow: 0 18px 40px -20px #000;
		pointer-events: none;
	}

	.contoh-naik,
	.contoh-turun {
		display: inline-block;
		width: 7px;
		height: 11px;
		border-radius: 1.5px;
		border: 1px solid var(--color-naik);
		background: color-mix(in srgb, var(--color-naik) 22%, var(--color-base));
	}

	.contoh-turun {
		border-color: var(--color-turun);
		background: var(--color-turun);
	}

	.contoh-kawat {
		display: inline-block;
		width: 14px;
		border-top: 1.5px dashed var(--color-secondary);
	}

	.contoh-kawat.putus {
		border-top: 1.5px solid var(--color-tier-critical);
	}
</style>
