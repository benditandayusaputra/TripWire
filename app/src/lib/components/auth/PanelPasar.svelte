<script lang="ts">
	import Logo from '$lib/components/Logo.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import {
		BATAS,
		HARI_NOTIFIKASI,
		TICKER,
		kejadianPada,
		langkahSkor,
		lilin,
		tanggal,
		type Lilin
	} from '$lib/components/beranda/simulasi';
	import { emiten } from '$lib/emiten';
	import { tierDariSkor } from '$lib/skor';

	const HARI = HARI_NOTIFIKASI + 4;
	const data = lilin.slice(0, HARI) as Lilin[];

	const LEBAR = 600;
	const KIRI = 6;
	const KANAN = 46;
	const ATAS_HARGA = 10;
	const TINGGI_HARGA = 150;
	const ATAS_SKOR = 192;
	const TINGGI_SKOR = 56;
	const TINGGI = 272;

	const slot = (LEBAR - KIRI - KANAN) / HARI;
	const badan = slot * 0.58;
	const bawah = Math.min(...data.map((item) => item.rendah)) - 12;
	const atas = Math.max(...data.map((item) => item.tinggi)) + 12;

	const x = (hari: number) => KIRI + slot * (hari + 0.5);
	const yHarga = (nilai: number) => ATAS_HARGA + ((atas - nilai) / (atas - bawah)) * TINGGI_HARGA;
	const ySkor = (nilai: number) => ATAS_SKOR + (1 - nilai / 100) * TINGGI_SKOR;
	const DASAR_SKOR = ATAS_SKOR + TINGGI_SKOR;

	const segmen = langkahSkor
		.filter(([mulai]) => mulai < HARI)
		.map(([mulai, nilai], urutan, semua) => ({
			nilai,
			warna: tierDariSkor(nilai).color,
			x0: urutan === 0 ? KIRI : x(mulai),
			x1: urutan + 1 < semua.length ? x(semua[urutan + 1][0]) : LEBAR - KANAN,
			yLalu: ySkor(semua[Math.max(0, urutan - 1)][1])
		}));

	const skorAkhir = segmen[segmen.length - 1].nilai;
	const tutupAwal = data[0].tutup;
	const tutupAkhir = data[HARI - 1].tutup;
	const selisih = ((tutupAkhir - tutupAwal) / tutupAwal) * 100;

	const angka = new Intl.NumberFormat('id-ID');
	const persen = new Intl.NumberFormat('id-ID', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});
	const tgl = (hari: number) =>
		tanggal[hari].toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
</script>

<section
	aria-label="Contoh peringatan TripWire dengan emiten fiktif"
	class="panggung relative isolate order-1 flex h-60 flex-col overflow-hidden sm:h-72 lg:sticky lg:top-0 lg:h-dvh"
