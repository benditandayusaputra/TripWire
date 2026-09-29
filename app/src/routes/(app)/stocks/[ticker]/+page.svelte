<script lang="ts">
	import {
		ArrowLeft,
		ArrowUpRight,
		Briefcase,
		Building2,
		CalendarDays,
		Crown,
		Factory,
		Gem,
		Globe,
		Landmark,
		Mail,
		MapPin,
		Network,
		Phone,
		UserRound,
		Users
	} from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import { lokal, t } from '$lib/bahasa.svelte';
	import {
		NAMA_SEKTOR,
		formatHarga,
		formatRupiah,
		formatUbah,
		peristiwaDari,
		tanggalPendek
	} from '$lib/watchlist';
	import {
		bulanTahun,
		dewan,
		formatJumlah,
		formatPersen,
		inisial,
		labelJabatan,
		labelKategori,
		labelPapan,
		namaPemegang,
		pimpinan,
		publik,
		tanggalPanjang,
		type Dewan
	} from '$lib/profil';

	let { data } = $props();

	const RONA = [212, 262, 296, 188, 238, 322, 276];

	const profil = $derived(data.profil);
	const kutipan = $derived(profil.quote);
	const perusahaan = $derived(profil.company);
	const institusi = $derived(profil.institutional);
	const komposisi = $derived(profil.composition);
	const ubah = $derived(formatUbah(kutipan?.daily_close_change));
	const angka = $derived(new Intl.NumberFormat(lokal()));

	const sektor = $derived(
		[...new Set([perusahaan.sector, perusahaan.sub_sector].filter(Boolean) as string[])].map(
			(nilai) => t(NAMA_SEKTOR[nilai] ?? nilai, nilai)
		)
	);
	const industri = $derived(
		[...new Set([perusahaan.industry, perusahaan.sub_industry].filter(Boolean))].join(' · ')
	);

	const terbesar = $derived(profil.shareholders.find((satu) => !publik(satu.name)) ?? null);
	const pemimpin = $derived(
		profil.executives.find(
			(satu) => dewan(satu.position) === 'direksi' && pimpinan(satu.position)
		) ??
			profil.executives[0] ??
			null
	);

	const kelompok = $derived(
		(['direksi', 'komisaris', 'lain'] as Dewan[])
			.map((kunci) => ({
				kunci,
				orang: profil.executives.filter((satu) => dewan(satu.position) === kunci)
			}))
			.filter((satu) => satu.orang.length > 0)
	);

	const segmen = $derived(
		profil.shareholders.map((satu, urutan) => ({
			...satu,
			rona: publik(satu.name) ? null : RONA[urutan % RONA.length]
		}))
	);

	const puncakArus = $derived(
		Math.max(1, ...institusi.flow.map((satu) => Math.abs(satu.net_transaction)))
	);
	const kolomInstitusi = $derived([
		{ arah: 1, judul: t('Pembeli terbesar', 'Top buyers'), daftar: institusi.top_buyers },
		{ arah: -1, judul: t('Penjual terbesar', 'Top sellers'), daftar: institusi.top_sellers }
	]);
	const adaInstitusi = $derived(
		institusi.top_buyers.length + institusi.top_sellers.length + institusi.flow.length > 0
	);

	const totalKomposisi = $derived(komposisi ? komposisi.local + komposisi.foreign : 0);
	const porsiLokal = $derived(komposisi ? (komposisi.local / totalKomposisi) * 100 : 0);
	const kategori = $derived(
		komposisi
			? [...komposisi.categories].sort((a, b) => b.local + b.foreign - (a.local + a.foreign))
			: []
	);

	const jejak = $derived(
		peristiwaDari(data.redFlag ?? undefined)
			.filter((satu) => satu.jenis !== 'suspensi')
			.slice(0, 8)
	);

	function judulDewan(kunci: Dewan) {
		if (kunci === 'direksi') return t('Direksi', 'Board of directors');
		if (kunci === 'komisaris') return t('Dewan komisaris', 'Board of commissioners');
		return t('Pejabat lain', 'Other officers');
	}

	const porsi = (nilai: number) => (totalKomposisi > 0 ? (nilai / totalKomposisi) * 100 : 0);
