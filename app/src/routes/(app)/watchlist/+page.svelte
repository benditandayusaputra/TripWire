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
	import { bahasa, t } from '$lib/bahasa.svelte';
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

	const LANGKAH_TUR = $derived<LangkahTur[]>([
		{
			judul: t('Ini watchlist kamu', 'This is your watchlist'),
			isi: t(
				'Daftar saham yang kamu minta TripWire jaga. Setiap hari TripWire membaca data saham ini dari Sectors dan mencari tanda bahaya, misalnya orang dalam yang ramai menjual atau saham yang pernah dihentikan bursa.',
				'The stocks you asked TripWire to watch. Every day TripWire reads their data from Sectors and looks for red flags, such as insiders selling heavily or a stock that has had a trading suspension.'
			)
		},
		{
			target: '[data-tur="cari"]',
			judul: t('Tambah saham dari sini', 'Add stocks from here'),
			isi: t(
				'Klik untuk membuka daftar semua saham BEI lengkap dengan harga dari Sectors. Cari lewat kode atau nama, saring per sektor, lalu tekan Pantau. Beberapa saham bisa ditambah sekaligus.',
				'Click to open the full list of IDX stocks with prices from Sectors. Search by ticker or name, filter by sector, then press Watch. You can add several stocks at once.'
			)
		},
		{
			target: '[data-tur="baris"]',
			judul: t('Cara membaca satu baris', 'How to read a row'),
			isi: t(
				'Dari kiri: kode dan nama saham, garis harga sebulan terakhir, lalu harga penutupan dan perubahannya. Hijau dengan ▲ berarti naik, merah dengan ▼ berarti turun.',
				'From the left: the ticker and company name, the price line for the past month, then the closing price and its change. Green with ▲ means up, red with ▼ means down.'
			)
		},
		{
			target: '[data-tur="skor"]',
			judul: t('Lingkaran ini Red Flag Score', 'This ring is the Red Flag Score'),
			isi: t(
				'Skor 0 sampai 100 dari tiga sinyal tata kelola. Makin tinggi, makin banyak tanda bahaya: Rendah sampai 30, Sedang sampai 60, Tinggi sampai 85, lalu Kritis. Ikon jam pasir berarti saham itu belum dipindai.',
				'A score from 0 to 100 built from three governance signals. The higher it is, the more red flags: Low up to 30, Moderate up to 60, High up to 85, then Critical. An hourglass icon means the stock has not been scanned yet.'
			)
		},
		{
			target: '[data-tur="saran"]',
			judul: t('Belum tahu mulai dari mana?', 'Not sure where to start?'),
			isi: t(
				'Ini saham dengan kapitalisasi terbesar di BEI menurut Sectors. Tekan Pantau dan saham itu langsung masuk watchlist dengan cek harian.',
				'These are the largest stocks by market cap on the IDX, according to Sectors. Press Watch and the stock goes straight into your watchlist with a daily check.'
			)
		},
		{
			target: '[data-tur="detail"]',
			judul: t('Detail setiap saham', 'Details for each stock'),
			isi: t(
				'Pilih satu baris untuk melihat detailnya. Tab Harga berisi grafik tiga bulan, tab Risiko berisi alasan di balik skor, dan tab Pemantauan untuk mengatur kapan TripWire memeriksa serta mengabarimu.',
				'Select a row to see its details. The Price tab has a three-month chart, the Risk tab explains the reasons behind the score, and the Monitoring tab lets you set when TripWire checks and alerts you.'
			)
		},
		{
			target: '[data-tur="kabar"]',
			judul: t('Kabar datang ke sini', 'Updates land here'),
			isi: t(
				'Begitu skor melewati batas yang kamu atur, notifikasi masuk ke menu ini lengkap dengan alasannya. Notifikasi push ke HP bisa dinyalakan di halaman Notifikasi.',
				'Once a score crosses the threshold you set, an alert lands in this menu along with the reasons. Push alerts to your phone can be turned on from the Alerts page.'
			)
		}
	]);

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
	<title>{t('Watchlist TripWire', 'TripWire Watchlist')}</title>
</svelte:head>

<svelte:window onkeydown={pintasan} />