>
	<img
		src="/foto/skyline-jakarta-1600.webp"
		srcset="/foto/skyline-jakarta-800.webp 800w, /foto/skyline-jakarta-1600.webp 1600w"
		sizes="(min-width: 1024px) 55vw, 100vw"
		width="1600"
		height="696"
		alt=""
		fetchpriority="high"
		class="kota"
	/>

	<div class="relative flex flex-1 flex-col px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12 lg:pt-10 xl:px-16">
		<Wordmark />

		<p class="judul text-ink mt-14 hidden max-w-lg lg:block">
			Red flag saham terdeteksi sebelum jadi berita.
		</p>

		<div class="relative mt-4 max-w-sm lg:my-auto lg:max-w-160 lg:pt-10">
			<figure class="kartu hidden lg:block">
				<figcaption class="px-5 pt-4">
					<span class="flex items-center gap-2.5">
						<span
							class="tw-data text-ink bg-void/60 rounded-md border border-(--edge) px-2 py-0.5 text-[13px] font-semibold"
						>
							{TICKER}
						</span>
						<span class="text-muted text-[12.5px]">Emiten fiktif</span>
					</span>
					<span class="tw-data mt-1.5 flex items-baseline gap-2.5">
						<span class="text-ink text-[26px] leading-none">{angka.format(tutupAkhir)}</span>
						<span class="text-naik text-[13px]">▲ {persen.format(selisih)}%</span>
						<span class="text-muted text-[12px]">sejak {tgl(0)}</span>
					</span>
				</figcaption>

				<div class="tirai px-3 pt-3 pb-2">
					<svg
						viewBox="0 0 {LEBAR} {TINGGI}"
						class="block h-auto w-full"
						role="img"
						aria-labelledby="judul-grafik-masuk"
					>
						<title id="judul-grafik-masuk">
							Harga {TICKER} naik {persen.format(selisih)} persen dalam {HARI} hari bursa, sementara Red
							Flag Score naik dari {segmen[0].nilai} ke {skorAkhir} dan melewati batas notifikasi {BATAS}.
						</title>

						{#each [1200, 1300] as nilai (nilai)}
							<line
								x1={KIRI}
								x2={LEBAR - KANAN}
								y1={yHarga(nilai)}
								y2={yHarga(nilai)}
								class="kisi"
							/>
							<text x={LEBAR - KANAN + 8} y={yHarga(nilai) + 3.5} class="label"
								>{angka.format(nilai)}</text
							>
						{/each}

						<line
							x1={x(HARI_NOTIFIKASI)}
							x2={x(HARI_NOTIFIKASI)}
							y1={ATAS_HARGA}
							y2={DASAR_SKOR}
							class="penanda"
						/>

						{#each data as item, hari (hari)}
							<g class={item.tutup >= item.buka ? 'naik' : 'turun'}>
								<line x1={x(hari)} x2={x(hari)} y1={yHarga(item.tinggi)} y2={yHarga(item.rendah)} />
								<rect
									x={x(hari) - badan / 2}
									y={yHarga(Math.max(item.buka, item.tutup))}
									width={badan}
									height={Math.max(1.5, Math.abs(yHarga(item.buka) - yHarga(item.tutup)))}
									rx="1"
								/>
							</g>
						{/each}

						<text x={KIRI} y={ATAS_SKOR - 8} class="label">Red Flag Score</text>
						{#each segmen as bagian (bagian.x0)}
							<path
								d="M{bagian.x0} {DASAR_SKOR}V{ySkor(bagian.nilai)}H{bagian.x1}V{DASAR_SKOR}Z"
								fill={bagian.warna}
								opacity="0.12"
							/>
							<path
								d="M{bagian.x0} {bagian.yLalu}V{ySkor(bagian.nilai)}H{bagian.x1}"
								stroke={bagian.warna}
								class="skor"
							/>
						{/each}

						<line x1={KIRI} x2={LEBAR - KANAN} y1={ySkor(BATAS)} y2={ySkor(BATAS)} class="batas" />
						<text x={LEBAR - KANAN + 8} y={ySkor(BATAS) + 3.5} class="label batas-label"
							>{BATAS}</text
						>

						<circle cx={x(HARI_NOTIFIKASI)} cy={ySkor(skorAkhir)} r="8" class="cincin" />
						<circle cx={x(HARI_NOTIFIKASI)} cy={ySkor(skorAkhir)} r="3.5" class="titik" />

						<text x={KIRI} y={TINGGI - 4} class="label">{tgl(0)}</text>
						<text x={x(HARI_NOTIFIKASI)} y={TINGGI - 4} text-anchor="middle" class="label">
							{tgl(HARI_NOTIFIKASI)}
						</text>
					</svg>
				</div>

				<p class="flex items-baseline gap-3 border-t border-(--edge-soft) px-5 py-3 text-[13px]">
					<span class="tw-data text-diamond-300 flex-none">{tgl(HARI_NOTIFIKASI)}</span>
					<span class="text-secondary">{kejadianPada(HARI_NOTIFIKASI).teks}</span>
				</p>
			</figure>

			<div class="notif">
				<Logo size={22} cincin={false} />
				<div class="min-w-0 flex-1">
					<p class="flex items-baseline justify-between gap-3">
						<span class="text-ink text-[13px] font-medium">TripWire</span>
						<span class="text-muted text-[11.5px]">baru saja</span>
					</p>
					<p class="text-ink text-[13.5px] leading-snug font-semibold">
						{TICKER} menyentuh skor {skorAkhir}, {tierDariSkor(skorAkhir).label}
					</p>
					<p class="text-secondary mt-0.5 hidden text-[12.5px] leading-snug sm:block">
						Lima orang dalam menjual dalam 30 hari dan kepemilikan berubah 8 poin.
					</p>
				</div>
			</div>
		</div>
	</div>

	<div class="pita hidden lg:block" aria-hidden="true">
		<div class="jalan-pita">
			{#each [...emiten, ...emiten] as [kode, nama], urutan (urutan)}
				<span class="item-pita">
					<span class="tw-data text-ink text-[12.5px] font-semibold">{kode}</span>
					<span class="text-muted text-[12.5px]">{nama}</span>
				</span>
			{/each}
		</div>
	</div>
</section>

<style>
	.panggung {
		background: linear-gradient(180deg, #0a1426 0%, var(--color-void) 100%);
	}

	.kota {
		position: absolute;
		inset: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 78%;
		mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.35), #000 55%);
	}

	@media (min-width: 1024px) {
		.kota {
			inset: auto 0 0 0;
			height: 62%;
			object-position: 50% 100%;
			mask-image: linear-gradient(180deg, transparent, #000 45%, #000 85%, transparent);
		}

		.panggung::after {
			content: '';
			position: absolute;
			inset: 0 0 0 auto;
			width: 1px;
			background: linear-gradient(180deg, transparent, var(--edge-strong), transparent);
		}
	}

	.judul {
		font-family: var(--font-display);
		font-size: clamp(2rem, 1.1rem + 1.6vw, 2.75rem);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	@media (max-height: 820px) {
		.judul {
			display: none;
		}
	}

	.kartu {
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: rgba(10, 16, 30, 0.8);
		box-shadow: 0 40px 80px -40px #000;
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}

	.tirai {
		animation: tirai 1.8s cubic-bezier(0.35, 0.6, 0.2, 1) 0.25s backwards;
	}

	@keyframes tirai {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}

	.kisi {
		stroke: rgba(180, 205, 255, 0.07);
	}

	.label {
		fill: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10.5px;
	}

	.penanda {
		stroke: var(--color-diamond-300);
		stroke-opacity: 0.35;
		stroke-dasharray: 2 4;
	}

	.naik line,
	.naik rect {
		stroke: var(--color-naik);
	}

	.naik rect {
		fill: var(--color-void);
		stroke-width: 1.2;
	}

	.turun line {
		stroke: var(--color-turun);
	}

	.turun rect {
		fill: var(--color-turun);
	}

	.skor {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.batas {
		stroke: var(--color-tier-critical);
		stroke-dasharray: 5 4;
		stroke-opacity: 0.85;
	}

	.batas-label {
		fill: var(--color-tier-critical);
	}

	.titik {
		fill: var(--color-tier-critical);
	}

	.cincin {
		fill: none;
		stroke: var(--color-tier-critical);
		transform-box: fill-box;
		transform-origin: center;
		animation: cincin 1.6s ease-out 2s 3 backwards;
	}

	@keyframes cincin {
		from {
			opacity: 0.9;
			transform: scale(0.4);
		}
		to {
			opacity: 0;
			transform: scale(1.8);
		}
	}

	.notif {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 16px;
		background: rgba(20, 28, 46, 0.88);
		padding: 12px 14px;
		box-shadow: 0 24px 48px -24px #000;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		animation: turun 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) 0.5s backwards;
	}

	@media (min-width: 1024px) {
		.notif {
			animation-delay: 1.7s;
			position: absolute;
			top: -38px;
			right: -18px;
			width: min(330px, 62%);
		}
	}

	@keyframes turun {
		from {
			opacity: 0;
			transform: translateY(-18px) scale(0.97);
		}
	}

	.pita {
		overflow: hidden;
		border-top: 1px solid var(--edge-soft);
		background: rgba(8, 11, 18, 0.72);
		mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
	}

	.jalan-pita {
		display: flex;
		width: max-content;
		animation: jalan 90s linear infinite;
	}

	@keyframes jalan {
		to {
			transform: translateX(-50%);
		}
	}

	.item-pita {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		padding: 12px 20px;
		border-right: 1px solid rgba(180, 205, 255, 0.07);
	}
</style>
