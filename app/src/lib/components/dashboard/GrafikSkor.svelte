<script lang="ts">
	import { onMount } from 'svelte';
	import type { TitikSkor } from '$lib/dashboard';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let {
		riwayat,
		ambang = null,
		ticker
	}: { riwayat: TitikSkor[]; ambang?: number | null; ticker: string } = $props();

	const id = $props.id();
	const TINGGI = 172;
	const ATAS = 14;
	const BAWAH = 24;
	const KIRI = 2;
	const KANAN = 30;
	const HARI = 86_400_000;
	const GARIS = [30, 60, 85];
	const TIER = ['low', 'moderate', 'high', 'critical'];

	let lebar = $state(320);
	let sorot = $state<number | null>(null);
	let siap = $state(false);
	const akhir = Date.now();

	onMount(() => (siap = true));

	const waktu = $derived(riwayat.map((titik) => new Date(titik.waktu).getTime()));
	const rentang = $derived(Math.max(akhir - (waktu[0] ?? akhir), HARI / 4));
	const awal = $derived(akhir - rentang * 1.06);
	const lebarPlot = $derived(Math.max(10, lebar - KIRI - KANAN));
	const dasar = TINGGI - BAWAH;

	const x = (t: number) => KIRI + ((t - awal) / Math.max(1, akhir - awal)) * lebarPlot;
	const y = (skor: number) => ATAS + (1 - skor / 100) * (dasar - ATAS);

	const segmen = $derived(
		riwayat.map((titik, i) => ({
			...titik,
			x0: x(waktu[i]),
			x1: i + 1 < riwayat.length ? x(waktu[i + 1]) : KIRI + lebarPlot,
			yLalu: i > 0 ? y(riwayat[i - 1].skor) : null,
			warna: tierDariSkor(titik.skor).color,
			tier: tierDariSkor(titik.skor).tier
		}))
	);

	const terakhir = $derived(segmen.at(-1));
	const tersentuh = $derived(ambang !== null && terakhir !== undefined && terakhir.skor >= ambang);

	const tgl = (t: number) =>
		new Date(t).toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
			timeZone: 'Asia/Jakarta'
		});
	const jam = (t: number) =>
		new Date(t).toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		});
	const tglLengkap = (iso: string) =>
		new Date(iso).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		});

	const labelSumbu = $derived.by(() => {
		const label = rentang < 2 * HARI ? jam : tgl;
		return [
			{ x: KIRI, teks: label(awal), jangkar: 'start' },
			{ x: KIRI + lebarPlot / 2, teks: label((awal + akhir) / 2), jangkar: 'middle' },
			{ x: KIRI + lebarPlot, teks: rentang < 2 * HARI ? 'Sekarang' : 'Hari ini', jangkar: 'end' }
		];
	});

	const teksNilai = (i: number) => {
		const titik = riwayat[i];
		return `${tglLengkap(titik.waktu)}, Red Flag Score ${bulatkanSkor(titik.skor)}, ${tierDariSkor(titik.skor).label}`;
	};

	const infoSorot = $derived.by(() => {
		if (sorot === null || !segmen[sorot]) return null;
		const satu = segmen[sorot];
		return { ...satu, kiri: satu.x0 + 196 > lebar ? Math.max(0, satu.x0 - 190) : satu.x0 + 10 };
	});

	function sorotDari(event: PointerEvent) {
		const kotak = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const posisi = event.clientX - kotak.left;
		sorot = Math.max(
			0,
			segmen.findLastIndex((satu) => satu.x0 <= posisi)
		);
	}

	function tombol(event: KeyboardEvent) {
		const akhirIndeks = riwayat.length - 1;
		const kini = sorot ?? akhirIndeks;
		const geser: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1
		};
		if (event.key === 'Home') sorot = 0;
		else if (event.key === 'End') sorot = akhirIndeks;
		else if (event.key in geser)
			sorot = Math.max(0, Math.min(akhirIndeks, kini + geser[event.key]));
		else return;
		event.preventDefault();
	}
</script>

