<script lang="ts">
	import {
		Ban,
		BellRing,
		ChartPie,
		Database,
		FileCheck2,
		Pickaxe,
		Plus,
		Radar,
		Search,
		ShieldCheck,
		UserMinus
	} from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import Logo from '$lib/components/Logo.svelte';
	import SignatureBadge from '$lib/components/SignatureBadge.svelte';
	import Preferensi from '$lib/components/Preferensi.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import ReplayTerminal from '$lib/components/beranda/ReplayTerminal.svelte';
	import SkorGauge from '$lib/components/beranda/SkorGauge.svelte';
	import { subSkor, tanggal, TICKER } from '$lib/components/beranda/simulasi';
	import { tierDariSkor } from '$lib/skor';
	import { emiten } from '$lib/emiten';
	import { lokal, t } from '$lib/bahasa.svelte';
	import { terlihat } from '$lib/terlihat';

	const penjelasanSinyal = $derived({
		'orang-dalam': {
			ikon: UserMinus,
			teks: t(
				'Direksi, komisaris, atau pemegang saham besar yang menjual dalam 30 hari terakhir. Makin banyak orangnya, makin tinggi.',
				'Directors, commissioners, or major shareholders who sold in the last 30 days. The more people selling, the higher the score.'
			)
		},
		kepemilikan: {
			ikon: ChartPie,
			teks: t(
				'Porsi saham seorang pemegang besar yang berubah dalam 90 hari, dibaca dari laporan keterbukaan informasi.',
				"A major shareholder's stake that changed within 90 days, read from disclosure reports."
			)
		},
		suspensi: {
			ikon: Ban,
			teks: t(
				'Seberapa sering, seberapa baru, dan seberapa serius bursa pernah menghentikan perdagangan sahamnya.',
				'How often, how recently, and how seriously the exchange has suspended trading in the stock.'
			)
		}
	});

	const bacaan = $derived([
		{
			ikon: UserMinus,
			nama: t('Orang dalam', 'Insiders'),
			nilai: 100,
			hasil: t('5 orang menjual', '5 people sold')
		},
		{
			ikon: ChartPie,
			nama: t('Kepemilikan', 'Ownership'),
			nilai: 80,
			hasil: t('berubah 8 poin', 'changed 8 points')
		},
		{
			ikon: Ban,
			nama: t('Suspensi', 'Suspension'),
			nilai: 20,
			hasil: t('1 kali, 2 tahun lalu', 'once, 2 years ago')
		}
	]);

	const valuasi = [
		{ nama: 'PER', emiten: 7.8, subsektor: 11.2 },
		{ nama: 'PBV', emiten: 1.6, subsektor: 1.3 },
		{ nama: 'PSR', emiten: 0.9, subsektor: 1.1 }
	].map((item) => ({ ...item, selisih: ((item.emiten - item.subsektor) / item.subsektor) * 100 }));

	const izin = $derived([
		{ nama: t('IUP Blok Utara', 'North Block IUP'), bulan: 7 },
		{ nama: t('IUP Blok Selatan', 'South Block IUP'), bulan: 19 },
		{ nama: t('IUP Eksplorasi', 'Exploration IUP'), bulan: 31 }
	]);

	const rantai = [
		{ hari: 19, skor: 54, hash: '3b9f 11d0 a4c2', sebelumnya: '0e57 c8a1 9f30' },
		{ hari: 25, skor: 75, hash: '7c1e 9a2f 03bd', sebelumnya: '3b9f 11d0 a4c2' },
		{ hari: 30, skor: 91, hash: 'c04a 6e18 d7f5', sebelumnya: '7c1e 9a2f 03bd' }
	];

	const desimal = $derived(
		new Intl.NumberFormat(lokal(), {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		})
	);
	const tglRantai = (hari: number) =>
		tanggal[hari].toLocaleDateString(lokal(), {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			timeZone: 'UTC'
		});

	let sorotBlok = $state<number | null>(null);
</script>

<svelte:head>
	<title
		>{t(
			'TripWire: red flag saham IDX terdeteksi sebelum jadi berita',
			'TripWire: IDX stock red flags detected before they make the news'
		)}</title
	>
	<meta
		name="description"
		content={t(
			'TripWire memantau saham IDX pilihanmu setiap hari, menggabungkan transaksi orang dalam, perubahan kepemilikan, dan riwayat suspensi jadi satu skor risiko, lalu mengabari kamu begitu skornya melewati batas.',
			'TripWire monitors the IDX stocks you pick every day, combines insider transactions, ownership changes, and suspension history into one risk score, then alerts you as soon as the score crosses your threshold.'
		)}
	/>
</svelte:head>

<header class="border-line/70 bg-void/75 sticky top-0 z-40 border-b backdrop-blur-xl">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
		<Wordmark />
		<nav class="hidden items-center gap-1 md:flex" aria-label={t('Utama', 'Main')}>
			<a href="#cara-kerja" class="tautan-nav">{t('Cara kerja', 'How it works')}</a>
			<a href="#skor" class="tautan-nav">Red Flag Score</a>
			<a href="#intelijen" class="tautan-nav">Market Intelligence</a>
			<a href="/verify-insight" data-testid="nav-verifikasi" class="tautan-nav"
				>{t('Verifikasi insight', 'Verify insight')}</a
			>
		</nav>
		<div class="flex items-center gap-2">
			<Preferensi />
			<a href="/login" class="tw-ghost px-3.5 py-2 text-[14px]">{t('Masuk', 'Log in')}</a>
			<a href="/register" class="tw-primary px-4 py-2 text-[14px]">{t('Daftar', 'Sign up')}</a>
		</div>
	</div>
