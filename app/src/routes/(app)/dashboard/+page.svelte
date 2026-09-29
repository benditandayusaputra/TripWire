<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import {
		ArrowRight,
		ListChecks,
		MailWarning,
		Newspaper,
		Radar,
		ShieldAlert,
		X
	} from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import InsightCard from '$lib/components/InsightCard.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import AlokasiSektor from '$lib/components/dashboard/AlokasiSektor.svelte';
	import ArusAsing from '$lib/components/dashboard/ArusAsing.svelte';
	import DenyutPasar from '$lib/components/dashboard/DenyutPasar.svelte';
	import GrafikIndeks from '$lib/components/dashboard/GrafikIndeks.svelte';
	import HargaKomoditas from '$lib/components/dashboard/HargaKomoditas.svelte';
	import KalenderEmiten from '$lib/components/dashboard/KalenderEmiten.svelte';
	import KinerjaSektor from '$lib/components/dashboard/KinerjaSektor.svelte';
	import KinerjaWatchlist from '$lib/components/dashboard/KinerjaWatchlist.svelte';
	import OrangDalam from '$lib/components/dashboard/OrangDalam.svelte';
	import Panel from '$lib/components/dashboard/Panel.svelte';
	import PanelNotifikasi from '$lib/components/dashboard/PanelNotifikasi.svelte';
	import PenggerakPasar from '$lib/components/dashboard/PenggerakPasar.svelte';
	import PetaPasar from '$lib/components/dashboard/PetaPasar.svelte';
	import PetaRisiko from '$lib/components/dashboard/PetaRisiko.svelte';
	import PitaPasar from '$lib/components/dashboard/PitaPasar.svelte';
	import SorotanEmiten from '$lib/components/dashboard/SorotanEmiten.svelte';
	import StatusBursa from '$lib/components/dashboard/StatusBursa.svelte';
	import TabelWatchlist from '$lib/components/dashboard/TabelWatchlist.svelte';
	import ValuasiSektor from '$lib/components/dashboard/ValuasiSektor.svelte';
	import type { RingkasanInsight } from '$lib/api/notifications';
	import {
		agendaEmiten,
		aktivitasOrangDalam,
		alokasiSektor,
		formatDesimal,
		formatPersen,
		insightPerHari,
		kataArah,
		kelasArah,
		komoditasTerpantau,
		susunBaris,
		valuasiSektor
	} from '$lib/dashboard';
	import { hitungMundur, jamCek, BATAS_WATCHLIST, type Harian } from '$lib/watchlist';
	import type { RingkasanAsing, RingkasanPasar, SeriIndeks } from '$lib/pasar';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';
	import { gerakDikurangi } from '$lib/terlihat';

	let { data } = $props();

	const sekarang = new Date();

	let harga = $state<Record<string, Harian[]>>({});
	let hargaSiap = $state(false);
	let indeks = $state<SeriIndeks | null>(null);
	let indeksSiap = $state(false);
	let pasar = $state<RingkasanPasar | null>(null);
	let pasarSiap = $state(false);
	let asing = $state<RingkasanAsing | null>(null);
	let asingSiap = $state(false);
	let detik = $state(Date.now());

	function tunggu<T>(janji: Promise<T> | T, simpan: (nilai: T | null) => void) {
		let batal = false;
		Promise.resolve(janji)
			.then((nilai) => !batal && simpan(nilai))
			.catch(() => !batal && simpan(null));
		return () => {
			batal = true;
		};
	}

	$effect(() =>
		tunggu(data.harga, (nilai) => {
			harga = nilai ?? {};
			hargaSiap = true;
		})
	);
	$effect(() =>
		tunggu(data.indeks, (nilai) => {
			indeks = nilai;
			indeksSiap = true;
		})
	);
	$effect(() =>
		tunggu(data.pasar, (nilai) => {
			pasar = nilai;
			pasarSiap = true;
		})
	);
	$effect(() =>
		tunggu(data.asing, (nilai) => {
			asing = nilai;
			asingSiap = true;
		})
	);

	const baris = $derived(susunBaris(data.items, data.quotes, data.risk, data.insights, harga));
	const dinilai = $derived(baris.filter((satu) => satu.skor !== null));
	const tertinggi = $derived(dinilai.toSorted((a, b) => (b.skor ?? 0) - (a.skor ?? 0))[0]);
	const perhatian = $derived(dinilai.filter((satu) => (satu.skor ?? 0) >= 61));
	const kritis = $derived(dinilai.filter((satu) => (satu.skor ?? 0) >= 86).length);
	const rataRata = $derived(
		dinilai.length
			? dinilai.reduce((total, satu) => total + (satu.skor ?? 0), 0) / dinilai.length
			: null
	);
	const perHari = $derived(insightPerHari(data.insights, sekarang));
	const puncakHarian = $derived(Math.max(1, ...perHari));
	const insightMingguIni = $derived(perHari.reduce((total, jumlah) => total + jumlah, 0));
	const bergerak = $derived(baris.filter((satu) => typeof satu.penutupan?.ubah === 'number'));
	const ubahWatchlist = $derived(
		bergerak.length
			? bergerak.reduce((total, satu) => total + (satu.penutupan?.ubah ?? 0), 0) / bergerak.length
			: null
	);
	const naikWatchlist = $derived(bergerak.filter((satu) => (satu.penutupan?.ubah ?? 0) > 0).length);
	const turunWatchlist = $derived(
		bergerak.filter((satu) => (satu.penutupan?.ubah ?? 0) < 0).length
	);
	const kondisiAktif = $derived(baris.reduce((total, satu) => total + satu.kondisiAktif.length, 0));
	const dipantau = $derived(data.items.map((item) => item.ticker));
	const penuh = $derived(dipantau.length >= BATAS_WATCHLIST);
	const sektorWatchlist = $derived([
		...new Set(baris.flatMap((satu) => (satu.sektor ? [satu.sektor] : [])))
	]);
	const emailTerverifikasi = $derived(Boolean(data.user?.email_verified_at));
	const belumDibaca = $derived(Number(data.unread ?? 0));

	let pilihanManual = $state<string | null>(null);
	const pilihan = $derived(
		baris.find((satu) => satu.ticker === pilihanManual)?.ticker ??
			tertinggi?.ticker ??
			baris[0]?.ticker ??
			null
	);
	const sorotan = $derived(baris.find((satu) => satu.ticker === pilihan) ?? null);

	const jenis = $derived(page.url.searchParams.get('type') ?? '');
	const feed = $derived(
		jenis ? data.insights.filter((item) => item.insight_type === jenis) : data.insights
	);
	let feedLengkap = $state(false);

	const orangDalam = $derived(aktivitasOrangDalam(baris));
	const agenda = $derived(agendaEmiten(baris, sekarang));
	const valuasi = $derived(valuasiSektor(baris));
	const komoditas = $derived(komoditasTerpantau(baris));
	const alokasi = $derived(alokasiSektor(baris));

	const saringan = $derived([
		{ nilai: '', label: t('Semua', 'All') },
		{ nilai: 'red_flag', label: t('Risiko', 'Risk') },
		{ nilai: 'market_intelligence', label: t('Analisis pasar', 'Market analysis') }
	]);

	function jamLokal(zona: string) {
		try {
			return Number(
				new Intl.DateTimeFormat('en-US', {
					hour: 'numeric',
					hourCycle: 'h23',
					timeZone: zona
				}).format(sekarang)
			);
		} catch {
			return (sekarang.getUTCHours() + 7) % 24;
		}
	}

	const sapaan = $derived.by(() => {
		const jam = jamLokal(data.user?.timezone || 'Asia/Jakarta');
		if (jam < 11) return t('Selamat pagi', 'Good morning');
		if (jam < 15) return t('Selamat siang', 'Good afternoon');
		if (jam < 19) return t('Selamat sore', 'Good afternoon');
		return t('Selamat malam', 'Good evening');
	});

	const kalimat = $derived.by(() => {
		const bagian: string[] = [];
		const [kemarin, terakhir] = indeks?.series.slice(-2) ?? [];
		if (kemarin && terakhir) {
			const ubah = formatPersen(terakhir.price / kemarin.price - 1);
			bagian.push(
				t(
					`IHSG ditutup ${kataArah(ubah.arah)} ${ubah.angka} di ${formatDesimal(terakhir.price)}.`,
					`IHSG closed ${kataArah(ubah.arah)} ${ubah.angka} at ${formatDesimal(terakhir.price)}.`
				)
			);
		}
		if (!baris.length) {
			bagian.push(
				t(
					'Watchlist kamu masih kosong. Tambahkan saham pertama supaya TripWire mulai berjaga.',
					'Your watchlist is empty. Add a first stock so TripWire can start watching.'
				)
			);
		} else if (!tertinggi) {
			bagian.push(
				t(
					`${baris.length} saham dipantau. Skor pertama muncul setelah pemindaian terjadwal berikutnya.`,
					`${baris.length} stocks watched. The first scores appear after the next scheduled scan.`
				)
			);
		} else {
			const puncak = `${tertinggi.ticker} ${bulatkanSkor(tertinggi.skor)}`;
			bagian.push(
				perhatian.length === 0
					? t(
							`Tidak ada saham berskor Tinggi atau Kritis, skor tertinggi ${puncak}.`,
							`No stock scores High or Critical, the highest is ${puncak}.`
						)
					: t(
							`${perhatian.length} dari ${baris.length} saham butuh perhatian, tertinggi ${puncak}.`,
							`${perhatian.length} of ${baris.length} stocks need attention, the highest is ${puncak}.`
						)
			);
		}
		return bagian.join(' ');
	});

	const ubahHariIni = $derived(formatPersen(ubahWatchlist));
	const infoRata = $derived(tierDariSkor(rataRata));
	const namaTier = $derived(
		{
			low: t('Rendah', 'Low'),
			moderate: t('Sedang', 'Moderate'),
			high: t('Tinggi', 'High'),
			critical: t('Kritis', 'Critical')
		}[infoRata.tier]
	);

	function pilih(ticker: string) {
		pilihanManual = ticker;
		const panel = document.getElementById('sorotan');
		if (panel && matchMedia('(max-width: 1023px)').matches) {
			panel.scrollIntoView({ behavior: gerakDikurangi() ? 'auto' : 'smooth', block: 'start' });
		}
	}

	let kabar = $state<RingkasanInsight | null>(null);
	let dikenal: string | null = null;
	let tundaKabar: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		dikenal = presenceStore.insightBaru[0]?.notification_id ?? null;
		presenceStore.sambung();
		const detak = setInterval(() => (detik = Date.now()), 30_000);
		return () => {
			presenceStore.putus();
			clearInterval(detak);
			clearTimeout(tundaKabar);
		};
	});

	$effect(() => {
		const terbaru = presenceStore.insightBaru[0];
		if (!terbaru || terbaru.notification_id === dikenal) return;
		dikenal = terbaru.notification_id;
		kabar = terbaru;
		clearTimeout(tundaKabar);
		tundaKabar = setTimeout(() => (kabar = null), 9000);
		if (!navigating.to) invalidateAll();
	});

	function judulKabar(item: RingkasanInsight) {
		if (item.insight_type === 'red_flag')
			return t('Risiko tata kelola diperbarui', 'Governance risk updated');
		if (item.subtype === 'mining_deep_dive')
			return t('Analisis tambang diperbarui', 'Mining analysis updated');
		return t('Perbandingan sektor diperbarui', 'Sector comparison updated');
	}