{#if riwayat.length === 0}
	<p
		class="text-muted rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[13px]"
	>
		Belum ada Red Flag Score untuk {ticker}. Skor muncul setelah pemindaian pertama selesai.
	</p>
{:else}
	<div class="relative" bind:clientWidth={lebar} style="height:{TINGGI}px">
		<svg
			width={lebar}
			height={TINGGI}
			class="plot absolute inset-0 overflow-visible"
			class:siap
			aria-hidden="true"
		>
			<defs>
				<clipPath id="tirai-{id}">
					<rect x="0" y="0" width={lebar} height={TINGGI} class="tirai" />
				</clipPath>
				{#each TIER as tier (tier)}
					<linearGradient id="isi-{id}-{tier}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" style="stop-color: var(--color-tier-{tier})" stop-opacity="0.2" />
						<stop offset="1" style="stop-color: var(--color-tier-{tier})" stop-opacity="0" />
					</linearGradient>
				{/each}
			</defs>

			{#each GARIS as nilai (nilai)}
				<line x1={KIRI} x2={KIRI + lebarPlot} y1={y(nilai)} y2={y(nilai)} class="grid-garis" />
				<text x={KIRI + lebarPlot + 7} y={y(nilai) + 3.5} class="label-sumbu">{nilai}</text>
			{/each}
			<line x1={KIRI} x2={KIRI + lebarPlot} y1={dasar} y2={dasar} class="grid-garis dasar" />
			<text x={KIRI + lebarPlot + 7} y={dasar + 3.5} class="label-sumbu">0</text>

			<g clip-path="url(#tirai-{id})">
				{#each segmen as satu (satu.id)}
					<rect
						x={satu.x0}
						y={y(satu.skor)}
						width={Math.max(0, satu.x1 - satu.x0)}
						height={dasar - y(satu.skor)}
						fill="url(#isi-{id}-{satu.tier})"
					/>
					{#if satu.yLalu !== null}
						<line
							x1={satu.x0}
							x2={satu.x0}
							y1={satu.yLalu}
							y2={y(satu.skor)}
							stroke={satu.warna}
							class="garis-skor"
						/>
					{/if}
					<line
						x1={satu.x0}
						x2={satu.x1}
						y1={y(satu.skor)}
						y2={y(satu.skor)}
						stroke={satu.warna}
						class="garis-skor"
					/>
				{/each}
			</g>

			{#if ambang !== null}
				<g class="kawat" class:putus={tersentuh}>
					<line x1={KIRI} x2={KIRI + lebarPlot} y1={y(ambang)} y2={y(ambang)} />
					<text x={KIRI + 4} y={y(ambang) - 5} class="label-kawat">Batas notifikasi {ambang}</text>
				</g>
			{/if}

			{#if terakhir}
				<circle
					cx={KIRI + lebarPlot}
					cy={y(terakhir.skor)}
					r="4.5"
					fill={terakhir.warna}
					class="ujung"
				/>
			{/if}

			{#each labelSumbu as label (label.jangkar)}
				<text x={label.x} y={TINGGI - 6} text-anchor={label.jangkar} class="label-sumbu"
					>{label.teks}</text
				>
			{/each}

			{#if infoSorot}
				<line x1={infoSorot.x0} x2={infoSorot.x0} y1={ATAS - 6} y2={dasar} class="silang" />
				<circle
					cx={infoSorot.x0}
					cy={y(infoSorot.skor)}
					r="4.5"
					fill={infoSorot.warna}
					class="ujung"
				/>
			{/if}
		</svg>

		{#if infoSorot}
			<div class="tooltip" style="left:{infoSorot.kiri}px">
				<p class="text-muted text-[11px]">{tglLengkap(infoSorot.waktu)}</p>
				<p class="mt-1 flex items-center gap-2">
					<span class="h-0.5 w-3 rounded-full" style="background:{infoSorot.warna}"></span>
					<span class="tw-data text-ink text-[15px] font-medium"
						>{bulatkanSkor(infoSorot.skor)}</span
					>
					<span class="text-secondary text-[12px]">{tierDariSkor(infoSorot.skor).label}</span>
				</p>
			</div>
		{/if}

		<div
			class="absolute inset-x-0 top-0 cursor-crosshair"
			style="height:{dasar}px; touch-action: pan-y"
			role="slider"
			tabindex="0"
			aria-label="Telusuri riwayat Red Flag Score {ticker}"
			aria-valuemin={0}
			aria-valuemax={riwayat.length - 1}
			aria-valuenow={sorot ?? riwayat.length - 1}
			aria-valuetext={teksNilai(sorot ?? riwayat.length - 1)}
			onpointermove={sorotDari}
			onpointerdown={sorotDari}
			onpointerleave={(event) => event.pointerType === 'mouse' && (sorot = null)}
			onkeydown={tombol}
			onblur={() => (sorot = null)}
		></div>
	</div>

	<table class="sr-only">
		<caption>Riwayat Red Flag Score {ticker}</caption>
		<thead>
			<tr><th>Waktu</th><th>Skor</th></tr>
		</thead>
		<tbody>
			{#each riwayat as titik (titik.id)}
				<tr>
					<td>{tglLengkap(titik.waktu)}</td>
					<td>{bulatkanSkor(titik.skor)}, {tierDariSkor(titik.skor).label}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.plot {
		opacity: 0;
	}

	.plot.siap {
		opacity: 1;
	}

	.plot.siap .tirai {
		transform-box: fill-box;
		transform-origin: left;
		animation: tirai 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	@keyframes tirai {
		from {
			transform: scaleX(0);
		}
	}

	.grid-garis {
		stroke: rgba(180, 205, 255, 0.07);
	}

	.grid-garis.dasar {
		stroke: rgba(180, 205, 255, 0.16);
	}

	.label-sumbu,
	.label-kawat {
		font-family: var(--font-mono);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		fill: var(--color-muted);
	}

	.garis-skor {
		stroke-width: 2;
		stroke-linecap: round;
	}

	.kawat line {
		stroke: var(--color-secondary);
		stroke-width: 1.25;
		stroke-opacity: 0.55;
	}

	.label-kawat {
		fill: var(--color-secondary);
		font-family: var(--font-sans);
		font-size: 10.5px;
	}

	.kawat.putus line {
		stroke: var(--color-tier-critical);
		stroke-opacity: 1;
		filter: drop-shadow(0 0 5px var(--color-tier-critical));
	}

	.kawat.putus .label-kawat {
		fill: var(--color-tier-critical);
	}

	.ujung {
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.silang {
		stroke: rgba(214, 236, 255, 0.35);
		stroke-width: 1;
	}

	.tooltip {
		position: absolute;
		top: 4px;
		z-index: 5;
		width: 180px;
		border: 1px solid rgba(180, 205, 255, 0.18);
		border-radius: 10px;
		background: rgba(13, 18, 32, 0.96);
		padding: 9px 11px;
		box-shadow: 0 18px 40px -20px #000;
		pointer-events: none;
	}
</style>