</header>

<main>
	<section class="relative isolate overflow-hidden">
		<div class="latar" aria-hidden="true"></div>
		<div
			class="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 sm:pt-14 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:pt-16 lg:pb-20"
		>
			<div class="space-y-7 lg:col-span-5">
				<h1 class="judul-hero text-ink masuk">
					{t(
						'Red flag saham terdeteksi sebelum jadi berita.',
						'Stock red flags detected before they make the news.'
					)}
				</h1>

				<p
					class="text-secondary masuk max-w-xl text-[17px] leading-relaxed sm:text-[18px]"
					style="--urut:1"
				>
					{t(
						'TripWire memantau saham IDX pilihanmu setiap hari. Transaksi orang dalam, perubahan pemegang saham besar, dan riwayat suspensi digabung jadi satu skor risiko, lalu kamu dikabari begitu skornya melewati batas.',
						'TripWire monitors the IDX stocks you pick every day. Insider transactions, changes among major shareholders, and suspension history are combined into one risk score, and you get an alert as soon as the score crosses your threshold.'
					)}
				</p>

				<div class="masuk grid gap-3 sm:flex sm:flex-wrap" style="--urut:2">
					<a href="/register" class="tw-primary cta-utama px-5 py-3">
						<BellRing class="lonceng size-4" aria-hidden="true" />
						{t('Mulai pantau gratis', 'Start monitoring for free')}
					</a>
					<a href="#cara-kerja" class="tw-ghost px-5 py-3"
						>{t('Lihat cara kerjanya', 'See how it works')}</a
					>
				</div>

				<ul
					class="masuk text-secondary flex flex-wrap gap-x-5 gap-y-2.5 text-[14px]"
					style="--urut:3"
				>
					<li class="flex items-center gap-2">
						<Radar class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
						{t('Lebih dari 950 emiten IDX', 'More than 950 IDX stocks')}
					</li>
					<li class="flex items-center gap-2">
						<Database class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
						{t('Data dari Sectors', 'Data from Sectors')}
					</li>
					<li class="flex items-center gap-2">
						<ShieldCheck class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
						{t('Insight bersegel digital', 'Digitally sealed insights')}
					</li>
				</ul>
			</div>

			<div class="masuk min-w-0 space-y-3 lg:col-span-7" style="--urut:2">
				<ReplayTerminal />
				<p class="text-muted px-1 text-[12.5px] leading-relaxed">
					{t(
						'Simulasi dengan emiten fiktif. Urutan skornya dihitung dengan formula Red Flag Score yang sama dengan yang dipakai TripWire. Arahkan kursor atau sentuh grafik untuk melihat angka per hari.',
						'A simulation with a fictional company. Its score sequence is calculated with the same Red Flag Score formula TripWire uses. Hover over or tap the chart to see the numbers for each day.'
					)}
				</p>
			</div>
		</div>
	</section>

	<section
		aria-label={t('Emiten yang bisa dipantau', 'Stocks you can monitor')}
		class="pita border-line bg-base/60 border-y"
	>
		<p class="label-pita text-secondary text-[13px]">
			<span class="denyut-hijau" aria-hidden="true"></span>
			{t('Bisa dipantau', 'Available to monitor')}
		</p>
		<div class="jendela-pita" aria-hidden="true">
			<div class="jalan-pita">
				{#each [...emiten, ...emiten] as [kode, nama], urutan (urutan)}
					<span class="item-pita">
						<span class="tw-data text-ink text-[13px] font-semibold">{kode}</span>
						<span class="text-muted text-[13px]">{nama}</span>
					</span>
				{/each}
			</div>
		</div>
	</section>

	<section
		id="cara-kerja"
		class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
		{@attach terlihat}
	>
		<div class="max-w-2xl space-y-4">
			<h2 class="judul-seksi text-ink muncul">
				{t(
					'Pasang sekali, TripWire berjaga setiap hari.',
					'Set it once, and TripWire keeps watch every day.'
				)}
			</h2>
			<p class="text-secondary muncul text-[17px] leading-relaxed" style="--urut:1">
				{t(
					'Kamu cukup memilih saham dan batas skornya. Mengambil data, menghitung skor, dan mengirim notifikasi berjalan otomatis sesuai jadwal yang kamu atur.',
					'You just pick the stocks and their score threshold. Fetching data, calculating scores, and sending alerts all run automatically on the schedule you set.'
				)}
			</p>
		</div>

		<ol class="mt-12 grid gap-5 lg:grid-cols-3">
			<li class="langkah muncul" style="--urut:2">
				<div class="visual">
					<div class="kolom-cari">
						<Search class="text-muted size-4 flex-none" aria-hidden="true" />
						<span class="ketik tw-data text-ink text-[14px]">{TICKER}</span>
						<span class="kursor" aria-hidden="true"></span>
					</div>
					<div class="saran">
						<span class="tw-data text-ink text-[13px] font-semibold">{TICKER}</span>
						<span class="text-secondary truncate text-[12px]"
							>{t('Emiten fiktif', 'Fictional company')}</span
						>
						<span class="tombol-pantau">
							<Plus class="size-3" aria-hidden="true" />
							{t('Pantau', 'Watch')}
						</span>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<span class="chip">BBCA</span>
						<span class="chip">ANTM</span>
						<span class="chip chip-baru">{TICKER}</span>
					</div>
				</div>
				<div class="space-y-2 p-5 sm:p-6">
					<span class="nomor">1</span>
					<h3 class="tw-heading text-ink">
						{t('Pilih saham yang mau dipantau', 'Pick the stocks you want to monitor')}
					</h3>
					<p class="tw-caption">
						{t(
							'Cari kode emiten, tambahkan ke watchlist, lalu atur jadwal pengecekan: harian, mingguan, atau begitu ada kejadian baru.',
							'Search for a ticker, add it to your watchlist, then choose how often it gets checked: daily, weekly, or as soon as something new happens.'
						)}
					</p>
				</div>
			</li>

			<li class="langkah muncul" style="--urut:3">
				<div class="visual gap-2.5!">
					{#each bacaan as item, urutan (item.nama)}
						<div class="baris-baca" style="--urut-bar:{urutan}">
							<item.ikon class="text-secondary size-3.5 flex-none" aria-hidden="true" />
							<span class="text-secondary w-22 flex-none text-[12px]">{item.nama}</span>
							<span class="lajur">
								<span
									class="isi"
									style="width:{Math.max(item.nilai, 8)}%; background:{tierDariSkor(item.nilai)
										.color}"
								></span>
							</span>
							<span class="tw-data text-ink w-7 flex-none text-right text-[12px]">{item.nilai}</span
							>
						</div>
					{/each}
					<p class="text-muted flex items-center gap-1.5 pt-1 text-[11.5px]">
						<Database class="size-3" aria-hidden="true" />
						{t('Sumber data: Sectors API', 'Data source: Sectors API')}
					</p>
				</div>
				<div class="space-y-2 p-5 sm:p-6">
					<span class="nomor">2</span>
					<h3 class="tw-heading text-ink">
						{t('TripWire membaca datanya dari Sectors', 'TripWire reads the data from Sectors')}
					</h3>
					<p class="tw-caption">
						{t(
							'Riwayat suspensi, laporan transaksi orang dalam, dan perubahan kepemilikan diambil, lalu dihitung jadi Red Flag Score dari 0 sampai 100.',
							'Suspension history, insider transaction reports, and ownership changes are collected, then turned into a Red Flag Score from 0 to 100.'
						)}
					</p>
				</div>
			</li>

			<li class="langkah muncul" style="--urut:4">
				<div class="visual justify-center!">
					<div class="kartu-notif">
						<div class="flex items-center gap-2.5">
							<Logo size={26} cincin={false} />
							<span class="text-ink text-[13px] font-semibold">TripWire</span>
							<BellRing
								class="lonceng-notif text-diamond-300 ml-auto size-3.5"
								aria-hidden="true"
							/>
							<span class="tw-data text-muted text-[11px]">{t('07.02', '07:02')}</span>
						</div>
						<p class="text-ink mt-2 text-[13px] leading-snug font-medium">
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
				<div class="space-y-2 p-5 sm:p-6">
					<span class="nomor">3</span>
					<h3 class="tw-heading text-ink">
						{t(
							'Notifikasi masuk begitu skor melewati batas',
							'Get an alert as soon as the score crosses the threshold'
						)}
					</h3>
					<p class="tw-caption">
						{t(
							'Kabar sampai ke browser dan HP kamu lengkap dengan alasannya. Buka untuk melihat angka dan sumber datanya satu per satu.',
							'Alerts reach your browser and phone along with the reasons. Open one to see each number and its data source.'
						)}
					</p>
				</div>
			</li>
		</ol>
	</section>

	<section id="skor" class="border-line bg-base/40 border-y" {@attach terlihat}>
		<div
			class="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28"
		>
			<div class="space-y-8">
				<div class="space-y-4">
					<h2 class="judul-seksi text-ink muncul">
						{t(
							'Tiga sinyal tata kelola, satu skor 0 sampai 100.',
							'Three governance signals, one score from 0 to 100.'
						)}
					</h2>
					<p class="text-secondary muncul text-[17px] leading-relaxed" style="--urut:1">
						{t(
							'Sinyal ini biasanya tersebar di tempat berbeda. TripWire menggabungkannya, lalu menambah bobot kalau beberapa sinyal muncul berdekatan, karena pola seperti itu yang sering mendahului masalah.',
							'These signals are usually scattered across different places. TripWire combines them and adds weight when several signals appear close together, because that pattern often comes before trouble.'
						)}
					</p>
				</div>

				<ul class="space-y-3">
					{#each subSkor as item, urutan (item.kunci)}
						{@const detail = penjelasanSinyal[item.kunci]}
						<li class="sinyal muncul" style="--urut:{urutan + 2}">
							<span class="ikon-sinyal">
								<detail.ikon class="size-4.5" aria-hidden="true" />
							</span>
							<div class="min-w-0 flex-1 space-y-2">
								<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<h3 class="text-ink text-[16px] font-semibold">
										{t(item.nama[0], item.nama[1])}
									</h3>
									<span class="tw-data text-muted text-[12px]"
										>{t('bobot', 'weight')} {item.bobot * 100}%</span
									>
								</div>
								<p class="tw-caption">{detail.teks}</p>
								<div class="flex items-center gap-3 pt-1">
									<span class="lajur">
										<span
											class="isi"
											style="width:{Math.max(item.nilai, 4)}%; background:{tierDariSkor(item.nilai)
												.color}"
										></span>
									</span>
									<span class="tw-data text-secondary flex-none text-[12px]"
										>{TICKER} {item.nilai}</span
									>
								</div>
							</div>
						</li>
					{/each}
				</ul>

				<p class="text-muted muncul text-[13px] leading-relaxed" style="--urut:5">
					{t(
						'Skor menunjukkan pola, bukan vonis. Setiap insight tetap berisi fakta: apa yang terjadi, kapan, dan dari data mana.',
						'A score shows a pattern, not a verdict. Every insight still sticks to the facts: what happened, when, and from which data.'
					)}
				</p>
			</div>

			<div class="panel-gauge muncul lg:sticky lg:top-24 lg:self-start" style="--urut:2">
				<div class="mb-6 flex items-center justify-between gap-3">
					<p class="text-ink text-[15px] font-semibold">
						{t(`Red Flag Score ${TICKER}`, `${TICKER} Red Flag Score`)}
					</p>
					<span class="tw-data text-muted text-[12px]">{t('13 Jul 2026', 'Jul 13, 2026')}</span>
				</div>
				<SkorGauge />
			</div>
		</div>
	</section>

	<section
		id="intelijen"
		class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
		{@attach terlihat}
	>
		<div class="max-w-2xl space-y-4">
			<h2 class="judul-seksi text-ink muncul">
				{t(
					'Bandingkan dengan emiten sejenis, bukan cuma harganya.',
					'Compare against similar companies, not just the price.'
				)}
			</h2>
			<p class="text-secondary muncul text-[17px] leading-relaxed" style="--urut:1">
				{t(
					'Valuasi dan pertumbuhan dibandingkan dengan rata rata subsektornya. Di atas atau di bawah rata rata bukan penilaian baik buruk, hanya konteks supaya kamu tidak membaca angka sendirian.',
					'Valuation and growth are compared with the subsector average. Above or below average is not a judgment of good or bad, just context so you never read a number in isolation.'
				)}
			</p>
		</div>

		<div class="mt-12 grid gap-5 lg:grid-cols-12">
			<article class="panel muncul lg:col-span-7" style="--urut:2">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h3 class="text-ink text-[16px] font-semibold">
						{t(
							`Valuasi ${TICKER} dibanding rata rata subsektor`,
							`${TICKER} valuation vs the subsector average`
						)}
					</h3>
					<span class="text-muted text-[12px]">{t('Contoh', 'Example')}</span>
				</div>

				<div class="mt-6 space-y-1">
					<div
						class="text-muted grid grid-cols-[88px_1fr] gap-4 text-[11.5px] sm:grid-cols-[120px_1fr]"
					>
						<span></span>
						<div class="relative flex justify-between">
							<span>{t('di bawah', 'below')}</span>
							<span class="absolute left-1/2 -translate-x-1/2">{t('rata rata', 'average')}</span>
							<span>{t('di atas', 'above')}</span>
						</div>
					</div>
					{#each valuasi as item, urutan (item.nama)}
						{@const lebarBar = Math.min(Math.abs(item.selisih), 40) * 1.25}
						<div
							class="baris-valuasi grid grid-cols-[88px_1fr] items-center gap-4 sm:grid-cols-[120px_1fr]"
						>
							<div>
								<p class="text-ink text-[14px] font-medium">{item.nama}</p>
								<p class="tw-data text-muted text-[11.5px]">
									{desimal.format(item.emiten)} vs {desimal.format(item.subsektor)}
								</p>
							</div>
							<div class="lajur-valuasi">
								<span class="garis-tengah"></span>
								<span
									class="bar-valuasi"
									class:kiri={item.selisih < 0}
									style="width:{lebarBar / 2}%; --urut-bar:{urutan}"
								></span>
								<span
									class="tw-data text-ink label-valuasi text-[12px]"
									style={item.selisih < 0
										? `right:calc(50% + ${lebarBar / 2}% + 8px)`
										: `left:calc(50% + ${lebarBar / 2}% + 8px)`}
								>
									{desimal.format(Math.abs(item.selisih))}%
								</span>
							</div>
						</div>
					{/each}
				</div>

				<div class="border-line mt-6 grid gap-3 border-t pt-5 sm:grid-cols-2">
					<div>
						<p class="text-muted text-[12px]">{t('Pertumbuhan pendapatan', 'Revenue growth')}</p>
						<p class="mt-1 flex items-baseline gap-2">
							<span class="tw-data text-ink text-[20px]">{desimal.format(14.2)}%</span>
							<span class="text-secondary text-[12.5px]"
								>{t('subsektor', 'subsector')} {desimal.format(9.8)}%</span
							>
						</p>
					</div>
					<div>
						<p class="text-muted text-[12px]">{t('Pertumbuhan laba', 'Earnings growth')}</p>
						<p class="mt-1 flex items-baseline gap-2">
							<span class="tw-data text-ink text-[20px]">{desimal.format(6.1)}%</span>
							<span class="text-secondary text-[12.5px]"
								>{t('subsektor', 'subsector')} {desimal.format(11.5)}%</span
							>
						</p>
					</div>
				</div>
			</article>

			<article class="panel muncul lg:col-span-5" style="--urut:3">
				<div class="flex items-center gap-2.5">
					<span class="ikon-sinyal size-9!">
						<Pickaxe class="size-4" aria-hidden="true" />
					</span>
					<div>
						<h3 class="text-ink text-[16px] font-semibold">
							{t('Khusus saham tambang', 'For mining stocks')}
						</h3>
						<p class="text-muted text-[12px]">
							{t(`Contoh radar izin ${TICKER}`, `Example permit radar for ${TICKER}`)}
						</p>
					</div>
				</div>
				<p class="tw-caption mt-4">
					{t(
						'Produksi, harga komoditas, dan umur cadangan dibaca jadi skor eksposur komoditas. Izin tambang yang berakhir dalam 12 bulan ikut ditandai.',
						'Production, commodity prices, and reserve life are turned into a commodity exposure score. Mining permits that expire within 12 months are flagged too.'
					)}
				</p>

				<div class="radar mt-6">
					<div class="zona-12"></div>
					{#each izin as item, urutan (item.nama)}
						<div class="baris-izin" style="--urut-bar:{urutan}">
							<span class="text-secondary text-[12px]">{item.nama}</span>
							<span class="rel-izin">
								<span class="penanda-izin" style="left:{(item.bulan / 36) * 100}%">
									<span class="berlian" class:dekat={item.bulan <= 12}></span>
									<span class="label-izin tw-data" class:dekat={item.bulan <= 12}
										>{item.bulan} {t('bln', 'mo')}</span
									>
								</span>
							</span>
						</div>
					{/each}
					<div class="sumbu-izin tw-data text-muted text-[11px]">
						<span>0</span>
						<span class="text-tier-moderate">12</span>
						<span>24</span>
						<span>36 {t('bln', 'mo')}</span>
					</div>
				</div>

				<dl class="border-line mt-6 grid grid-cols-3 gap-3 border-t pt-5">
					{#each [[t('Komoditas', 'Commodity'), t('Nikel', 'Nickel')], [t('Produksi', 'Production'), '▲ 12%'], [t('Umur cadangan', 'Reserve life'), t('9 tahun', '9 years')]] as [label, nilai] (label)}
						<div>
							<dt class="text-muted text-[12px]">{label}</dt>
							<dd class="tw-data text-ink mt-1 text-[15px]">{nilai}</dd>
						</div>
					{/each}
				</dl>
			</article>
		</div>
	</section>

	<section id="verifikasi" class="border-line bg-base/40 border-y" {@attach terlihat}>
		<div
			class="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-28"
		>
			<div class="space-y-5 lg:col-span-5">
				<h2 class="judul-seksi text-ink muncul">
					{t(
						'Setiap insight bersegel digital. Siapa pun bisa mengeceknya.',
						'Every insight is digitally sealed. Anyone can check it.'
					)}
				</h2>
				<p class="text-secondary muncul text-[17px] leading-relaxed" style="--urut:1">
					{t(
						'Begitu dibuat, setiap insight ditandatangani dengan Ed25519 dan dirantai ke insight sebelumnya. Satu huruf saja diubah, tanda tangannya tidak cocok lagi. Halaman verifikasi bisa dibuka tanpa akun.',
						'Once created, every insight is signed with Ed25519 and chained to the previous insight. Change a single letter and the signature no longer matches. The verification page works without an account.'
					)}
				</p>
				<a href="/verify-insight" class="tw-ghost muncul" style="--urut:2">
					<FileCheck2 class="size-4" aria-hidden="true" />
					{t('Cek keaslian insight', 'Check insight authenticity')}
				</a>
			</div>

			<ol class="rantai lg:col-span-7">
				{#each rantai as blok, urutan (blok.hash)}
					<li
						class="blok muncul"
						class:disorot={sorotBlok === urutan}
						style="--urut:{urutan + 2}"
						onpointerenter={() => (sorotBlok = urutan)}
						onpointerleave={() => (sorotBlok = null)}
					>
						<div class="flex items-center justify-between gap-2">
							<span class="tw-data text-ink text-[13px] font-semibold">{TICKER}</span>
							<span class="tw-data text-muted text-[11.5px]">{tglRantai(blok.hari)}</span>
						</div>
						<p class="mt-1.5 text-[13px] font-medium {tierDariSkor(blok.skor).text}">
							{t('Skor', 'Score')}
							{blok.skor}, {tierDariSkor(blok.skor).label}
						</p>
						<dl class="tw-data mt-3 space-y-1.5 text-[11.5px]">
							<div>
								<dt class="text-muted">hash</dt>
								<dd class="hash" class:cocok={sorotBlok === urutan}>{blok.hash}</dd>
							</div>
							<div>
								<dt class="text-muted">{t('sebelumnya', 'previous')}</dt>
								<dd class="hash" class:cocok={sorotBlok !== null && sorotBlok === urutan - 1}>
									{blok.sebelumnya}
								</dd>
							</div>
						</dl>
						{#if urutan === rantai.length - 1}
							<div class="border-line mt-3 border-t pt-3">
								<SignatureBadge />
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<section class="mx-auto max-w-7xl space-y-6 px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
		<div
			class="panel-cta relative isolate overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16"
		>
			<div class="kawat-cta" aria-hidden="true">
				<Logo size={56} />
			</div>
			<h2 class="judul-seksi text-ink mx-auto mt-8 max-w-2xl">
				{t('Pasang TripWire di saham pilihanmu.', 'Set a TripWire on the stocks you pick.')}
			</h2>
			<p class="text-secondary mx-auto mt-4 max-w-xl text-[17px] leading-relaxed">
				{t(
					'Daftar gratis, tambahkan saham ke watchlist, dan tentukan batas skornya. Sisanya TripWire yang mengecek setiap hari.',
					'Sign up for free, add stocks to your watchlist, and set their score threshold. TripWire handles the daily checks from there.'
				)}
			</p>
			<div class="mt-8 flex flex-wrap justify-center gap-3">
				<a href="/register" class="tw-primary px-6 py-3"
					>{t('Buat akun gratis', 'Create a free account')}</a
				>
				<a href="/login" class="tw-ghost px-6 py-3">{t('Masuk', 'Log in')}</a>
			</div>
		</div>

		<DisclaimerBar />
	</section>
</main>

<footer class="border-line border-t">
	<div
		class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between lg:px-8"
	>
		<div class="max-w-sm space-y-3">
			<Wordmark size="sm" />
			<p class="text-muted text-[13px] leading-relaxed">
				{t(
					'Red flag detector dan market intelligence untuk saham IDX. Dibuat untuk Sectors Hackathon 2026.',
					'Red flag detector and market intelligence for IDX stocks. Built for the Sectors Hackathon 2026.'
				)}
			</p>
		</div>
		<nav
			class="text-secondary flex flex-wrap gap-x-6 gap-y-2 text-[14px]"
			aria-label={t('Tautan bawah', 'Footer links')}
		>
			<a href="/login" class="tautan-kaki">{t('Masuk', 'Log in')}</a>
			<a href="/register" class="tautan-kaki">{t('Daftar', 'Sign up')}</a>
			<a href="/verify-insight" class="tautan-kaki">{t('Verifikasi insight', 'Verify insight')}</a>
			<a href="https://sectors.app" class="tautan-kaki" rel="noopener noreferrer" target="_blank"
				>{t('Data dari Sectors', 'Data from Sectors')}</a
			>
		</nav>
	</div>
</footer>

<style>
	.tautan-nav {
		position: relative;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 14px;
		color: var(--color-secondary);
		transition: color 0.2s ease;
	}

	.tautan-nav::after {
		content: '';
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 3px;
		height: 1.5px;
		border-radius: 2px;
		background: var(--color-diamond-500);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.25s ease;
	}

	@media (hover: hover) {
		.tautan-nav:hover {
			color: var(--color-ink);
		}

		.tautan-nav:hover::after {
			transform: scaleX(1);
		}
	}

	.latar {
		position: absolute;
		inset: 0;
		z-index: -1;
		pointer-events: none;
		background-image:
			linear-gradient(color-mix(in srgb, var(--kilau) 5%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--kilau) 5%, transparent) 1px, transparent 1px);
		background-size: 56px 56px;
		mask-image: radial-gradient(ellipse 85% 75% at 65% 30%, #000 25%, transparent 75%);
	}

	.latar::after {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(640px 420px at 74% 42%, rgba(74, 158, 255, 0.16), transparent 70%);
	}

	.judul-hero {
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 1.2rem + 3vw, 3.6rem);
		font-weight: 600;
		line-height: 1.04;
		letter-spacing: -0.042em;
		text-wrap: balance;
	}

	.judul-seksi {
		font-family: var(--font-display);
		font-size: clamp(1.85rem, 1.3rem + 1.8vw, 2.75rem);
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: -0.032em;
		text-wrap: balance;
	}

	.masuk {
		animation: muncul 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(var(--urut, 0) * 120ms);
	}

	@media (hover: hover) {
		.cta-utama:hover :global(.lonceng) {
			animation: goyang 0.6s ease;
		}
	}

	@keyframes goyang {
		20% {
			transform: rotate(-16deg);
		}
		40% {
			transform: rotate(13deg);
		}
		60% {
			transform: rotate(-8deg);
		}
		80% {
			transform: rotate(4deg);
		}
	}

	.pita {
		position: relative;
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.label-pita {
		z-index: 1;
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		padding: 14px 20px 14px max(16px, calc((100vw - 80rem) / 2 + 32px));
		background: linear-gradient(90deg, var(--color-base) 75%, transparent);
		white-space: nowrap;
	}

	.denyut-hijau {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-naik);
		box-shadow: 0 0 0 0 rgba(31, 175, 122, 0.6);
		animation: denyut-titik 2s ease-out infinite;
	}

	@keyframes denyut-titik {
		70% {
			box-shadow: 0 0 0 7px rgba(31, 175, 122, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(31, 175, 122, 0);
		}
	}

	.jendela-pita {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
	}

	.jalan-pita {
		display: flex;
		width: max-content;
		animation: jalan 70s linear infinite;
	}

	@media (hover: hover) {
		.pita:hover .jalan-pita {
			animation-play-state: paused;
		}
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
		padding: 14px 22px;
		border-right: 1px solid color-mix(in srgb, var(--kilau) 7%, transparent);
		transition: background 0.2s ease;
	}

	@media (hover: hover) {
		.item-pita:hover {
			background: rgba(74, 158, 255, 0.07);
		}
	}

	.langkah {
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		transition:
			transform 0.3s ease,
			border-color 0.3s ease,
			box-shadow 0.3s ease;
	}

	@media (hover: hover) {
		.langkah:hover {
			transform: translateY(-4px);
			border-color: color-mix(in srgb, var(--color-diamond-300) 30%, transparent);
			box-shadow: 0 30px 60px -30px rgba(74, 158, 255, 0.35);
		}
	}

	.visual {
		display: flex;
		height: 176px;
		flex-direction: column;
		justify-content: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		background:
			radial-gradient(420px 180px at 50% 0%, rgba(74, 158, 255, 0.1), transparent 70%),
			var(--color-void);
		padding: 18px 20px;
	}

	.kolom-cari {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--color-diamond-700);
		border-radius: 10px;
		background: var(--color-base);
		padding: 8px 12px;
		box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.12);
	}

	.ketik {
		display: inline-block;
		overflow: hidden;
		white-space: nowrap;
		width: 4ch;
	}

	:global(.terlihat) .ketik {
		animation: ketik 1s steps(4) 0.5s backwards;
	}

	@keyframes ketik {
		from {
			width: 0;
		}
	}

	.kursor {
		width: 1.5px;
		height: 16px;
		margin-left: -6px;
		background: var(--color-diamond-300);
		animation: kedip 1s steps(1) infinite;
	}

	@keyframes kedip {
		50% {
			opacity: 0;
		}
	}

	.saran {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 8px 10px 8px 12px;
	}

	.tombol-pantau {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		border-radius: 7px;
		background: var(--color-diamond-500);
		padding: 3px 8px;
		font-size: 11.5px;
		font-weight: 600;
		color: #04101f;
		transition: box-shadow 0.25s ease;
	}

	.chip {
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-secondary);
	}

	.chip-baru {
		border-color: var(--color-diamond-500);
		color: var(--color-diamond-100);
	}

	:global(.terlihat) .chip-baru {
		animation: letup 0.45s cubic-bezier(0.3, 1.6, 0.5, 1) 1.7s backwards;
	}

	@keyframes letup {
		from {
			opacity: 0;
			transform: scale(0.4);
		}
	}

	.chip-baru {
		transition:
			transform 0.25s ease,
			box-shadow 0.25s ease;
	}

	@media (hover: hover) {
		.langkah:hover .tombol-pantau {
			box-shadow: 0 0 0 4px rgba(74, 158, 255, 0.25);
		}

		.langkah:hover .chip-baru {
			transform: translateY(-2px);
			box-shadow: 0 6px 16px -6px rgba(74, 158, 255, 0.7);
		}

		.langkah:hover .lajur::after,
		.sinyal:hover .lajur::after {
			animation: kilau 0.9s ease;
			animation-delay: calc(var(--urut-bar, 0) * 120ms);
		}

		.langkah:hover :global(.lonceng-notif) {
			animation: goyang 0.6s ease;
		}
	}

	@keyframes kilau {
		to {
			transform: translateX(100%);
		}
	}

	.nomor {
		display: inline-grid;
		width: 26px;
		height: 26px;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-diamond-300);
	}

	.baris-baca {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.lajur {
		position: relative;
		height: 6px;
		flex: 1;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.lajur::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
		transform: translateX(-100%);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transform-origin: left;
	}

	:global(.terlihat) .isi {
		animation: isi 1s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(0.5s + var(--urut-bar, var(--urut, 0)) * 150ms);
	}

	@keyframes isi {
		from {
			transform: scaleX(0);
		}
	}

	.kartu-notif {
		border: 1px solid color-mix(in srgb, var(--color-diamond-300) 25%, transparent);
		border-radius: 14px;
		background: var(--color-raised);
		padding: 12px 14px;
		box-shadow: 0 20px 40px -24px var(--bayang);
	}

	:global(.terlihat) .kartu-notif {
		animation: turun 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) 0.9s backwards;
	}

	@keyframes turun {
		from {
			opacity: 0;
			transform: translateY(-24px) scale(0.96);
		}
	}

	.sinyal {
		display: flex;
		gap: 16px;
		border: 1px solid transparent;
		border-radius: 16px;
		padding: 16px;
		transition:
			background 0.25s ease,
			border-color 0.25s ease;
	}

	@media (hover: hover) {
		.sinyal:hover {
			border-color: var(--edge);
			background: color-mix(in srgb, var(--cahaya) 2.5%, transparent);
		}

		.sinyal:hover .ikon-sinyal {
			border-color: var(--color-diamond-700);
			color: var(--color-diamond-300);
		}
	}

	.ikon-sinyal {
		display: grid;
		width: 40px;
		height: 40px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: var(--color-raised);
		color: var(--color-secondary);
		transition:
			border-color 0.25s ease,
			color 0.25s ease;
	}

	.panel-gauge,
	.panel {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 24px;
	}

	.panel {
		transition:
			border-color 0.3s ease,
			transform 0.3s ease;
	}

	@media (hover: hover) {
		.panel:hover {
			border-color: color-mix(in srgb, var(--kilau) 24%, transparent);
		}
	}

	.baris-valuasi {
		border-radius: 10px;
		padding: 10px 8px;
		margin: 0 -8px;
		transition: background 0.2s ease;
	}

	@media (hover: hover) {
		.baris-valuasi:hover {
			background: color-mix(in srgb, var(--cahaya) 3%, transparent);
		}

		.baris-valuasi:hover .bar-valuasi {
			background: var(--color-diamond-100);
		}
	}

	.lajur-valuasi {
		position: relative;
		height: 28px;
	}

	.garis-tengah {
		position: absolute;
		top: -6px;
		bottom: -6px;
		left: 50%;
		width: 1px;
		background: color-mix(in srgb, var(--kilau) 28%, transparent);
	}

	.bar-valuasi {
		position: absolute;
		top: 7px;
		left: 50%;
		height: 14px;
		border-radius: 0 4px 4px 0;
		background: var(--color-secondary);
		transform-origin: left;
		transition: background 0.2s ease;
	}

	.bar-valuasi.kiri {
		left: auto;
		right: 50%;
		border-radius: 4px 0 0 4px;
		transform-origin: right;
	}

	:global(.terlihat) .bar-valuasi {
		animation: isi 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
		animation-delay: calc(0.6s + var(--urut-bar, 0) * 140ms);
	}

	.label-valuasi {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		white-space: nowrap;
	}

	.radar {
		position: relative;
		display: grid;
		gap: 14px;
		--kolom-label: 112px;
	}

	@media (min-width: 640px) {
		.radar {
			--kolom-label: 132px;
		}
	}

	.zona-12 {
		position: absolute;
		top: -8px;
		bottom: 24px;
		left: var(--kolom-label);
		width: calc((100% - var(--kolom-label)) / 3);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-tier-moderate) 6%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-tier-moderate) 18%, transparent);
	}

	.sumbu-izin {
		position: relative;
		height: 16px;
		margin-left: var(--kolom-label);
	}

	.sumbu-izin span {
		position: absolute;
		top: 0;
		white-space: nowrap;
		transform: translateX(-50%);
	}

	.sumbu-izin span:nth-child(1) {
		left: 0;
		transform: none;
	}

	.sumbu-izin span:nth-child(2) {
		left: 33.333%;
	}

	.sumbu-izin span:nth-child(3) {
		left: 66.667%;
	}

	.sumbu-izin span:nth-child(4) {
		left: 100%;
		transform: translateX(-100%);
	}

	.baris-izin {
		position: relative;
		display: grid;
		grid-template-columns: var(--kolom-label) 1fr;
		align-items: center;
		height: 30px;
	}

	.rel-izin {
		position: relative;
		height: 2px;
		background: color-mix(in srgb, var(--kilau) 12%, transparent);
	}

	.penanda-izin {
		position: absolute;
		top: 50%;
	}

	.berlian {
		position: absolute;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border: 2px solid var(--color-base);
		border-radius: 3px;
		background: var(--color-secondary);
		transform: rotate(45deg);
		transition: transform 0.2s ease;
	}

	.berlian.dekat {
		background: var(--color-tier-moderate);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-tier-moderate) 20%, transparent);
	}

	:global(.terlihat) .penanda-izin {
		animation: letup 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) backwards;
		animation-delay: calc(0.6s + var(--urut-bar, 0) * 180ms);
	}

	.label-izin {
		position: absolute;
		bottom: 9px;
		left: 0;
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: 11px;
		color: var(--color-secondary);
	}

	.label-izin.dekat {
		color: var(--color-tier-moderate);
	}

	@media (hover: hover) {
		.baris-izin:hover .berlian {
			transform: rotate(45deg) scale(1.35);
		}
	}

	.rantai {
		position: relative;
		display: grid;
		gap: 28px;
	}

	@media (min-width: 768px) {
		.rantai {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 20px;
		}
	}

	.blok {
		position: relative;
		border: 1px solid var(--edge);
		border-radius: 16px;
		background: var(--color-base);
		padding: 16px;
		transition:
			transform 0.25s ease,
			border-color 0.25s ease;
	}

	.blok + .blok::before {
		content: '';
		position: absolute;
		left: 50%;
		top: -29px;
		width: 1.5px;
		height: 28px;
		background: linear-gradient(var(--color-diamond-700), var(--color-diamond-500));
	}

	@media (min-width: 768px) {
		.blok + .blok::before {
			left: -21px;
			top: 50%;
			width: 20px;
			height: 1.5px;
			background: linear-gradient(90deg, var(--color-diamond-700), var(--color-diamond-500));
		}
	}

	.blok.disorot {
		transform: translateY(-4px);
		border-color: color-mix(in srgb, var(--color-diamond-300) 35%, transparent);
	}

	.hash {
		color: var(--color-secondary);
		transition:
			color 0.2s ease,
			background 0.2s ease;
		border-radius: 4px;
		margin: 1px -4px 0;
		padding: 1px 4px;
	}

	.hash.cocok {
		background: rgba(74, 158, 255, 0.14);
		color: var(--color-diamond-100);
	}

	.panel-cta {
		border: 1px solid var(--edge);
		background:
			radial-gradient(700px 300px at 50% 0%, rgba(74, 158, 255, 0.18), transparent 70%),
			var(--color-base);
	}

	.kawat-cta {
		position: relative;
		display: flex;
		justify-content: center;
	}

	.kawat-cta::before {
		content: '';
		position: absolute;
		top: 50%;
		left: -48px;
		right: -48px;
		height: 1.5px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--color-diamond-700) 20%,
			var(--color-diamond-300) 50%,
			var(--color-diamond-700) 80%,
			transparent
		);
	}

	.tautan-kaki {
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan-kaki:hover {
			color: var(--color-ink);
		}
	}
</style>