</script>

<svelte:head>
	<title>{t('Dashboard TripWire', 'TripWire Dashboard')}</title>
</svelte:head>

<section class="space-y-5">
	<header class="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
		<div class="space-y-2">
			<p class="tw-overline flex items-center gap-2">
				{sapaan}
				<span
					data-testid="status-live"
					data-terhubung={presenceStore.terhubung}
					class="langsung"
					class:aktif={presenceStore.terhubung}
				>
					<span class="titik-langsung" aria-hidden="true"></span>
					{presenceStore.terhubung ? t('Langsung', 'Live') : t('Menyambungkan', 'Connecting')}
				</span>
			</p>
			<h1 data-testid="dashboard-heading" class="tw-title text-ink">{data.user?.full_name}</h1>
			<p
				data-testid="kalimat-ringkas"
				class="text-secondary max-w-3xl text-[14.5px] leading-relaxed"
			>
				{kalimat}
			</p>
		</div>
		<StatusBursa />
	</header>

	<PitaPasar ihsg={indeks} {baris} />

	{#if !emailTerverifikasi}
		<div
			data-testid="email-belum-verifikasi"
			class="rounded-glass border-diamond-700 bg-diamond-900/40 flex items-start gap-3 border px-4 py-3.5"
		>
			<MailWarning class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
			<p class="text-secondary text-[13.5px]">
				{t(
					'Email kamu belum diverifikasi. Cek kotak masuk untuk mengaktifkan notifikasi insight.',
					'Your email is not verified yet. Check your inbox to turn on insight alerts.'
				)}
			</p>
		</div>
	{/if}

	<dl data-testid="ringkasan" class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
		<div class="kpi">
			<dt class="label-kpi">{t('Watchlist hari ini', 'Watchlist today')}</dt>
			<dd class="nilai-kpi {kelasArah(ubahHariIni.arah)}">{ubahHariIni.teks}</dd>
			<dd class="sub-kpi">
				{#if bergerak.length}
					<span class="text-naik">▲ {naikWatchlist}</span>
					<span class="text-turun">▼ {turunWatchlist}</span>
					<span>{t('rata rata harian', 'average daily move')}</span>
				{:else}
					{t('Menunggu harga penutupan', 'Waiting for closing prices')}
				{/if}
			</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">{t('Saham dipantau', 'Stocks watched')}</dt>
			<dd class="nilai-kpi">
				{baris.length}<span class="text-muted ml-1.5 text-[13px]">/ {BATAS_WATCHLIST}</span>
			</dd>
			<dd class="sub-kpi">
				{t(`${kondisiAktif} kondisi pemicu aktif`, `${kondisiAktif} active triggers`)}
			</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">{t('Skor rata rata', 'Average score')}</dt>
			<dd class="nilai-kpi flex items-baseline gap-2">
				{rataRata === null ? '-' : bulatkanSkor(rataRata)}
				{#if rataRata !== null}
					<span class="font-sans text-[12px] font-medium {infoRata.text}">{namaTier}</span>
				{/if}
			</dd>
			<dd class="skala" aria-hidden="true">
				<span class="bg-tier-low"></span>
				<span class="bg-tier-moderate"></span>
				<span class="bg-tier-high"></span>
				<span class="bg-tier-critical"></span>
				{#if rataRata !== null}
					<span class="jarum" style="left:{rataRata}%"></span>
				{/if}
			</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">{t('Butuh perhatian', 'Need attention')}</dt>
			<dd class="nilai-kpi {kritis ? 'text-tier-critical' : ''}">{perhatian.length}</dd>
			<dd class="sub-kpi">
				{t(
					`${kritis} kritis, ${perhatian.length - kritis} tinggi`,
					`${kritis} critical, ${perhatian.length - kritis} high`
				)}
			</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">{t('Insight 7 hari', 'Insights, 7 days')}</dt>
			<dd class="flex items-end justify-between gap-3">
				<span class="nilai-kpi">{insightMingguIni}</span>
				<span class="batang" aria-hidden="true">
					{#each perHari as jumlah, urutan (urutan)}
						<span
							class={urutan === perHari.length - 1 ? 'bg-diamond-500' : 'bg-secondary/35'}
							style="height:{Math.max(8, (jumlah / puncakHarian) * 100)}%"
						></span>
					{/each}
				</span>
			</dd>
			<dd class="sub-kpi">{t(`${perHari.at(-1)} insight hari ini`, `${perHari.at(-1)} today`)}</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">{t('Belum dibaca', 'Unread alerts')}</dt>
			<dd class="nilai-kpi">{belumDibaca}</dd>
			<dd class="sub-kpi">
				<a href="/notifications" class="text-diamond-300 hover:text-diamond-100 transition"
					>{t('Buka notifikasi', 'Open alerts')}</a
				>
			</dd>
		</div>
	</dl>

	<div class="grid gap-5 lg:grid-cols-12">
		<GrafikIndeks ihsg={indeks} memuat={!indeksSiap} class="lg:col-span-8" />
		<DenyutPasar {pasar} memuat={!pasarSiap} class="lg:col-span-4" />
	</div>

	{#if baris.length === 0}
		<section data-testid="mulai" class="mulai">
			<div class="max-w-2xl space-y-3">
				<h2 class="tw-heading text-ink">{t('Mulai dari satu saham', 'Start with one stock')}</h2>
				<p class="text-secondary text-[14.5px] leading-relaxed">
					{t(
						'Pilih saham dari daftar lengkap BEI di halaman Watchlist, atau tekan tombol plus di Penggerak pasar. TripWire lalu menghitung Red Flag Score dan mengabari kamu begitu skornya melewati batas.',
						'Pick a stock from the full IDX list on the Watchlist page, or press the plus button in Market movers. TripWire then computes the Red Flag Score and alerts you once it crosses your threshold.'
					)}
				</p>
			</div>
			<a href="/watchlist" class="tw-primary mt-5 px-4 py-2.5 text-[14px]">
				<ListChecks class="size-4" aria-hidden="true" />
				{t('Buka watchlist', 'Open watchlist')}
				<ArrowRight class="size-4" aria-hidden="true" />
			</a>
			<ol class="text-secondary mt-6 grid gap-3 text-[13px] sm:grid-cols-3">
				{#each [t('Tambahkan saham ke watchlist', 'Add stocks to your watchlist'), t('Atur kondisi pemicu', 'Set trigger conditions'), t('Terima notifikasi saat skor naik', 'Get alerted when scores rise')] as langkah, urutan (langkah)}
					<li class="flex items-center gap-2.5">
						<span class="nomor">{urutan + 1}</span>
						{langkah}
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<div class="grid items-start gap-5 lg:grid-cols-12">
			<div class="contents lg:col-span-8 lg:block lg:min-w-0 lg:space-y-5">
				<Panel
					judul="Watchlist"
					keterangan={t(
						`${baris.length} saham, harga penutupan terakhir dari Sectors`,
						`${baris.length} stocks, latest closing prices from Sectors`
					)}
					ikon={ListChecks}
					testid="panel-watchlist"
					class="order-1"
				>
					{#snippet aksi()}
						<a
							href="/watchlist"
							class="text-diamond-300 hover:text-diamond-100 inline-flex items-center gap-1 text-[12.5px] font-medium transition"
						>
							{t('Kelola', 'Manage')}
							<ArrowRight class="size-3.5" aria-hidden="true" />
						</a>
					{/snippet}
					<TabelWatchlist {baris} {pilihan} onpilih={pilih} memuat={!hargaSiap} />
				</Panel>
				<KinerjaWatchlist {baris} ihsg={indeks} memuat={!hargaSiap} {pilihan} class="order-3" />
			</div>

			<div
				id="sorotan"
				class="order-2 min-w-0 scroll-mt-24 lg:sticky lg:top-20 lg:order-0 lg:col-span-4"
			>
				<Panel
					judul={t('Sorotan saham', 'Stock spotlight')}
					keterangan={t(
						'Pilih baris di watchlist untuk berganti saham',
						'Pick a watchlist row to switch'
					)}
					ikon={Radar}
				>
					{#if sorotan}
						{#key sorotan.ticker}
							<SorotanEmiten baris={sorotan} memuat={!hargaSiap} />
						{/key}
					{/if}
				</Panel>
			</div>
		</div>
	{/if}

	<div class="grid gap-5 md:grid-cols-2 lg:grid-cols-12">
		<PenggerakPasar {pasar} memuat={!pasarSiap} {dipantau} {penuh} class="lg:col-span-4" />
		<ArusAsing {asing} memuat={!asingSiap} {dipantau} class="lg:col-span-4" />
		<KinerjaSektor
			{pasar}
			memuat={!pasarSiap}
			{sektorWatchlist}
			class="md:col-span-2 lg:col-span-4"
		/>
	</div>

	<div class="grid gap-5 lg:grid-cols-12">
		<div class="flex min-w-0 flex-col gap-5 lg:col-span-8">
			<PetaPasar {pasar} memuat={!pasarSiap} {dipantau} />
			<Panel
				judul={t('Insight terbaru', 'Latest insights')}
				keterangan={t(
					'Dari seluruh watchlist, bersegel digital',
					'Across your watchlist, digitally signed'
				)}
				ikon={Newspaper}
				mengisi
				class="flex-1"
			>
				{#snippet aksi()}
					<nav class="flex gap-1" aria-label={t('Saring insight', 'Filter insights')}>
						{#each saringan as item (item.nilai)}
							<a
								href={item.nilai ? `/dashboard?type=${item.nilai}` : '/dashboard'}
								data-testid="saring-{item.nilai || 'semua'}"
								data-sveltekit-noscroll
								data-sveltekit-replacestate
								aria-current={jenis === item.nilai ? 'page' : undefined}
								class="rounded-glass-sm px-2.5 py-1.5 text-[12.5px] font-medium transition {jenis ===
								item.nilai
									? 'bg-diamond-500/12 text-diamond-100'
									: 'text-secondary hover:text-ink'}"
							>
								{item.label}
							</a>
						{/each}
					</nav>
				{/snippet}

				{#if feed.length === 0}
					<div class="border-line flex items-start gap-3 rounded-xl border border-dashed px-4 py-5">
						<Radar class="text-muted mt-0.5 size-4 flex-none" aria-hidden="true" />
						<p data-testid="feed-kosong" class="tw-caption">
							{#if baris.length === 0}
								{t(
									'Belum ada insight. Tambahkan saham ke watchlist dulu, lalu kondisi pemicunya.',
									'No insights yet. Add stocks to your watchlist first, then their trigger conditions.'
								)}
							{:else}
								{t(
									'Belum ada insight untuk saringan ini. Insight muncul setelah pemindaian terjadwal berikutnya.',
									'No insights for this filter yet. They appear after the next scheduled scan.'
								)}
							{/if}
						</p>
					</div>
				{:else}
					<div class="gulir-feed">
						<ul
							data-testid="feed-insight"
							class="feed divide-line/60 -mx-3 -my-1 divide-y"
							class:lengkap={feedLengkap}
						>
							{#each feed as insight (insight.id)}
								<li><InsightCard {insight} /></li>
							{/each}
						</ul>
					</div>
					{#if feed.length > 8}
						<button
							type="button"
							onclick={() => (feedLengkap = !feedLengkap)}
							class="text-diamond-300 hover:text-diamond-100 mt-3 text-[13px] font-medium transition lg:hidden"
						>
							{feedLengkap
								? t('Tampilkan lebih sedikit', 'Show fewer')
								: t(`Tampilkan semua ${feed.length} insight`, `Show all ${feed.length} insights`)}
						</button>
					{/if}
				{/if}
			</Panel>
		</div>

		<div class="min-w-0 space-y-5 lg:col-span-4">
			{#if baris.length}
				<Panel
					judul={t('Peta risiko', 'Risk map')}
					keterangan={t(
						'Sebaran Red Flag Score di watchlist',
						'Red Flag Score across your watchlist'
					)}
					ikon={ShieldAlert}
					testid="panel-risiko"
				>
					<PetaRisiko {baris} {pilihan} onpilih={pilih} />
					{#if data.schedule.next_scan_at}
						<dl data-testid="jadwal-pindai" class="jadwal">
							{#if data.schedule.last_scan_at}
								<div>
									<dt>{t('Pemindaian terakhir', 'Last scan')}</dt>
									<dd>{jamCek(data.schedule.last_scan_at)}</dd>
								</div>
							{/if}
							<div>
								<dt>{t('Pemindaian berikutnya', 'Next scan')}</dt>
								<dd>
									{jamCek(data.schedule.next_scan_at)}
									<span class="text-muted">{hitungMundur(data.schedule.next_scan_at, detik)}</span>
								</dd>
							</div>
						</dl>
					{/if}
				</Panel>
			{/if}
			<PanelNotifikasi notifikasi={data.notifications} belum={belumDibaca} />
			{#if orangDalam.length}
				<OrangDalam aktivitas={orangDalam} />
			{/if}
			{#if agenda.length}
				<KalenderEmiten {agenda} {sekarang} />
			{/if}
		</div>
	</div>

	{#if valuasi.length || komoditas.length || alokasi.some((satu) => satu.nama)}
		<div class="grid items-start gap-5 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
			{#if valuasi.length}
				<ValuasiSektor {valuasi} />
			{/if}
			{#if komoditas.length}
				<HargaKomoditas {komoditas} />
			{/if}
			{#if alokasi.some((satu) => satu.nama)}
				<AlokasiSektor {alokasi} total={baris.length} />
			{/if}
		</div>
	{/if}

	<DisclaimerBar />
</section>

{#if kabar}
	<div
		role="status"
		data-testid="kabar-insight"
		class="kabar"
		in:fly={{ y: 24, duration: 320 }}
		out:fly={{ y: 16, duration: 220 }}
	>
		<SkorBadge skor={kabar.score} showLabel={false} />
		<div class="min-w-0 flex-1">
			<p class="text-ink text-[13px] font-semibold">
				{t(`Insight baru, ${kabar.ticker}`, `New insight, ${kabar.ticker}`)}
			</p>
			<p class="text-secondary truncate text-[12px]">{judulKabar(kabar)}</p>
		</div>
		<a
			href="/insights/{kabar.insight_id}"
			class="text-diamond-300 hover:text-diamond-100 text-[12.5px] font-medium"
			>{t('Buka', 'Open')}</a
		>
		<button
			type="button"
			onclick={() => (kabar = null)}
			aria-label={t('Tutup kabar insight', 'Dismiss insight alert')}
			class="text-muted hover:text-ink grid size-7 place-items-center rounded-md transition"
		>
			<X class="size-3.5" aria-hidden="true" />
		</button>
	</div>
{/if}

<style>
	.langsung {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		letter-spacing: normal;
		text-transform: none;
		color: var(--color-muted);
	}

	.titik-langsung {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-muted);
	}

	.langsung.aktif {
		color: var(--color-secondary);
	}

	.langsung.aktif .titik-langsung {
		background: var(--color-diamond-300);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-diamond-300) 60%, transparent);
		}
		70%,
		100% {
			box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-diamond-300) 0%, transparent);
		}
	}

	.kpi {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		padding: 14px 16px;
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	@media (hover: hover) {
		.kpi:hover {
			border-color: var(--edge-strong);
			transform: translateY(-2px);
		}
	}

	.label-kpi {
		font-size: 12.5px;
		color: var(--color-secondary);
	}

	.nilai-kpi {
		font-family: var(--font-mono);
		font-size: 24px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
		white-space: nowrap;
		color: var(--color-ink);
	}

	.nilai-kpi.text-naik {
		color: var(--color-naik);
	}

	.nilai-kpi.text-turun {
		color: var(--color-turun);
	}

	.sub-kpi {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 8px;
		margin-top: auto;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.skala {
		position: relative;
		display: grid;
		grid-template-columns: 30fr 30fr 25fr 15fr;
		gap: 2px;
		height: 4px;
		margin-top: auto;
	}

	.skala > span:not(.jarum) {
		border-radius: 2px;
		opacity: 0.55;
	}

	.jarum {
		position: absolute;
		top: 50%;
		width: 10px;
		height: 10px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}

	.batang {
		display: flex;
		height: 30px;
		align-items: flex-end;
		gap: 3px;
	}

	.batang span {
		width: 6px;
		border-radius: 2px 2px 0 0;
	}

	.mulai {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background:
			radial-gradient(
				640px 260px at 85% 0%,
				color-mix(in srgb, var(--color-diamond-500) 14%, transparent),
				transparent 70%
			),
			var(--color-base);
		padding: 28px 20px;
	}

	@media (min-width: 640px) {
		.mulai {
			padding: 32px;
		}
	}

	.nomor {
		display: inline-grid;
		width: 24px;
		height: 24px;
		flex: none;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-diamond-300);
	}

	@media (max-width: 1023.98px) {
		.feed:not(.lengkap) > li:nth-child(n + 9) {
			display: none;
		}
	}

	@media (min-width: 1024px) {
		.gulir-feed {
			min-height: 320px;
			flex: 1 1 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			overflow-x: hidden;
			margin-inline: -12px;
			padding: 4px 12px 12px;
			mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
		}
	}

	.jadwal {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-top: 16px;
		border-top: 1px solid var(--edge-soft);
		padding-top: 14px;
	}

	.jadwal dt {
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.jadwal dd {
		margin-top: 2px;
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--color-ink);
	}

	.jadwal dd span {
		display: block;
		font-size: 11px;
	}

	.kabar {
		position: fixed;
		right: 16px;
		bottom: 84px;
		left: 16px;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid color-mix(in srgb, var(--color-diamond-300) 28%, transparent);
		border-radius: 14px;
		background: var(--color-raised);
		padding: 10px 10px 10px 14px;
		box-shadow: 0 24px 50px -20px var(--bayang);
	}

	@media (min-width: 640px) {
		.kabar {
			bottom: 24px;
			left: auto;
			width: 380px;
		}
	}
</style>
