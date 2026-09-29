<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import { BellRing, CircleHelp, List, Plus, TriangleAlert } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import BarisSaham from '$lib/components/watchlist/BarisSaham.svelte';
	import PanelEmiten from '$lib/components/watchlist/PanelEmiten.svelte';
	import PilihSaham from '$lib/components/watchlist/PilihSaham.svelte';
	import RingkasanPantauan from '$lib/components/watchlist/RingkasanPantauan.svelte';
	import SaranSaham from '$lib/components/watchlist/SaranSaham.svelte';
	import TabelWatchlist from '$lib/components/watchlist/TabelWatchlist.svelte';
	import TurWatchlist, { type LangkahTur } from '$lib/components/watchlist/TurWatchlist.svelte';
	import { HARI_NOTIFIKASI, lilin, skorPada } from '$lib/components/beranda/simulasi';
	import { emiten } from '$lib/emiten';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';
	import { tierDariSkor } from '$lib/skor';
	import {
		BATAS_WATCHLIST,
		HARI_TREN,
		penutupanTerbaru,
		type Baris,
		type SahamPasar,
		type TabPanel,
		type Tren
	} from '$lib/watchlist';

	let { data, form } = $props();

	const KUNCI_TUR = 'tripwire:tur-watchlist';

	const LANGKAH_TUR: LangkahTur[] = [
		{
			judul: 'Ini watchlist kamu',
			isi: 'Daftar saham yang kamu minta TripWire jaga. Setiap hari TripWire membaca data saham ini dari Sectors dan mencari tanda bahaya, misalnya orang dalam yang ramai menjual atau saham yang pernah dihentikan bursa.'
		},
		{
			target: '[data-tur="cari"]',
			judul: 'Tambah saham dari sini',
			isi: 'Klik untuk membuka daftar semua saham BEI lengkap dengan harga dari Sectors. Cari lewat kode atau nama, saring per sektor, lalu tekan Pantau. Beberapa saham bisa ditambah sekaligus.'
		},
		{
			target: '[data-tur="baris"]',
			judul: 'Cara membaca satu baris',
			isi: 'Dari kiri: kode dan nama saham, garis harga sebulan terakhir, lalu harga penutupan dan perubahannya. Hijau dengan ▲ berarti naik, merah dengan ▼ berarti turun.'
		},
		{
			target: '[data-tur="skor"]',
			judul: 'Lingkaran ini Red Flag Score',
			isi: 'Skor 0 sampai 100 dari tiga sinyal tata kelola. Makin tinggi, makin banyak tanda bahaya: Rendah sampai 30, Sedang sampai 60, Tinggi sampai 85, lalu Kritis. Ikon jam pasir berarti saham itu belum dipindai.'
		},
		{
			target: '[data-tur="saran"]',
			judul: 'Belum tahu mulai dari mana?',
			isi: 'Ini saham dengan kapitalisasi terbesar di BEI menurut Sectors. Tekan Pantau dan saham itu langsung masuk watchlist dengan cek harian.'
		},
		{
			target: '[data-tur="detail"]',
			judul: 'Detail setiap saham',
			isi: 'Pilih satu baris untuk melihat detailnya. Tab Harga berisi grafik tiga bulan, tab Risiko berisi alasan di balik skor, dan tab Pemantauan untuk mengatur kapan TripWire memeriksa serta mengabarimu.'
		},
		{
			target: '[data-tur="kabar"]',
			judul: 'Kabar datang ke sini',
			isi: 'Begitu skor melewati batas yang kamu atur, notifikasi masuk ke menu ini lengkap dengan alasannya. Notifikasi push ke HP bisa dinyalakan di halaman Notifikasi.'
		}
	];

	const contohSeri = lilin
		.slice(0, HARI_NOTIFIKASI + 1)
		.flatMap((bar) => (bar ? [bar.tutup] : []))
		.slice(-HARI_TREN);
	const contohPenutupan = {
		harga: contohSeri[contohSeri.length - 1],
		ubah: contohSeri[contohSeri.length - 1] / contohSeri[contohSeri.length - 2] - 1,
		tanggal: ''
	};

	let sekarang = $state(Date.now());
	let kabar = $state<{ ticker: string; skor: number | null } | null>(null);
	let terakhirTerbaca = presenceStore.insightBaru[0]?.notification_id;
	let jedaKabar: ReturnType<typeof setTimeout> | undefined;
	let tur = $state<ReturnType<typeof TurWatchlist>>();
	let pemilih = $state<ReturnType<typeof PilihSaham>>();
	let tabPanel = $state<TabPanel>('harga');
	let turBuka = $state(false);
	let tren = $state<Record<string, Tren>>({});
	let trenSiap = $state(false);
	let teratas = $state<SahamPasar[]>([]);
	let teratasSiap = $state(false);

	const baris = $derived<Baris[]>(
		data.items.map((item) => {
			const kutipan = data.quotes[item.ticker] ?? null;
			const trenEmiten = tren[item.ticker] ?? null;
			const penutupan = penutupanTerbaru(kutipan, trenEmiten);
			return {
				item,
				kutipan,
				penutupan,
				tren: trenEmiten?.tutup ?? null,
				risiko: data.risk[item.ticker] ?? null,
				skor: data.risk[item.ticker]?.red_flag?.score ?? null,
				ubah: penutupan?.ubah ?? null,
				aktif: item.conditions.filter((kondisi) => kondisi.is_active).length
			};
		})
	);
	const terpilih = $derived(baris.find((b) => b.item.ticker === data.kode) ?? null);
	const dipantau = $derived(data.items.map((item) => item.ticker));
	const cadangan = $derived(emiten.filter(([kode]) => !dipantau.includes(kode)).slice(0, 8));
	const penuh = $derived(data.items.length >= BATAS_WATCHLIST);

	$effect(() => {
		let batal = false;
		Promise.resolve(data.tren).then((peta) => {
			if (batal) return;
			tren = peta ?? {};
			trenSiap = true;
		});
		return () => (batal = true);
	});

	$effect(() => {
		let batal = false;
		Promise.resolve(data.teratas).then((daftar) => {
			if (batal) return;
			teratas = daftar ?? [];
			teratasSiap = true;
		});
		return () => (batal = true);
	});

	function sudahTur() {
		try {
			return localStorage.getItem(KUNCI_TUR) !== null;
		} catch {
			return true;
		}
	}

	function tandaiTur() {
		try {
			localStorage.setItem(KUNCI_TUR, new Date().toISOString());
		} catch {
			return;
		}
	}

	onMount(() => {
		const detak = setInterval(() => (sekarang = Date.now()), 30_000);
		const jedaTur = sudahTur() || data.dipilih ? undefined : setTimeout(() => tur?.mulai(), 450);
		presenceStore.sambung();
		return () => {
			clearInterval(detak);
			clearTimeout(jedaKabar);
			clearTimeout(jedaTur);
			presenceStore.putus();
		};
	});

	$effect(() => {
		const terbaru = presenceStore.insightBaru[0];
		if (!terbaru || terbaru.notification_id === terakhirTerbaca) return;
		terakhirTerbaca = terbaru.notification_id;
		kabar = { ticker: terbaru.ticker, skor: terbaru.score };
		if (!navigating.to) invalidateAll();
		clearTimeout(jedaKabar);
		jedaKabar = setTimeout(() => (kabar = null), 6000);
	});

	function fokusLembar(node: HTMLElement) {
		if (data.dipilih && matchMedia('(max-width: 1023.98px)').matches) {
			node
				.querySelector<HTMLElement>('[data-testid="panel-emiten"]')
				?.focus({ preventScroll: true });
		}
	}

	function setelahPilih(terakhir: string | null) {
		if (terakhir) goto(`/watchlist?emiten=${terakhir}`, { noScroll: true });
	}

	function pintasan(event: KeyboardEvent) {
		if (turBuka || document.querySelector('dialog[open]')) return;
		const target = event.target as HTMLElement;
		const mengetik =
			['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
		if (event.key === '/' && !mengetik) {
			event.preventDefault();
			pemilih?.buka();
		} else if (event.key === 'Escape' && data.dipilih && !mengetik) {
			goto('/watchlist', { noScroll: true });
		}
	}
</script>

<svelte:head>
	<title>Watchlist TripWire</title>
</svelte:head>

<svelte:window onkeydown={pintasan} />

<section class="space-y-5">
	<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		<div class="max-w-2xl space-y-1.5">
			<h1 class="tw-title text-ink">Watchlist</h1>
			<p class="text-secondary text-[14px] leading-relaxed">
				Saham yang kamu minta TripWire jaga. Harganya dari Sectors, dan setiap saham dipindai
				otomatis untuk mencari tanda bahaya tata kelola sebelum terlihat di harga.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2.5">
			<button
				type="button"
				data-testid="mulai-tur"
				class="tw-ghost px-3 py-1.5 text-[13px]"
				onclick={() => tur?.mulai()}
			>
				<CircleHelp class="size-4" aria-hidden="true" />
				Cara pakai
			</button>
			<p
				data-testid="status-langsung"
				data-terhubung={presenceStore.terhubung}
				class="langsung"
				class:aktif={presenceStore.terhubung}
			>
				<span class="titik" aria-hidden="true"></span>
				{presenceStore.terhubung ? 'Pembaruan langsung' : 'Menyambungkan'}
			</p>
			<p class="slot" title="Batas watchlist {BATAS_WATCHLIST} saham">
				<span class="tw-data text-ink">{data.items.length}</span>
				<span class="text-muted">dari {BATAS_WATCHLIST} saham</span>
			</p>
		</div>
	</header>

	{#if kabar}
		<p
			data-testid="kabar-insight"
			class="kabar"
			role="status"
			transition:fly={{ y: -12, duration: 250 }}
		>
			<BellRing class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
			<span>
				Insight baru <span class="tw-data text-ink font-semibold">{kabar.ticker}</span>
				{#if kabar.skor !== null}
					dengan skor <span class="tw-data font-semibold {tierDariSkor(kabar.skor).text}"
						>{Math.round(kabar.skor)}</span
					>
				{/if}, watchlist sudah diperbarui.
			</span>
		</p>
	{/if}

	<PilihSaham
		bind:this={pemilih}
		{dipantau}
		{penuh}
		galat={form?.aksi === 'tambah' ? (form?.error ?? '') : ''}
		onselesai={setelahPilih}
	/>

	{#if form?.aksi === 'hapus' && form?.error}
		<p role="alert" class="text-tier-critical flex items-center gap-2 text-[13px]">
			<TriangleAlert class="size-4" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	{#if data.items.length === 0}
		<section class="kosong" aria-labelledby="judul-kosong">
			<div class="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
				<div class="space-y-2.5">
					<h2 id="judul-kosong" class="tw-heading text-ink">Watchlist kamu masih kosong</h2>
					<p
						data-testid="watchlist-kosong"
						class="text-secondary max-w-md text-[14px] leading-relaxed"
					>
						Tambahkan saham pertama lewat kolom cari, atau pilih dari daftar di bawah. TripWire
						langsung mengambil harganya dari Sectors dan memasang cek harian supaya tanda bahayanya
						ikut dipindai.
					</p>
				</div>

				<figure class="contoh">
					<figcaption class="text-muted flex items-center justify-between gap-3 px-1 text-[12px]">
						<span>Begini satu baris nanti terlihat</span>
						<span class="tw-data text-[11px]">contoh, emiten fiktif</span>
					</figcaption>
					<div class="mt-2">
						<BarisSaham
							kode="SIMU"
							nama="Simulasi Utama Tbk."
							tren={contohSeri}
							penutupan={contohPenutupan}
							skor={skorPada(HARI_NOTIFIKASI)}
							tur
						/>
					</div>
					<ul class="keterangan">
						<li>Garis harga sebulan</li>
						<li>Harga penutupan dan perubahannya</li>
						<li>Red Flag Score 0 sampai 100</li>
					</ul>
				</figure>
			</div>

			<div class="mt-7" data-tur="saran">
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div>
						<h3 class="text-ink text-[15px] font-medium">Mulai dari saham terbesar di BEI</h3>
						<p class="text-muted text-[12px]">
							Harga penutupan dan kapitalisasi pasar dari Sectors
						</p>
					</div>
					<button
						type="button"
						data-testid="lihat-semua-saham"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						onclick={() => pemilih?.buka()}
					>
						<List class="size-4" aria-hidden="true" />
						Lihat semua saham
					</button>
				</div>
				<div class="mt-2">
					{#if !teratasSiap}
						<ul class="grid gap-x-6 sm:grid-cols-2" aria-label="Memuat saran saham">
							{#each [0, 1, 2, 3, 4, 5] as urutan (urutan)}
								<li class="kerangka-saran"><span></span><span></span><span></span></li>
							{/each}
						</ul>
					{:else if teratas.length}
						<SaranSaham saham={teratas} {dipantau} {penuh} />
					{:else}
						<div class="flex flex-wrap gap-2 pt-2">
							{#each cadangan as [kode, nama] (kode)}
								<form method="POST" action="?/tambah" use:enhance>
									<input type="hidden" name="ticker" value={kode} />
									<input type="hidden" name="pantau_harian" value="on" />
									<button type="submit" class="chip-cadangan" title="Pantau {nama}">
										<Plus class="size-3" aria-hidden="true" />
										<span class="tw-data text-ink font-semibold">{kode}</span>
										<span class="text-muted hidden sm:inline">{nama}</span>
									</button>
								</form>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</section>
	{:else}
		<div class="grid items-start gap-5 lg:grid-cols-12">
			<div class="min-w-0 space-y-5 lg:col-span-5">
				<TabelWatchlist {baris} terpilih={data.kode} memuat={!trenSiap} />
				<RingkasanPantauan {baris} jadwal={data.schedule} {sekarang} />
			</div>

			<div class="min-w-0 lg:col-span-7">
				{#if terpilih}
					{#key terpilih.item.id}
						<div class="wadah-panel" class:lembar={data.dipilih} {@attach fokusLembar}>
							<PanelEmiten
								item={terpilih.item}
								kutipan={terpilih.kutipan}
								penutupan={terpilih.penutupan}
								risiko={terpilih.risiko}
								jadwal={data.schedule}
								harga={data.harga}
								insights={data.insights}
								galatKondisi={form?.aksi === 'kondisi' ? (form?.error ?? '') : ''}
								galatTampilan={form?.aksi === 'tampilan' ? (form?.error ?? '') : ''}
								bind:tab={tabPanel}
							/>
						</div>
					{/key}
				{/if}
			</div>
		</div>
	{/if}

	<DisclaimerBar />
</section>

<TurWatchlist bind:this={tur} bind:buka={turBuka} langkah={LANGKAH_TUR} onselesai={tandaiTur} />

<style>
	.langsung {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--edge-soft);
		border-radius: 999px;
		padding: 5px 12px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.langsung .titik {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-muted);
	}

	.langsung.aktif {
		color: var(--color-secondary);
	}

	.langsung.aktif .titik {
		background: var(--color-diamond-300);
		box-shadow: 0 0 0 0 rgba(143, 208, 255, 0.6);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		70% {
			box-shadow: 0 0 0 7px rgba(143, 208, 255, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(143, 208, 255, 0);
		}
	}

	.slot {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		border: 1px solid var(--edge-soft);
		border-radius: 999px;
		padding: 5px 12px;
		font-size: 12px;
	}

	.kabar {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 14px;
		background: rgba(20, 28, 46, 0.9);
		padding: 10px 14px;
		font-size: 13px;
		color: var(--color-secondary);
	}

	.kosong {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background:
			radial-gradient(700px 260px at 85% 0%, rgba(74, 158, 255, 0.1), transparent 70%),
			var(--color-base);
		padding: 22px 18px;
	}

	@media (min-width: 640px) {
		.kosong {
			padding: 28px;
		}
	}

	.contoh {
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: rgba(8, 11, 18, 0.5);
		padding: 12px 10px 14px;
	}

	.keterangan {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
		margin-top: 10px;
		padding-inline: 6px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.keterangan li {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.keterangan li::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--color-diamond-300);
	}

	.kerangka-saran {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 70px;
		align-items: center;
		gap: 12px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 12px 2px;
	}

	.kerangka-saran span {
		height: 14px;
		border-radius: 6px;
		background: rgba(180, 205, 255, 0.08);
		animation: denyut-kerangka 1.4s ease-in-out infinite;
	}

	.kerangka-saran span:first-child {
		height: 36px;
		border-radius: 11px;
	}

	@keyframes denyut-kerangka {
		50% {
			opacity: 0.45;
		}
	}

	.chip-cadangan {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 6px 12px;
		font-size: 12.5px;
		color: var(--color-diamond-300);
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	@media (hover: hover) {
		.chip-cadangan:hover {
			border-color: var(--color-diamond-500);
			background: rgba(74, 158, 255, 0.08);
		}
	}

	.wadah-panel {
		display: none;
	}

	.wadah-panel.lembar {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: block;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: rgba(8, 11, 18, 0.78);
		backdrop-filter: blur(8px);
		padding: 12px 8px 24px;
		animation: naik-lembar 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes naik-lembar {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}

	@media (min-width: 1024px) {
		.wadah-panel,
		.wadah-panel.lembar {
			position: sticky;
			top: 84px;
			z-index: auto;
			display: block;
			overflow: visible;
			background: none;
			backdrop-filter: none;
			padding: 0;
			animation: none;
		}
	}
</style>