</script>

<svelte:head>
	<title>{profil.ticker} · {t('Profil dan pemilik saham', 'Stock profile and owners')}</title>
</svelte:head>

<section class="space-y-5" data-testid="profil-saham" data-ticker={profil.ticker}>
	<a href="/watchlist?emiten={profil.ticker}" class="kembali">
		<ArrowLeft class="size-3.5" aria-hidden="true" />
		{t('Kembali ke watchlist', 'Back to watchlist')}
	</a>

	<header class="panel kepala">
		<div class="flex min-w-0 items-center gap-4">
			<LogoEmiten kode={profil.ticker} ukuran={56} />
			<div class="min-w-0 space-y-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="tw-data text-ink text-[22px] leading-none font-semibold tracking-wide">
						{profil.ticker}
					</h1>
					{#each kutipan?.indices ?? [] as indeks (indeks)}
						<span class="chip">{indeks}</span>
					{/each}
				</div>
				<p data-testid="nama-emiten" class="text-secondary text-[14.5px]">
					{profil.company_name}
				</p>
				{#if sektor.length}
					<p class="text-muted text-[12.5px]">{sektor.join(' · ')}</p>
				{/if}
			</div>
		</div>

		{#if kutipan}
			<div class="harga">
				<p class="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
					<span class="tw-data text-ink text-[28px] leading-none font-medium">
						{formatHarga(kutipan.last_close_price)}
					</span>
					<span class="pil-ubah" data-arah={ubah.arah}>{ubah.teks}</span>
				</p>
				<p class="text-muted mt-1.5 text-[12px]">
					{t('Penutupan', 'Close')}{kutipan.latest_close_date
						? ` ${tanggalPendek(kutipan.latest_close_date)}`
						: ''}
					· {t('Kapitalisasi', 'Market cap')}
					<span class="tw-data text-secondary">{formatRupiah(kutipan.market_cap)}</span>
					{#if kutipan.market_cap_rank}
						<span class="tw-data">#{kutipan.market_cap_rank}</span>
					{/if}
				</p>
			</div>
		{/if}
	</header>

	<section class="panel balik" aria-labelledby="judul-balik" data-testid="siapa-di-balik">
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<h2 id="judul-balik" class="tw-heading text-ink">
				{t(`Siapa di balik ${profil.ticker}`, `Who is behind ${profil.ticker}`)}
			</h2>
			<p class="text-muted text-[12.5px]">
				{t(
					'Pemilik terbesar, pimpinan, grup usaha, dan investor kakapnya',
					'Largest owner, leadership, business group, and whale investors'
				)}
			</p>
		</div>

		<dl class="rantai">
			<div class="sel-rantai" data-testid="balik-pemilik">
				<dt>
					<Crown class="size-3.5" aria-hidden="true" />{t('Pemilik terbesar', 'Largest owner')}
				</dt>
				<dd>
					{#if terbesar}
						<span class="nama">{terbesar.name}</span>
						<span class="tw-data text-secondary text-[13px]">
							{t('menguasai', 'holds')}
							{formatPersen(terbesar.percentage)}
						</span>
					{:else}
						<span class="kosong"
							>{t('Kepemilikan tersebar di publik', 'Widely held by the public')}</span
						>
					{/if}
				</dd>
			</div>

			<div class="sel-rantai" data-testid="balik-pimpinan">
				<dt><UserRound class="size-3.5" aria-hidden="true" />{t('Pimpinan', 'Leadership')}</dt>
				<dd>
					{#if pemimpin}
						<span class="nama">{pemimpin.name}</span>
						<span class="text-secondary text-[13px]">{labelJabatan(pemimpin.position)}</span>
					{:else}
						<span class="kosong">{t('Belum tercatat di Sectors', 'Not recorded by Sectors')}</span>
					{/if}
				</dd>
			</div>

			<div class="sel-rantai" data-testid="balik-grup">
				<dt><Network class="size-3.5" aria-hidden="true" />{t('Grup usaha', 'Business group')}</dt>
				<dd>
					{#if profil.conglomerates.length || profil.affiliates.length}
						{#if profil.conglomerates.length}
							<span class="nama">{profil.conglomerates.join(', ')}</span>
						{/if}
						{#if profil.affiliates.length}
							<span class="text-secondary text-[13px]">
								{t('Afiliasi', 'Affiliates')}: {profil.affiliates.join(', ')}
							</span>
						{/if}
					{:else}
						<span class="kosong">{t('Tidak terhubung grup tercatat', 'No recorded group')}</span>
					{/if}
				</dd>
			</div>

			<div class="sel-rantai" data-testid="balik-kakap">
				<dt><Gem class="size-3.5" aria-hidden="true" />{t('Investor kakap', 'Whale investors')}</dt>
				<dd>
					{#if profil.whale_investors.length}
						<span class="nama">{profil.whale_investors.join(', ')}</span>
					{:else}
						<span class="kosong">{t('Tidak ada yang tercatat', 'None recorded')}</span>
					{/if}
				</dd>
			</div>
		</dl>
	</section>

	<div class="grid items-start gap-5 lg:grid-cols-12">
		<div class="min-w-0 space-y-5 lg:col-span-7">
			<section class="panel" aria-labelledby="judul-pengelola" data-testid="pengelola">
				<div class="kepala-bagian">
					<h2 id="judul-pengelola" class="tw-overline flex items-center gap-2">
						<Briefcase class="size-3.5" aria-hidden="true" />
						{t('Pengelola perusahaan', 'Management')}
					</h2>
					{#if profil.executives.length}
						<span class="text-muted text-[12px]">
							{t(`${profil.executives.length} orang`, `${profil.executives.length} people`)}
						</span>
					{/if}
				</div>

				{#each kelompok as grup (grup.kunci)}
					<h3 class="judul-grup">{judulDewan(grup.kunci)}</h3>
					<ul class="daftar-orang">
						{#each grup.orang as orang, urutan (`${orang.name}-${urutan}`)}
							<li data-testid="pejabat" class:utama={pimpinan(orang.position)}>
								<span class="avatar" aria-hidden="true">{inisial(orang.name)}</span>
								<span class="min-w-0 flex-1">
									<span class="text-ink block truncate text-[14px] font-medium">{orang.name}</span>
									<span class="text-secondary block truncate text-[12.5px]">
										{labelJabatan(orang.position)}
									</span>
								</span>
								{#if pimpinan(orang.position)}
									<span class="lencana">{t('Pimpinan', 'Head')}</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="kosong-bagian">
						{t(
							`Sectors belum mencatat susunan pengelola ${profil.ticker}.`,
							`Sectors has not recorded the management of ${profil.ticker}.`
						)}
					</p>
				{/each}

				{#if profil.executive_holdings.length}
					<h3 class="judul-grup">{t('Saham milik pengelola', 'Shares held by management')}</h3>
					<ul class="space-y-1.5">
						{#each profil.executive_holdings as satu, urutan (`${satu.name}-${urutan}`)}
							<li class="baris" data-testid="saham-pengelola">
								<span class="min-w-0 flex-1">
									<span class="text-ink block truncate text-[13.5px]">{satu.name}</span>
									<span class="text-muted text-[12px]">{labelJabatan(satu.position)}</span>
								</span>
								<span class="text-right">
									<span class="tw-data text-ink block text-[13.5px]">
										{formatJumlah(satu.share_amount)}
									</span>
									<span class="tw-data text-muted text-[12px]">{formatPersen(satu.percentage)}</span
									>
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel" aria-labelledby="judul-pemegang" data-testid="pemegang-saham">
				<div class="kepala-bagian">
					<h2 id="judul-pemegang" class="tw-overline flex items-center gap-2">
						<Users class="size-3.5" aria-hidden="true" />
						{t('Pemegang saham utama', 'Major shareholders')}
					</h2>
				</div>

				{#if segmen.length}
					<div
						class="batang"
						role="img"
						aria-label={segmen
							.map((satu) => `${namaPemegang(satu.name)} ${formatPersen(satu.percentage)}`)
							.join(', ')}
					>
						{#each segmen as satu, urutan (`${satu.name}-${urutan}`)}
							<span
								class="potong"
								class:publik={satu.rona === null}
								style="flex-basis:{satu.percentage}%; --rona:{satu.rona ?? 0}"
							></span>
						{/each}
					</div>

					<ul class="mt-4 space-y-0.5">
						{#each segmen as satu, urutan (`${satu.name}-${urutan}`)}
							<li class="baris" data-testid="pemegang">
								<span
									class="titik"
									class:publik={satu.rona === null}
									style="--rona:{satu.rona ?? 0}"
									aria-hidden="true"
								></span>
								<span class="min-w-0 flex-1">
									<span class="text-ink block truncate text-[13.5px]"
										>{namaPemegang(satu.name)}</span
									>
									{#if satu.share_amount}
										<span class="tw-data text-muted text-[12px]">
											{formatJumlah(satu.share_amount)}{satu.share_value
												? ` · ${formatRupiah(satu.share_value)}`
												: ''}
										</span>
									{/if}
								</span>
								<span class="tw-data text-ink text-[14px]">{formatPersen(satu.percentage)}</span>
							</li>
						{/each}
					</ul>
					<p class="catatan">
						{t(
							'Nama pemegang yang dilaporkan emiten, termasuk direksi yang memegang saham. Sisanya digabung sebagai Masyarakat.',
							'Holders named by the issuer, including directors who own shares. The rest are grouped as Public.'
						)}
					</p>
				{:else}
					<p class="kosong-bagian">
						{t(
							'Sectors belum mencatat pemegang saham utama.',
							'Sectors has not recorded major shareholders.'
						)}
					</p>
				{/if}
			</section>

			<section class="panel" aria-labelledby="judul-institusi" data-testid="institusi">
				<div class="kepala-bagian">
					<h2 id="judul-institusi" class="tw-overline flex items-center gap-2">
						<Landmark class="size-3.5" aria-hidden="true" />
						{t('Gerak investor institusi', 'Institutional activity')}
					</h2>
					{#if institusi.date}
						<span class="text-muted text-[12px]">
							{t('per', 'as of')}
							{tanggalPanjang(institusi.date)}
						</span>
					{/if}
				</div>

				{#if adaInstitusi}
					<div class="grid gap-x-5 gap-y-2 sm:grid-cols-2">
						{#each kolomInstitusi as kolom (kolom.arah)}
							<div>
								<h3 class="judul-grup">{kolom.judul}</h3>
								{#if kolom.daftar.length}
									<ul class="space-y-0.5">
										{#each kolom.daftar as satu, urutan (`${satu.name}-${urutan}`)}
											<li class="baris" data-testid="institusi-{kolom.arah > 0 ? 'beli' : 'jual'}">
												<span
													class="text-ink min-w-0 flex-1 truncate text-[13px]"
													title={satu.name}
												>
													{satu.name}
												</span>
												<span
													class="tw-data flex-none text-[12.5px] {satu.change_amount > 0
														? 'text-naik'
														: 'text-turun'}"
												>
													{satu.change_amount > 0 ? '▲' : '▼'}
													{formatJumlah(Math.abs(satu.change_amount))}
												</span>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="text-muted text-[12.5px]">{t('Tidak ada', 'None')}</p>
								{/if}
							</div>
						{/each}
					</div>

					{#if institusi.flow.length}
						<h3 class="judul-grup">
							{t('Arus bersih institusi per bulan', 'Monthly net institutional flow')}
						</h3>
						<ol class="arus">
							{#each institusi.flow as satu (satu.date)}
								{@const tinggi = Math.max(4, (Math.abs(satu.net_transaction) / puncakArus) * 100)}
								<li title="{bulanTahun(satu.date)}: {formatJumlah(satu.net_transaction, true)}">
									<span class="separuh atas">
										{#if satu.net_transaction > 0}
											<span class="batang-arus naik" style="height:{tinggi}%"></span>
										{/if}
									</span>
									<span class="separuh bawah">
										{#if satu.net_transaction < 0}
											<span class="batang-arus turun" style="height:{tinggi}%"></span>
										{/if}
									</span>
									<span class="tw-data label-arus">{bulanTahun(satu.date, 'short')}</span>
									<span class="sr-only">{formatJumlah(satu.net_transaction, true)}</span>
								</li>
							{/each}
						</ol>
						<p class="catatan">
							{t(
								'Batang berongga ke atas berarti institusi membeli bersih, batang padat ke bawah berarti menjual bersih.',
								'Hollow bars up mean net institutional buying, solid bars down mean net selling.'
							)}
						</p>
					{/if}
				{:else}
					<p class="kosong-bagian">
						{t(
							'Sectors belum mencatat transaksi institusi untuk saham ini.',
							'Sectors has not recorded institutional transactions for this stock.'
						)}
					</p>
				{/if}
			</section>
		</div>

		<div class="min-w-0 space-y-5 lg:col-span-5">
			<section class="panel" aria-labelledby="judul-komposisi" data-testid="komposisi">
				<div class="kepala-bagian">
					<h2 id="judul-komposisi" class="tw-overline flex items-center gap-2">
						<Network class="size-3.5" aria-hidden="true" />
						{t('Komposisi investor', 'Investor composition')}
					</h2>
					{#if komposisi}
						<span class="text-muted text-[12px]">{bulanTahun(komposisi.date)}</span>
					{/if}
				</div>

				{#if komposisi}
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<p class="text-muted text-[12px]">{t('Jumlah pemegang saham', 'Shareholders')}</p>
							<p data-testid="jumlah-pemegang" class="tw-data text-ink text-[26px] leading-tight">
								{komposisi.shareholders !== null ? angka.format(komposisi.shareholders) : '-'}
							</p>
							{#if komposisi.shareholders_change}
								<p
									class="tw-data text-[12px] {komposisi.shareholders_change > 0
										? 'text-naik'
										: 'text-turun'}"
								>
									{komposisi.shareholders_change > 0 ? '▲' : '▼'}
									{angka.format(Math.abs(komposisi.shareholders_change))}
									<span class="text-muted">{t('dari bulan sebelumnya', 'from last month')}</span>
								</p>
							{/if}
						</div>
						<dl class="flex gap-4 text-right">
							<div>
								<dt class="legenda"><span class="kotak lokal"></span>{t('Lokal', 'Local')}</dt>
								<dd class="tw-data text-ink text-[15px]">{formatPersen(porsiLokal)}</dd>
							</div>
							<div>
								<dt class="legenda"><span class="kotak asing"></span>{t('Asing', 'Foreign')}</dt>
								<dd class="tw-data text-ink text-[15px]">{formatPersen(100 - porsiLokal)}</dd>
							</div>
						</dl>
					</div>

					<div
						class="batang mt-3"
						role="img"
						aria-label="{t('Lokal', 'Local')} {formatPersen(porsiLokal)}, {t(
							'Asing',
							'Foreign'
						)} {formatPersen(100 - porsiLokal)}"
					>
						<span class="potong lokal" style="flex-basis:{porsiLokal}%"></span>
						<span class="potong asing" style="flex-basis:{100 - porsiLokal}%"></span>
					</div>

					<ul class="kategori">
						{#each kategori as satu (satu.key)}
							<li data-testid="kategori-investor">
								<span class="text-secondary truncate text-[12.5px]">{labelKategori(satu.key)}</span>
								<span class="lajur">
									<span class="isi lokal" style="width:{porsi(satu.local)}%"></span>
									<span class="isi asing" style="width:{porsi(satu.foreign)}%"></span>
								</span>
								<span class="tw-data text-ink text-right text-[12.5px]">
									{formatPersen(porsi(satu.local + satu.foreign))}
								</span>
							</li>
						{/each}
					</ul>
					<p class="catatan">
						{t(
							`Porsi dihitung dari ${formatJumlah(totalKomposisi)} yang tercatat dalam komposisi bulanan${komposisi.shares_outstanding ? `, dari total ${formatJumlah(komposisi.shares_outstanding)}` : ''}.`,
							`Shares of the ${formatJumlah(totalKomposisi)} recorded in the monthly composition${komposisi.shares_outstanding ? `, out of ${formatJumlah(komposisi.shares_outstanding)} in total` : ''}.`
						)}
					</p>
				{:else}
					<p class="kosong-bagian">
						{t(
							'Sectors belum punya data komposisi investor untuk saham ini.',
							'Sectors has no investor composition data for this stock yet.'
						)}
					</p>
				{/if}
			</section>

			<section class="panel" aria-labelledby="judul-jejak" data-testid="jejak-orang-dalam">
				<div class="kepala-bagian">
					<h2 id="judul-jejak" class="tw-overline flex items-center gap-2">
						<UserRound class="size-3.5" aria-hidden="true" />
						{t('Jejak orang dalam 90 hari', 'Insider trail, 90 days')}
					</h2>
					{#if data.redFlag}
						<a href="/insights/{data.redFlag.id}" class="tautan text-[12.5px]">
							{t('Rincian', 'Details')}
							<ArrowUpRight class="size-3.5" aria-hidden="true" />
						</a>
					{/if}
				</div>

				{#if jejak.length}
					<ol class="space-y-2">
						{#each jejak as satu, urutan (urutan)}
							<li class="flex items-start gap-2.5 text-[12.5px] leading-snug" data-testid="jejak">
								<span class="tw-data text-diamond-300 w-14 flex-none pt-0.5 text-[11.5px]">
									{tanggalPendek(satu.tanggal)}
								</span>
								<span class="text-secondary min-w-0 flex-1">{satu.teks}</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="kosong-bagian">
						{#if data.redFlag}
							{t(
								'Tidak ada transaksi orang dalam atau perubahan porsi pemegang besar dalam 90 hari terakhir.',
								'No insider trades or major holder changes in the last 90 days.'
							)}
						{:else}
							{t(
								`Transaksi orang dalam muncul setelah ${profil.ticker} dipindai dari watchlist kamu.`,
								`Insider trades appear after ${profil.ticker} is scanned from your watchlist.`
							)}
						{/if}
					</p>
				{/if}
			</section>

			<section class="panel" aria-labelledby="judul-perusahaan" data-testid="profil-perusahaan">
				<div class="kepala-bagian">
					<h2 id="judul-perusahaan" class="tw-overline flex items-center gap-2">
						<Building2 class="size-3.5" aria-hidden="true" />
						{t('Profil perusahaan', 'Company profile')}
					</h2>
				</div>
				<dl class="profil">
					{#if perusahaan.address}
						<div>
							<dt><MapPin class="size-3.5" aria-hidden="true" />{t('Alamat', 'Address')}</dt>
							<dd class="whitespace-pre-line">{perusahaan.address}</dd>
						</div>
					{/if}
					{#if perusahaan.website}
						<div>
							<dt><Globe class="size-3.5" aria-hidden="true" />{t('Situs web', 'Website')}</dt>
							<dd>
								<a
									href={perusahaan.website}
									target="_blank"
									rel="noopener noreferrer"
									class="tautan"
									data-testid="situs-emiten"
								>
									{perusahaan.website.replace(/^https?:\/\//, '')}
									<ArrowUpRight class="size-3.5" aria-hidden="true" />
								</a>
							</dd>
						</div>
					{/if}
					{#if perusahaan.phone}
						<div>
							<dt><Phone class="size-3.5" aria-hidden="true" />{t('Telepon', 'Phone')}</dt>
							<dd class="tw-data">{perusahaan.phone}</dd>
						</div>
					{/if}
					{#if perusahaan.email}
						<div>
							<dt><Mail class="size-3.5" aria-hidden="true" />Email</dt>
							<dd><a href="mailto:{perusahaan.email}" class="tautan">{perusahaan.email}</a></dd>
						</div>
					{/if}
					{#if perusahaan.employees}
						<div>
							<dt><Users class="size-3.5" aria-hidden="true" />{t('Karyawan', 'Employees')}</dt>
							<dd class="tw-data">{angka.format(perusahaan.employees)}</dd>
						</div>
					{/if}
					{#if perusahaan.listing_date}
						<div>
							<dt>
								<CalendarDays class="size-3.5" aria-hidden="true" />{t(
									'Tercatat di BEI',
									'Listed on IDX'
								)}
							</dt>
							<dd>{tanggalPanjang(perusahaan.listing_date)}</dd>
						</div>
					{/if}
					{#if perusahaan.listing_board}
						<div>
							<dt>
								<Landmark class="size-3.5" aria-hidden="true" />{t('Papan pencatatan', 'Board')}
							</dt>
							<dd>{labelPapan(perusahaan.listing_board)}</dd>
						</div>
					{/if}
					{#if industri}
						<div>
							<dt><Factory class="size-3.5" aria-hidden="true" />{t('Industri', 'Industry')}</dt>
							<dd>{industri}</dd>
						</div>
					{/if}
				</dl>
			</section>
		</div>
	</div>

	<p class="text-muted text-[12px]">
		{t(
			'Sumber: Sectors. Data pasar diperbarui harian, data pengelola dan komposisi investor mingguan.',
			'Source: Sectors. Market data refreshes daily, management and investor composition weekly.'
		)}
	</p>

	<DisclaimerBar />
</section>

<style>
	.panel {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 20px;
		}
	}

	.kembali {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13.5px;
		color: var(--color-secondary);
		transition: color 0.2s ease;
	}

	.kembali:hover {
		color: var(--color-ink);
	}

	.kepala {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px 24px;
	}

	.chip {
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 1px 8px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-secondary);
	}

	.pil-ubah {
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
		padding: 2px 8px;
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--color-secondary);
	}

	.pil-ubah[data-arah='1'] {
		background: color-mix(in srgb, var(--color-naik) 15%, transparent);
		color: var(--color-naik);
	}

	.pil-ubah[data-arah='-1'] {
		background: color-mix(in srgb, var(--color-turun) 15%, transparent);
		color: var(--color-turun);
	}

	.balik {
		background:
			radial-gradient(
				640px 220px at 90% 0%,
				color-mix(in srgb, var(--color-diamond-500) 9%, transparent),
				transparent 70%
			),
			var(--color-base);
	}

	.rantai {
		display: grid;
		gap: 10px;
		margin-top: 16px;
	}

	@media (min-width: 640px) {
		.rantai {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 1024px) {
		.rantai {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.sel-rantai {
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		background: color-mix(in srgb, var(--kilau) 4%, transparent);
		padding: 12px 14px;
	}

	.sel-rantai dt {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.sel-rantai dd {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 8px;
	}

	.sel-rantai .nama {
		font-size: 14.5px;
		font-weight: 500;
		line-height: 1.35;
		color: var(--color-ink);
	}

	.sel-rantai .kosong {
		font-size: 13px;
		color: var(--color-muted);
	}

	.kepala-bagian {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.judul-grup {
		margin: 16px 0 8px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-secondary);
	}

	.kepala-bagian + .judul-grup {
		margin-top: 0;
	}

	.daftar-orang {
		display: grid;
		gap: 8px;
	}

	@media (min-width: 640px) {
		.daftar-orang {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.daftar-orang li {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 9px 10px;
	}

	.daftar-orang li.utama {
		border-color: color-mix(in srgb, var(--color-diamond-500) 35%, transparent);
		background: color-mix(in srgb, var(--color-diamond-500) 6%, transparent);
	}

	.avatar {
		display: grid;
		width: 34px;
		height: 34px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 999px;
		background: var(--color-raised);
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 600;
		color: var(--color-secondary);
	}

	.lencana {
		flex: none;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-diamond-500) 14%, transparent);
		padding: 1px 8px;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-diamond-300);
	}

	.baris {
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 8px 2px;
	}

	.baris:last-child {
		border-bottom: 0;
	}

	.batang,
	.lajur {
		display: flex;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
		animation: sapu 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s backwards;
	}

	.batang {
		height: 12px;
	}

	@keyframes sapu {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}

	.potong {
		flex-grow: 0;
		flex-shrink: 0;
		background: light-dark(hsl(var(--rona) 55% 48%), hsl(var(--rona) 72% 64%));
	}

	.potong + .potong {
		border-left: 2px solid var(--color-base);
	}

	.potong.publik,
	.titik.publik {
		background: color-mix(in srgb, var(--color-muted) 55%, transparent);
	}

	.potong.lokal,
	.isi.lokal,
	.kotak.lokal {
		background: light-dark(hsl(204 62% 42%), hsl(204 78% 62%));
	}

	.potong.asing,
	.isi.asing,
	.kotak.asing {
		background: light-dark(hsl(284 42% 50%), hsl(284 62% 72%));
	}

	.titik {
		width: 10px;
		height: 10px;
		flex: none;
		border-radius: 3px;
		background: light-dark(hsl(var(--rona) 55% 48%), hsl(var(--rona) 72% 64%));
	}

	.catatan {
		margin-top: 10px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--color-muted);
	}

	.kosong-bagian {
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 16px;
		text-align: center;
		font-size: 13px;
		color: var(--color-secondary);
	}

	.arus {
		display: flex;
		gap: 6px;
		height: 150px;
	}

	.arus li {
		display: grid;
		flex: 1;
		grid-template-rows: 1fr 1fr 18px;
		min-width: 0;
	}

	.separuh {
		display: flex;
		justify-content: center;
	}

	.atas {
		align-items: flex-end;
		border-bottom: 1px solid var(--edge);
	}

	.bawah {
		align-items: flex-start;
	}

	.batang-arus {
		width: min(22px, 70%);
	}

	.batang-arus.naik {
		border: 1.5px solid var(--color-naik);
		border-bottom: 0;
		border-radius: 4px 4px 0 0;
		background: color-mix(in srgb, var(--color-naik) 16%, transparent);
	}

	.batang-arus.turun {
		border-radius: 0 0 4px 4px;
		background: var(--color-turun);
	}

	.label-arus {
		overflow: hidden;
		padding-top: 4px;
		text-align: center;
		font-size: 10px;
		white-space: nowrap;
		color: var(--color-muted);
	}

	.legenda {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.kotak {
		width: 9px;
		height: 9px;
		border-radius: 2px;
	}

	.kategori {
		display: grid;
		gap: 9px;
		margin-top: 16px;
	}

	.kategori li {
		display: grid;
		grid-template-columns: minmax(0, 8.5rem) 1fr 3.4rem;
		align-items: center;
		gap: 10px;
	}

	.lajur {
		height: 6px;
	}

	.isi {
		height: 100%;
	}

	.profil {
		display: grid;
		gap: 12px;
	}

	.profil div {
		display: grid;
		gap: 3px;
	}

	.profil dt {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.profil dd {
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--color-ink);
		overflow-wrap: anywhere;
	}

	.tautan {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-weight: 500;
		color: var(--color-diamond-300);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan:hover {
			color: var(--color-diamond-100);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.batang,
		.lajur {
			animation: none;
		}
	}
</style>
