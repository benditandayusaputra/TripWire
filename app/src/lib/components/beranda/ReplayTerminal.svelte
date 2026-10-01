<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { fade, fly, scale } from 'svelte/transition';
	import { Ban, BellRing, ChartPie, RotateCcw, UserMinus } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import { lokal, t } from '$lib/bahasa.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import { tierDariSkor } from '$lib/skor';
	import { gerakDikurangi, saatTerlihat } from '$lib/terlihat';
	import {
		BATAS,
		HARI_ANJLOK,
		HARI_NOTIFIKASI,
		JUMLAH_HARI,
		SUSPENSI,
		TICKER,
		kejadian,
		kejadianPada,
		langkahSkor,
		lilin,
		skorPada,
		tanggal,
		type JenisKejadian,
		type Lilin
	} from './simulasi';

	const DURASI = { menuju: 4400, jeda: 1800, sisa: 2400 };
	const PAD_KIRI = 10;
	const PAD_KANAN = 52;
	const JALUR = 32;
	const TINGGI_SKOR = 92;
	const SUMBU = 24;
	const AKHIR = JUMLAH_HARI - 1;
	const TUTUP_AWAL = (lilin[0] as Lilin).tutup;
	const VOLUME_MAKS = Math.max(...lilin.map((item) => item?.volume ?? 0));

	const ikon: Record<JenisKejadian, typeof Ban | null> = {
		awal: null,
		'orang-dalam': UserMinus,
		kepemilikan: ChartPie,
		notifikasi: BellRing,
		anjlok: null,
		suspensi: Ban,
		buka: null
	};

	const penanda = kejadian.flatMap((item) => {
		const Ikon = ikon[item.jenis];
		if (!Ikon) return [];
		const posisi = item.jenis === 'suspensi' ? (SUSPENSI.mulai + SUSPENSI.selesai) / 2 : item.hari;
		return [{ ...item, Ikon, posisi }];
	});

	const angka = $derived(new Intl.NumberFormat(lokal()));
	const persen = $derived(
		new Intl.NumberFormat(lokal(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
	);
	const tglPendek = (i: number) =>
		tanggal[i].toLocaleDateString(lokal(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
	const tglPanjang = (i: number) =>
		tanggal[i].toLocaleDateString(lokal(), {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});

	let wadah: HTMLElement;
	let lebar = $state(620);
	let hari = $state(AKHIR);
	let bermain = $state(false);
	let siap = $state(false);
	let notifTampil = $state(false);
	let sorot = $state<number | null>(null);
	let bingkai = 0;
	let jedaNotif: ReturnType<typeof setTimeout> | undefined;

	function domainSampai(batas: number) {
		const ada = lilin.slice(0, batas + 1).filter((item): item is Lilin => item !== null);
		const bawah = Math.min(...ada.map((item) => item.rendah));
		const atas = Math.max(...ada.map((item) => item.tinggi));
		const ruang = Math.max((atas - bawah) * 0.14, 24);
		return { bawah: bawah - ruang, atas: atas + ruang };
	}

	const indeks = $derived(Math.floor(hari));
	const skala = Tween.of(() => domainSampai(indeks), { duration: 650, easing: cubicOut });

	const tinggiHarga = $derived(lebar < 520 ? 156 : 204);
	const atasSkor = $derived(tinggiHarga + JALUR);
	const tinggiTotal = $derived(atasSkor + TINGGI_SKOR + SUMBU);
	const lebarPlot = $derived(lebar - PAD_KIRI - PAD_KANAN);
	const slot = $derived(lebarPlot / JUMLAH_HARI);
	const lebarBadan = $derived(Math.max(2.5, Math.min(9, slot * 0.62)));
	const tersentuh = $derived(hari >= HARI_NOTIFIKASI);

	const xHari = (i: number) => PAD_KIRI + slot * (i + 0.5);
	const xTepi = (i: number) => PAD_KIRI + slot * i;
	const yHarga = (nilai: number) =>
		8 +
		((skala.current.atas - nilai) / (skala.current.atas - skala.current.bawah)) *
			(tinggiHarga - 16);
	const ySkor = (nilai: number) => atasSkor + 8 + (1 - nilai / 100) * (TINGGI_SKOR - 16);
	const tinggiVolume = (volume: number) => (volume / VOLUME_MAKS) * tinggiHarga * 0.24;
	const xUjung = $derived(Math.min(PAD_KIRI + lebarPlot, xTepi(hari + 1)));

	const garisHarga = $derived.by(() => {
		const { bawah, atas } = skala.current;
		const kasar = (atas - bawah) / 4;
		const langkah = [10, 20, 25, 50, 100, 200, 250].find((nilai) => nilai >= kasar) ?? 500;
		const hasil: number[] = [];
		for (let nilai = Math.ceil(bawah / langkah) * langkah; nilai < atas; nilai += langkah)
			hasil.push(nilai);
		return hasil;
	});

	const segmenSkor = $derived(
		langkahSkor
			.filter(([mulai]) => mulai <= hari)
			.map(([mulai, nilai], urutan, semua) => {
				const berikut = semua[urutan + 1]?.[0];
				return {
					nilai,
					warna: tierDariSkor(nilai).color,
					x0: urutan === 0 ? PAD_KIRI : xHari(mulai),
					x1: berikut === undefined ? xUjung : xHari(berikut),
					yLalu: urutan === 0 ? null : ySkor(semua[urutan - 1][1])
				};
			})
	);

	const hariTampil = $derived(sorot ?? indeks);
	const lilinTampil = $derived(
		lilin.slice(0, hariTampil + 1).findLast((item) => item !== null) ?? null
	);
	const harga = $derived(lilinTampil?.tutup ?? TUTUP_AWAL);
	const selisih = $derived(((harga - TUTUP_AWAL) / TUTUP_AWAL) * 100);
	const skorTampil = $derived(skorPada(hariTampil));
	const tersuspensi = $derived(lilin[hariTampil] === null);
	const kabar = $derived(kejadianPada(indeks));
	const lilinTerakhir = $derived(
		lilin.slice(0, indeks + 1).findLast((item) => item !== null) ?? null
	);

	const infoSorot = $derived.by(() => {
		if (sorot === null) return null;
		const item = lilin[sorot];
		const kemarin = lilin.slice(0, sorot).findLast((l) => l !== null);
		const x = xHari(sorot);
		return {
			tanggal: tglPanjang(sorot),
			item,
			ubah: item && kemarin ? ((item.tutup - kemarin.tutup) / kemarin.tutup) * 100 : null,
			skor: skorPada(sorot),
			kejadian: kejadian.find((k) => k.hari === sorot && k.jenis !== 'awal') ?? null,
			kiri: x + 214 > lebar ? Math.max(4, x - 214) : x + 14
		};
	});

	const teksNilai = $derived.by(() => {
		const i = sorot ?? indeks;
		const item = lilin[i];
		const hargaTeks = item
			? t(`harga tutup ${angka.format(item.tutup)}`, `closing price ${angka.format(item.tutup)}`)
			: t('perdagangan dihentikan', 'trading suspended');
		return `${tglPanjang(i)}, ${hargaTeks}, Red Flag Score ${skorPada(i)}`;
	});

	function hariPada(ms: number) {
		const { menuju, jeda, sisa } = DURASI;
		if (ms <= 0) return 0;
		if (ms < menuju) return (ms / menuju) * HARI_NOTIFIKASI;
		if (ms < menuju + jeda) return HARI_NOTIFIKASI;
		return Math.min(
			AKHIR,
			HARI_NOTIFIKASI + ((ms - menuju - jeda) / sisa) * (AKHIR - HARI_NOTIFIKASI)
		);
	}

	function putar() {
		cancelAnimationFrame(bingkai);
		clearTimeout(jedaNotif);
		notifTampil = false;
		sorot = null;
		bermain = true;
		let sudahTersentuh = false;
		const mulai = performance.now();
		const maju = (sekarang: number) => {
			hari = hariPada(sekarang - mulai);
			if (!sudahTersentuh && hari >= HARI_NOTIFIKASI) {
				sudahTersentuh = true;
				notifTampil = true;
				jedaNotif = setTimeout(() => (notifTampil = false), 3600);
			}
			if (hari < AKHIR) bingkai = requestAnimationFrame(maju);
			else bermain = false;
		};
		hari = 0;
		bingkai = requestAnimationFrame(maju);
	}

	function sorotDari(event: PointerEvent) {
		const kotak = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const i = Math.round((event.clientX - kotak.left - PAD_KIRI) / slot - 0.5);
		sorot = Math.max(0, Math.min(indeks, i));
	}

	function tombol(event: KeyboardEvent) {
		const geser: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1
		};
		const awal = sorot ?? indeks;
		if (event.key === 'Home') sorot = 0;
		else if (event.key === 'End') sorot = indeks;
		else if (event.key in geser) sorot = Math.max(0, Math.min(indeks, awal + geser[event.key]));
		else return;
		event.preventDefault();
	}

	function lepas(event: PointerEvent) {
		if (event.pointerType === 'mouse') sorot = null;
	}

	onMount(() => {
		siap = true;
		if (gerakDikurangi()) return;
		hari = 0;
		const berhenti = saatTerlihat(putar, '-30%')(wadah);
		return () => {
			berhenti?.();
			cancelAnimationFrame(bingkai);
			clearTimeout(jedaNotif);
		};
	});
</script>

<figure
	bind:this={wadah}
	aria-labelledby="judul-simulasi"
	class="terminal tw-gelap border-line bg-base relative isolate overflow-hidden rounded-2xl border"
>
	<figcaption id="judul-simulasi" class="sr-only">
		{t(
			`Simulasi grafik harga saham fiktif ${TICKER} selama Juni sampai Juli 2026 beserta Red Flag Score-nya.`,
			`Simulated price chart of the fictional stock ${TICKER} from June to July 2026, with its Red Flag Score.`
		)}
	</figcaption>

	<header class="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
		<div class="min-w-0 space-y-1.5">
			<div class="flex items-center gap-2">
				<span
					class="tw-data bg-raised text-ink rounded-md px-2 py-0.5 text-[13px] font-semibold tracking-wide"
				>
					{TICKER}
				</span>
				<span class="text-secondary truncate text-[13px]">
					{t('Emiten fiktif', 'Fictional company')}<span class="hidden sm:inline"
						>{t(' untuk simulasi', ' for simulation')}</span
					>
				</span>
			</div>
			<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span class="tw-data text-ink text-[26px] leading-none font-medium sm:text-[30px]">
					{angka.format(harga)}
				</span>
				<span class="tw-data text-[13px] font-medium {selisih >= 0 ? 'text-naik' : 'text-turun'}">
					{selisih >= 0 ? '▲' : '▼'}
					{persen.format(Math.abs(selisih))}%
				</span>
				<span class="text-muted text-[12px]">{t('sejak 1 Jun', 'since Jun 1')}</span>
				{#if tersuspensi}
					<span
						class="bg-raised text-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px]"
						transition:fade={{ duration: 150 }}
					>
						<Ban class="size-3" aria-hidden="true" />
						{t('Disuspensi', 'Suspended')}
					</span>
				{/if}
			</div>
		</div>

		<div class="flex flex-none items-center gap-2">
			<SkorBadge skor={skorTampil} size="md" />
			<button
				type="button"
				onclick={putar}
				disabled={bermain}
				aria-label={t('Putar ulang simulasi', 'Replay simulation')}
				class="putar border-line text-secondary hover:text-ink hover:border-diamond-700 grid size-8 place-items-center rounded-lg border transition"
			>
				<RotateCcw class="size-3.5" aria-hidden="true" />
			</button>
		</div>
	</header>

	<div class="relative mt-3" bind:clientWidth={lebar} style="height:{tinggiTotal}px">
		<div class="plot absolute inset-0" class:menunggu={!siap} aria-hidden="true">
			<svg width={lebar} height={tinggiTotal} class="block overflow-visible">
				{#each garisHarga as nilai (nilai)}
					<line
						x1={PAD_KIRI}
						x2={PAD_KIRI + lebarPlot}
						y1={yHarga(nilai)}
						y2={yHarga(nilai)}
						class="grid-garis"
					/>
					<text x={PAD_KIRI + lebarPlot + 8} y={yHarga(nilai) + 3.5} class="label-sumbu">
						{angka.format(nilai)}
					</text>
				{/each}

				{#if hari >= SUSPENSI.mulai}
					<rect
						x={xTepi(SUSPENSI.mulai)}
						y="0"
						width={xTepi(SUSPENSI.selesai + 1) - xTepi(SUSPENSI.mulai)}
						height={atasSkor + TINGGI_SKOR}
						class="pita-suspensi"
						transition:fade={{ duration: 300 }}
					/>
				{/if}

				{#each lilin as item, i (i)}
					{#if item && i <= hari}
						{@const naik = item.tutup >= item.buka}
						<rect
							x={xHari(i) - lebarBadan / 2}
							y={tinggiHarga - tinggiVolume(item.volume)}
							width={lebarBadan}
							height={tinggiVolume(item.volume)}
							class="volume {naik ? 'fill-naik' : 'fill-turun'}"
						/>
						<g class="lilin" class:turun={!naik}>
							<line x1={xHari(i)} x2={xHari(i)} y1={yHarga(item.tinggi)} y2={yHarga(item.rendah)} />
							<rect
								x={xHari(i) - lebarBadan / 2}
								y={yHarga(Math.max(item.buka, item.tutup))}
								width={lebarBadan}
								height={Math.max(1.5, Math.abs(yHarga(item.buka) - yHarga(item.tutup)))}
								rx="1"
							/>
						</g>
					{/if}
				{/each}

				{#if lilinTerakhir && sorot === null}
					{@const y = yHarga(lilinTerakhir.tutup)}
					{@const naik = lilinTerakhir.tutup >= TUTUP_AWAL}
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
					<text x={PAD_KIRI + lebarPlot + 8} y={y + 4} class="label-harga"
						>{angka.format(lilinTerakhir.tutup)}</text
					>
				{/if}

				<line
					x1={PAD_KIRI}
					x2={PAD_KIRI + lebarPlot}
					y1={atasSkor}
					y2={atasSkor}
					class="grid-garis"
				/>
				<text x={PAD_KIRI + 4} y={ySkor(44)} class="label-panel">Red Flag Score</text>

				{#each segmenSkor as segmen (segmen.x0)}
					<rect
						x={segmen.x0}
						y={ySkor(segmen.nilai)}
						width={Math.max(0, segmen.x1 - segmen.x0)}
						height={atasSkor + TINGGI_SKOR - ySkor(segmen.nilai)}
						fill={segmen.warna}
						fill-opacity="0.1"
					/>
					{#if segmen.yLalu !== null}
						<line
							x1={segmen.x0}
							x2={segmen.x0}
							y1={segmen.yLalu}
							y2={ySkor(segmen.nilai)}
							stroke={segmen.warna}
							class="garis-skor"
						/>
					{/if}
					<line
						x1={segmen.x0}
						x2={Math.max(segmen.x0, segmen.x1)}
						y1={ySkor(segmen.nilai)}
						y2={ySkor(segmen.nilai)}
						stroke={segmen.warna}
						class="garis-skor"
					/>
				{/each}

				<g class="kawat" class:putus={tersentuh}>
					<line x1={PAD_KIRI} x2={PAD_KIRI + lebarPlot} y1={ySkor(BATAS)} y2={ySkor(BATAS)} />
				</g>
				<text x={PAD_KIRI + 4} y={ySkor(BATAS) - 5} class="label-sumbu"
					>{t('Batas notifikasi', 'Alert threshold')}</text
				>
				<text
					x={PAD_KIRI + lebarPlot + 8}
					y={ySkor(BATAS) + 3.5}
					class="label-kawat"
					class:putus={tersentuh}
				>
					{BATAS}
				</text>
				<text x={PAD_KIRI + lebarPlot + 8} y={ySkor(0) + 3.5} class="label-sumbu">0</text>

				{#if tersentuh}
					<line
						x1={xHari(HARI_NOTIFIKASI)}
						x2={xHari(HARI_NOTIFIKASI)}
						y1="0"
						y2={atasSkor + TINGGI_SKOR}
						class="garis-notifikasi"
						transition:fade={{ duration: 200 }}
					/>
					<circle cx={xHari(HARI_NOTIFIKASI)} cy={ySkor(BATAS)} r="5" class="denyut" />
					<rect
						x={xHari(HARI_NOTIFIKASI) - 4.5}
						y={ySkor(BATAS) - 4.5}
						width="9"
						height="9"
						rx="2"
						transform="rotate(45 {xHari(HARI_NOTIFIKASI)} {ySkor(BATAS)})"
						class="titik-kawat"
					/>
				{/if}

				{#if hari >= HARI_ANJLOK}
					{@const x0 = xHari(HARI_NOTIFIKASI)}
					{@const x1 = xHari(HARI_ANJLOK)}
					{@const y = atasSkor + TINGGI_SKOR - 12}
					<g class="kurung" transition:fade={{ duration: 400 }}>
						<path d="M{x0} {y - 5} V{y} H{x1} V{y - 5}" />
						<text x={(x0 + x1) / 2} y={y - 9} text-anchor="middle"
							>{t('4 hari bursa lebih awal', '4 trading days earlier')}</text
						>
					</g>
				{/if}

				{#each [0, 10, 20, 30, 40] as i (i)}
					<text
						x={i ? xHari(i) : PAD_KIRI}
						y={tinggiTotal - 7}
						text-anchor={i ? 'middle' : 'start'}
						class="label-sumbu">{tglPendek(i)}</text
					>
				{/each}

				{#if sorot !== null}
					{@const x = xHari(sorot)}
					<line x1={x} x2={x} y1="0" y2={atasSkor + TINGGI_SKOR} class="silang" />
					{#if lilin[sorot]}
						{@const y = yHarga((lilin[sorot] as Lilin).tutup)}
						<line x1={PAD_KIRI} x2={PAD_KIRI + lebarPlot} y1={y} y2={y} class="silang" />
						<rect
							x={PAD_KIRI + lebarPlot + 2}
							y={y - 9}
							width={PAD_KANAN - 4}
							height="18"
							rx="4"
							class="tag-silang"
						/>
						<text x={PAD_KIRI + lebarPlot + 8} y={y + 4} class="label-harga terang">
							{angka.format((lilin[sorot] as Lilin).tutup)}
						</text>
					{/if}
					<circle cx={x} cy={ySkor(skorPada(sorot))} r="4" class="titik-sorot" />
				{/if}
			</svg>

			{#each penanda as item (item.hari)}
				{#if hari >= item.hari}
					<span
						class="lencana"
						class:biru={item.jenis === 'notifikasi'}
						style="left:{xHari(item.posisi)}px; top:{tinggiHarga + JALUR / 2}px"
						in:scale={{ duration: 320, start: 0.3, easing: cubicOut }}
					>
						<item.Ikon class="size-3" aria-hidden="true" />
					</span>
				{/if}
			{/each}

			{#if infoSorot}
				<div class="tooltip" style="left:{infoSorot.kiri}px">
					<p class="text-muted text-[11.5px]">{infoSorot.tanggal}</p>
					{#if infoSorot.item}
						<p class="mt-1 flex items-baseline gap-2">
							<span class="tw-data text-ink text-[15px] font-medium"
								>{angka.format(infoSorot.item.tutup)}</span
							>
							<span class="text-muted text-[11.5px]">{t('harga tutup', 'closing price')}</span>
							{#if infoSorot.ubah !== null}
								<span
									class="tw-data ml-auto text-[12px] {infoSorot.ubah >= 0
										? 'text-naik'
										: 'text-turun'}"
								>
									{infoSorot.ubah >= 0 ? '▲' : '▼'}
									{persen.format(Math.abs(infoSorot.ubah))}%
								</span>
							{/if}
						</p>
					{:else}
						<p class="text-secondary mt-1 text-[13px]">
							{t('Perdagangan dihentikan bursa', 'Trading suspended by the exchange')}
						</p>
					{/if}
					<p class="mt-1 flex items-center gap-2">
						<span
							class="h-0.5 w-3 rounded-full"
							style="background:{tierDariSkor(infoSorot.skor).color}"
						></span>
						<span class="tw-data text-ink text-[13px] font-medium">{infoSorot.skor}</span>
						<span class="text-muted text-[11.5px]"
							>Red Flag Score, {tierDariSkor(infoSorot.skor).label}</span
						>
					</p>
					{#if infoSorot.kejadian}
						<p class="border-line text-secondary mt-2 border-t pt-2 text-[12px] leading-snug">
							{t(...infoSorot.kejadian.teks)}
						</p>
					{/if}
				</div>
			{/if}
		</div>

		<div
			class="absolute inset-x-0 top-0 cursor-crosshair"
			style="height:{atasSkor + TINGGI_SKOR}px; touch-action: pan-y"
			role="slider"
			tabindex="0"
			aria-label={t('Telusuri grafik per hari', 'Explore the chart day by day')}
			aria-valuemin={0}
			aria-valuemax={indeks}
			aria-valuenow={sorot ?? indeks}
			aria-valuetext={teksNilai}
			onpointermove={sorotDari}
			onpointerdown={sorotDari}
			onpointerleave={lepas}
			onkeydown={tombol}
			onblur={() => (sorot = null)}
		></div>
	</div>

	{#if notifTampil}
		<div
			class="notif absolute inset-x-3 top-3 z-10 sm:inset-x-auto sm:right-4 sm:w-85"
			aria-hidden="true"
			in:fly={{ y: -28, duration: 420, easing: cubicOut }}
			out:fly={{ y: -20, duration: 300 }}
		>
			<Logo size={30} cincin={false} />
			<div class="min-w-0 flex-1">
				<p class="flex items-center justify-between gap-2">
					<span class="text-ink text-[13px] font-semibold">TripWire</span>
					<span class="text-muted text-[11.5px]">{t('baru saja', 'just now')}</span>
				</p>
				<p class="text-ink mt-0.5 text-[13px] leading-snug font-medium">
					{t(`${TICKER} menyentuh skor 91, Kritis`, `${TICKER} hit a score of 91, Critical`)}
				</p>
				<p class="text-secondary mt-0.5 text-[12px] leading-snug">
					{t(
						'Lima orang dalam menjual dalam 30 hari dan kepemilikan berubah 8 poin.',
						'Five insiders sold within 30 days and ownership changed by 8 points.'
					)}
				</p>
			</div>
		</div>
	{/if}

	<div class="border-line bg-void/40 flex min-h-16 items-start gap-3 border-t px-4 py-3 sm:px-5">
		{#key kabar.hari}
			<p class="flex items-start gap-3" in:fly={{ y: 8, duration: 280 }}>
				<span class="tw-data text-diamond-300 mt-px w-12 flex-none text-[12px]"
					>{tglPendek(kabar.hari)}</span
				>
				<span class="text-secondary text-[13px] leading-snug">{t(...kabar.teks)}</span>
			</p>
		{/key}
	</div>

	<ol class="sr-only">
		{#each kejadian as item (item.hari)}
			<li>{tglPanjang(item.hari)}: {t(...item.teks)}</li>
		{/each}
	</ol>
</figure>

<style>
	.terminal {
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.05) inset,
			0 50px 120px -50px rgba(74, 158, 255, 0.45);
	}

	.plot.menunggu {
		animation: tampil-telat 0s 1.2s both;
	}

	@keyframes tampil-telat {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.grid-garis {
		stroke: rgba(180, 205, 255, 0.07);
	}

	.label-sumbu,
	.label-panel,
	.label-harga,
	.label-kawat,
	.kurung text {
		font-family: var(--font-mono);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
	}

	.label-sumbu {
		fill: var(--color-muted);
		font-size: 10px;
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
		animation: tumbuh 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
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
		opacity: 0.22;
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

	.pita-suspensi {
		fill: rgba(180, 205, 255, 0.05);
	}

	.garis-skor {
		stroke-width: 2;
		stroke-linecap: round;
	}

	.kawat line {
		stroke: var(--color-secondary);
		stroke-width: 1.25;
		stroke-opacity: 0.6;
		transition:
			stroke 0.3s ease,
			stroke-opacity 0.3s ease;
	}

	.kawat.putus line {
		stroke: var(--color-tier-critical);
		stroke-opacity: 1;
		filter: drop-shadow(0 0 5px var(--color-tier-critical));
	}

	.kawat.putus {
		animation: getar 0.7s ease-out;
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

	.garis-notifikasi {
		stroke: var(--color-diamond-500);
		stroke-opacity: 0.55;
	}

	.titik-kawat {
		fill: var(--color-tier-critical);
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.denyut {
		fill: none;
		stroke: var(--color-tier-critical);
		stroke-width: 1.5;
		transform-box: fill-box;
		transform-origin: center;
		animation: denyut 1.4s ease-out 3;
		opacity: 0;
	}

	@keyframes denyut {
		from {
			opacity: 0.9;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(5);
		}
	}

	.kurung path {
		fill: none;
		stroke: var(--color-diamond-300);
		stroke-width: 1.25;
	}

	.kurung text {
		fill: var(--color-diamond-100);
		font-size: 10.5px;
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
	}

	.lencana.biru {
		border-color: var(--color-diamond-500);
		background: var(--color-diamond-900);
		color: var(--color-diamond-300);
		box-shadow: 0 0 0 4px rgba(74, 158, 255, 0.12);
	}

	.tooltip {
		position: absolute;
		top: 8px;
		z-index: 5;
		width: 200px;
		border: 1px solid rgba(180, 205, 255, 0.18);
		border-radius: 10px;
		background: rgba(13, 18, 32, 0.96);
		padding: 10px 12px;
		box-shadow: 0 18px 40px -20px #000;
		pointer-events: none;
	}

	.notif {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 14px;
		background: rgba(20, 28, 46, 0.97);
		padding: 11px 13px;
		box-shadow: 0 24px 50px -20px rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(12px);
		pointer-events: none;
	}

	.putar:disabled {
		opacity: 0.35;
	}
</style>
