<script lang="ts">
	import { LayoutDashboard } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import { formatPersen, kataArah } from '$lib/dashboard';
	import { squarify, type RingkasanPasar, type SahamAktif } from '$lib/pasar';
	import { NAMA_SEKTOR, formatRupiah } from '$lib/watchlist';

	let {
		pasar,
		memuat,
		dipantau,
		class: kelas = ''
	}: {
		pasar: RingkasanPasar | null;
		memuat: boolean;
		dipantau: string[];
		class?: string;
	} = $props();

	let lebar = $state(720);

	const tinggi = $derived(
		lebar < 640 ? Math.round(lebar * 1.05) : Math.round(Math.min(440, lebar * 0.5))
	);
	const namaSektor = (nama: string) => NAMA_SEKTOR[nama] ?? nama;

	const petak = $derived.by(() => {
		const kelompok = new Map<string, SahamAktif[]>();
		for (const saham of pasar?.peta ?? []) {
			const nama = saham.sector ?? '';
			kelompok.set(nama, [...(kelompok.get(nama) ?? []), saham]);
		}
		const sektor = squarify(
			[...kelompok].map(([nama, saham]) => ({
				bobot: saham.reduce((total, satu) => total + satu.market_cap, 0),
				data: { nama, saham }
			})),
			{ x: 0, y: 0, w: lebar, h: tinggi }
		);
		return sektor.map((kotak) => {
			const judul = kotak.h > 60 && kotak.w > 78 ? 18 : 0;
			return {
				...kotak,
				judul,
				saham: squarify(
					kotak.data.saham.map((satu) => ({ bobot: satu.market_cap, data: satu })),
					{ x: kotak.x, y: kotak.y + judul, w: kotak.w, h: kotak.h - judul }
				)
			};
		});
	});

	function gaya(ubah: number) {
		const kuat = Math.min(1, Math.abs(ubah) / 0.03);
		if (ubah === 0) return 'background:var(--color-raised);--teks:var(--color-ink)';
		const token = ubah > 0 ? 'var(--color-naik)' : 'var(--color-turun)';
		return `background:color-mix(in srgb, ${token} ${Math.round(24 + kuat * 58)}%, var(--color-base));--teks:${kuat > 0.45 ? '#ffffff' : 'var(--color-ink)'}`;
	}

	const SKALA = [-0.03, -0.015, -0.005, 0, 0.005, 0.015, 0.03];
</script>

<Panel
	judul={t('Peta pasar', 'Market map')}
	keterangan={t(
		'40 saham terbesar BEI per sektor, luas menurut kapitalisasi, warna menurut perubahan harian',
		'The 40 largest IDX stocks by sector, sized by market cap, colored by daily change'
	)}
	ikon={LayoutDashboard}
	testid="panel-peta-pasar"
	class={kelas}
>
	{#if pasar}
		<div class="peta" bind:clientWidth={lebar} style="height:{tinggi}px">
			{#each petak as sektor (sektor.data.nama)}
				<div
					class="sektor"
					style="left:{sektor.x}px; top:{sektor.y}px; width:{sektor.w}px; height:{sektor.h}px"
					aria-hidden="true"
				>
					{#if sektor.judul}
						<span class="label-sektor">{namaSektor(sektor.data.nama)}</span>
					{/if}
				</div>
			{/each}
			<ul class="daftar" aria-label={t('Saham di peta pasar', 'Stocks on the market map')}>
				{#each petak.flatMap((sektor) => sektor.saham) as kotak (kotak.data.ticker)}
					{@const ubah = formatPersen(kotak.data.daily_close_change)}
					<li
						data-testid="petak-pasar"
						data-ticker={kotak.data.ticker}
						class="petak"
						class:dipantau={dipantau.includes(kotak.data.ticker)}
						style="left:{kotak.x}px; top:{kotak.y}px; width:{kotak.w}px; height:{kotak.h}px; {gaya(
							kotak.data.daily_close_change
						)}"
					>
						<a
							href="/stocks/{kotak.data.ticker}"
							class="isi-petak"
							title="{kotak.data.ticker}, {kotak.data.company_name}, {ubah.teks}, {formatRupiah(
								kotak.data.market_cap
							)}"
							aria-label={t(
								`${kotak.data.ticker}, ${namaSektor(kotak.data.sector ?? '')}, ${kataArah(ubah.arah)} ${ubah.angka}, kapitalisasi ${formatRupiah(kotak.data.market_cap)}`,
								`${kotak.data.ticker}, ${namaSektor(kotak.data.sector ?? '')}, ${kataArah(ubah.arah)} ${ubah.angka}, market cap ${formatRupiah(kotak.data.market_cap)}`
							)}
						>
							{#if kotak.w > 46 && kotak.h > 26}
								<span
									class="kode"
									style="font-size:{Math.min(
										16,
										Math.max(10.5, Math.sqrt(kotak.w * kotak.h) / 7)
									)}px">{kotak.data.ticker}</span
								>
								{#if kotak.h > 42}
									<span class="ubah">{ubah.teks}</span>
								{/if}
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</div>
		<div class="mt-3 flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-2" aria-hidden="true">
				<span class="tw-data text-turun text-[11px]">▼ 3%</span>
				<span class="flex gap-0.5">
					{#each SKALA as nilai (nilai)}
						<span class="skala" style={gaya(nilai)}></span>
					{/each}
				</span>
				<span class="tw-data text-naik text-[11px]">▲ 3%</span>
			</div>
			<p class="text-muted flex items-center gap-2 text-[11.5px]">
				<span class="contoh-pantau" aria-hidden="true"></span>
				{t('Saham di watchlist kamu', 'In your watchlist')}
			</p>
		</div>
	{:else if memuat}
		<span class="kerangka" aria-hidden="true"></span>
	{:else}
		<p class="text-muted text-[13px]">
			{t(
				'Peta pasar belum bisa dimuat dari Sectors.',
				'The market map could not be loaded from Sectors.'
			)}
		</p>
	{/if}
</Panel>

<style>
	.peta {
		position: relative;
		overflow: hidden;
		border-radius: 12px;
	}

	.sektor {
		position: absolute;
		box-shadow: inset 0 0 0 1px var(--color-base);
	}

	.label-sektor {
		display: block;
		overflow: hidden;
		padding: 2px 6px 0;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		line-height: 16px;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.daftar {
		position: absolute;
		inset: 0;
	}

	.petak {
		position: absolute;
		overflow: hidden;
		border: 1px solid var(--color-base);
		border-radius: 4px;
		color: var(--teks);
		text-align: center;
		transition: filter 0.2s ease;
	}

	.isi-petak {
		display: flex;
		width: 100%;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: inherit;
	}

	.isi-petak:focus-visible {
		outline: 2px solid var(--color-diamond-300);
		outline-offset: -2px;
	}

	@media (hover: hover) {
		.petak:hover {
			filter: brightness(1.18);
		}
	}

	.petak.dipantau {
		box-shadow: inset 0 0 0 2px var(--color-diamond-300);
	}

	.kode {
		font-family: var(--font-mono);
		font-weight: 600;
		letter-spacing: 0.03em;
		line-height: 1.15;
	}

	.ubah {
		font-family: var(--font-mono);
		font-size: 10.5px;
		opacity: 0.92;
	}

	.skala {
		width: 16px;
		height: 10px;
		border-radius: 3px;
	}

	.contoh-pantau {
		width: 14px;
		height: 10px;
		border-radius: 3px;
		box-shadow: inset 0 0 0 2px var(--color-diamond-300);
	}

	.kerangka {
		display: block;
		height: 320px;
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