<section class="space-y-5">
	<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		<div class="max-w-2xl space-y-1.5">
			<h1 class="tw-title text-ink">Watchlist</h1>
			<p class="text-secondary text-[14px] leading-relaxed">
				{t(
					'Saham yang kamu minta TripWire jaga. Harganya dari Sectors, dan setiap saham dipindai otomatis untuk mencari tanda bahaya tata kelola sebelum terlihat di harga.',
					'Stocks you asked TripWire to watch. Prices come from Sectors, and every stock is scanned automatically for governance red flags before they show up in the price.'
				)}
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
				{t('Cara pakai', 'How it works')}
			</button>
			<p
				data-testid="status-langsung"
				data-terhubung={presenceStore.terhubung}
				class="langsung"
				class:aktif={presenceStore.terhubung}
			>
				<span class="titik" aria-hidden="true"></span>
				{presenceStore.terhubung
					? t('Pembaruan langsung', 'Live updates')
					: t('Menyambungkan', 'Connecting')}
			</p>
			<p
				class="slot"
				title={t(
					`Batas watchlist ${BATAS_WATCHLIST} saham`,
					`Watchlist limit: ${BATAS_WATCHLIST} stocks`
				)}
			>
				<span class="tw-data text-ink">{data.items.length}</span>
				<span class="text-muted"
					>{t(`dari ${BATAS_WATCHLIST} saham`, `of ${BATAS_WATCHLIST} stocks`)}</span
				>
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
				{#if bahasa() === 'en'}
					New insight for <span class="tw-data text-ink font-semibold">{kabar.ticker}</span
					>{#if kabar.skor !== null}{' '}with a score of
						<span class="tw-data font-semibold {tierDariSkor(kabar.skor).text}"
							>{Math.round(kabar.skor)}</span
						>{/if}. Your watchlist has been updated.
				{:else}
					Insight baru <span class="tw-data text-ink font-semibold">{kabar.ticker}</span>
					{#if kabar.skor !== null}
						dengan skor <span class="tw-data font-semibold {tierDariSkor(kabar.skor).text}"
							>{Math.round(kabar.skor)}</span
						>
					{/if}, watchlist sudah diperbarui.
				{/if}
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
					<h2 id="judul-kosong" class="tw-heading text-ink">
						{t('Watchlist kamu masih kosong', 'Your watchlist is empty')}
					</h2>
					<p
						data-testid="watchlist-kosong"
						class="text-secondary max-w-md text-[14px] leading-relaxed"
					>
						{t(
							'Tambahkan saham pertama lewat kolom cari, atau pilih dari daftar di bawah. TripWire langsung mengambil harganya dari Sectors dan memasang cek harian supaya tanda bahayanya ikut dipindai.',
							'Add your first stock with the search box, or pick one from the list below. TripWire pulls its price from Sectors right away and sets up a daily check so its red flags get scanned too.'
						)}
					</p>
				</div>

				<figure class="contoh">
					<figcaption class="text-muted flex items-center justify-between gap-3 px-1 text-[12px]">
						<span>{t('Begini satu baris nanti terlihat', 'This is how a row will look')}</span>
						<span class="tw-data text-[11px]"
							>{t('contoh, emiten fiktif', 'example, fictional company')}</span
						>
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
						<li>{t('Garis harga sebulan', 'One-month price line')}</li>
						<li>{t('Harga penutupan dan perubahannya', 'Closing price and its change')}</li>
						<li>{t('Red Flag Score 0 sampai 100', 'Red Flag Score from 0 to 100')}</li>
					</ul>
				</figure>
			</div>

			<div class="mt-7" data-tur="saran">
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div>
						<h3 class="text-ink text-[15px] font-medium">
							{t('Mulai dari saham terbesar di BEI', 'Start with the largest stocks on the IDX')}
						</h3>
						<p class="text-muted text-[12px]">
							{t(
								'Harga penutupan dan kapitalisasi pasar dari Sectors',
								'Closing prices and market cap from Sectors'
							)}
						</p>
					</div>
					<button
						type="button"
						data-testid="lihat-semua-saham"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						onclick={() => pemilih?.buka()}
					>
						<List class="size-4" aria-hidden="true" />
						{t('Lihat semua saham', 'See all stocks')}
					</button>
				</div>
				<div class="mt-2">
					{#if !teratasSiap}
						<ul
							class="grid gap-x-6 sm:grid-cols-2"
							aria-label={t('Memuat saran saham', 'Loading stock suggestions')}
						>
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
									<button
										type="submit"
										class="chip-cadangan"
										title={t(`Pantau ${nama}`, `Watch ${nama}`)}
									>
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
		box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-diamond-300) 60%, transparent);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		70% {
			box-shadow: 0 0 0 7px transparent;
		}
		100% {
			box-shadow: 0 0 0 0 transparent;
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
		border: 1px solid color-mix(in srgb, var(--color-diamond-300) 28%, transparent);
		border-radius: 14px;
		background: color-mix(in srgb, var(--color-raised) 90%, transparent);
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
		background: color-mix(in srgb, var(--color-void) 50%, transparent);
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
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
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
		background: var(--tirai);
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
