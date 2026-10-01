<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowUpRight,
		Ban,
		ChartPie,
		LoaderCircle,
		ShieldAlert,
		Trash2,
		UserMinus,
		UserPlus,
		X
	} from 'lucide-svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import GrafikEmiten from './GrafikEmiten.svelte';
	import EditorKondisi from './EditorKondisi.svelte';
	import LogoEmiten from './LogoEmiten.svelte';
	import { tierDariSkor } from '$lib/skor';
	import { lokal, t } from '$lib/bahasa.svelte';
	import {
		formatRingkas,
		judulInsight,
		labelSubtype,
		waktuRelatif,
		type Insight
	} from '$lib/insight';
	import {
		NAMA_SINYAL,
		batasNotifikasi,
		formatHarga,
		formatRupiah,
		formatUbah,
		peristiwaDari,
		tanggalPendek,
		type HasilHarga,
		type ItemWatchlist,
		type Jadwal,
		type Kutipan,
		type Penutupan,
		type Risiko,
		type TabPanel
	} from '$lib/watchlist';

	let {
		item,
		kutipan,
		penutupan,
		risiko,
		jadwal,
		harga,
		insights,
		galatKondisi = '',
		galatTampilan = '',
		memindai = false,
		tab = $bindable('harga')
	}: {
		item: ItemWatchlist;
		kutipan: Kutipan | null;
		penutupan: Penutupan | null;
		risiko: Risiko | null;
		jadwal: Jadwal;
		harga: Promise<HasilHarga> | null;
		insights: Promise<Insight[]> | null;
		galatKondisi?: string;
		galatTampilan?: string;
		memindai?: boolean;
		tab?: TabPanel;
	} = $props();

	const TAB: { kunci: TabPanel; label: string }[] = $derived([
		{ kunci: 'harga', label: t('Harga', 'Price') },
		{ kunci: 'risiko', label: t('Risiko', 'Risk') },
		{ kunci: 'pemantauan', label: t('Pemantauan', 'Monitoring') }
	]);

	const IKON_PERISTIWA = { jual: UserMinus, beli: UserPlus, kepemilikan: ChartPie, suspensi: Ban };

	let yakinHapus = $state(false);

	const aksi = (nama: string) => `?emiten=${item.ticker}&/${nama}`;
	const ubah = $derived(formatUbah(penutupan?.ubah));
	const redFlag = $derived(risiko?.red_flag ?? null);
	const skor = $derived(redFlag?.score ?? null);
	const selisihSkor = $derived(
		skor !== null && risiko?.previous_score !== null && risiko?.previous_score !== undefined
			? Math.round(skor - risiko.previous_score)
			: null
	);
	const subSkor = $derived(Object.entries(redFlag?.sub_scores ?? {}));
	const batas = $derived(batasNotifikasi(item.conditions));
	const plusData = $derived(item.data_display_pref === 'insight_plus_data');
	const kondisiAktif = $derived(item.conditions.filter((kondisi) => kondisi.is_active).length);

	const posisi52 = $derived.by(() => {
		if (!kutipan?.high_52w || !kutipan.low_52w || kutipan.high_52w <= kutipan.low_52w) return null;
		const nilai =
			(kutipan.last_close_price - kutipan.low_52w) / (kutipan.high_52w - kutipan.low_52w);
		return Math.min(1, Math.max(0, nilai));
	});

	const muatan = $derived(
		harga && insights ? Promise.all([harga, insights]) : Promise.resolve(null)
	);

	function berbeda(daftar: Insight[]) {
		const kunci = (satu: Insight) => `${satu.insight_type}|${satu.subtype}|${satu.score}`;
		return daftar
			.filter((satu, urutan) => daftar.findIndex((lain) => kunci(lain) === kunci(satu)) === urutan)
			.slice(0, 4);
	}

	function geserTab(event: KeyboardEvent) {
		const arah = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!arah) return;
		event.preventDefault();
		const urutan = TAB.findIndex((satu) => satu.kunci === tab);
		tab = TAB[(urutan + arah + TAB.length) % TAB.length].kunci;
		document.getElementById(`tab-${tab}`)?.focus();
	}

	function kinerja(seri: HasilHarga['seri'], hari: number) {
		if (seri.length < 2) return null;
		const awal = seri[Math.max(0, seri.length - 1 - hari)].close;
		return formatUbah((seri[seri.length - 1].close - awal) / awal);
	}
</script>

<article
	data-testid="panel-emiten"
	data-ticker={item.ticker}
	class="panel"
	tabindex="-1"
	aria-labelledby="judul-panel"
>
	<header class="flex items-start justify-between gap-3" data-tur="detail">
		<div class="flex min-w-0 items-center gap-3">
			<LogoEmiten kode={item.ticker} ukuran={46} />
			<div class="min-w-0 space-y-0.5">
				<div class="flex flex-wrap items-center gap-1.5">
					<span id="judul-panel" class="tw-data text-ink text-[17px] font-semibold tracking-wide">
						{item.ticker}
					</span>
					{#each (kutipan?.indices ?? []).slice(0, 3) as indeks (indeks)}
						<span class="chip">{indeks}</span>
					{/each}
					{#if (kutipan?.indices.length ?? 0) > 3}
						<span class="chip" title={kutipan?.indices.slice(3).join(', ')}
							>+{(kutipan?.indices.length ?? 0) - 3}</span
						>
					{/if}
				</div>
				<p class="text-secondary truncate text-[13.5px]">{item.company_name}</p>
				{#if kutipan?.sector}
					<p class="text-muted truncate text-[12px]">
						{kutipan.sector}{kutipan.sub_sector && kutipan.sub_sector !== kutipan.sector
							? `, ${kutipan.sub_sector}`
							: ''}
					</p>
				{/if}
				<a href="/stocks/{item.ticker}" class="tautan-profil" data-testid="buka-profil">
					{t('Halaman saham lengkap', 'Full stock page')}
					<ArrowUpRight class="size-3.5" aria-hidden="true" />
				</a>
			</div>
		</div>
		<div class="flex flex-none items-center gap-2">
			<SkorBadge {skor} size="md" />
			<a
				href="/watchlist"
				data-sveltekit-noscroll
				class="tutup-lembar border-line text-secondary grid size-8 place-items-center rounded-lg border lg:hidden"
				aria-label={t(`Tutup detail ${item.ticker}`, `Close ${item.ticker} details`)}
			>
				<X class="size-4" aria-hidden="true" />
			</a>
		</div>
	</header>

	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		{#if penutupan}
			<div>
				<p class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span
						data-testid="harga-terakhir"
						class="tw-data text-ink text-[30px] leading-none font-medium"
					>
						{formatHarga(penutupan.harga)}
					</span>
					<span data-testid="perubahan-harian" class="pil-ubah" data-arah={ubah.arah}>
						{ubah.teks}
					</span>
				</p>
				<p class="text-muted mt-1.5 text-[12px]">
					{t(
						`Harga penutupan${penutupan.tanggal ? ` ${tanggalPendek(penutupan.tanggal)}` : ''} dari Sectors, bukan harga berjalan`,
						`Closing price${penutupan.tanggal ? ` for ${tanggalPendek(penutupan.tanggal)}` : ''} from Sectors, not a live price`
					)}
				</p>
			</div>
			{#if kutipan}
				<dl class="flex gap-5 text-right">
					<div>
						<dt class="text-muted text-[11.5px]">{t('Kapitalisasi', 'Market cap')}</dt>
						<dd class="tw-data text-ink mt-0.5 text-[14px]">{formatRupiah(kutipan.market_cap)}</dd>
					</div>
					{#if kutipan.market_cap_rank}
						<div>
							<dt class="text-muted text-[11.5px]">{t('Peringkat', 'Rank')}</dt>
							<dd class="tw-data text-ink mt-0.5 text-[14px]">#{kutipan.market_cap_rank}</dd>
						</div>
					{/if}
				</dl>
			{/if}
		{:else}
			{#await harga then hasilHarga}
				{@const seri = hasilHarga?.seri ?? []}
				{#if seri.length > 1}
					{@const cadangan = formatUbah(
						(seri[seri.length - 1].close - seri[seri.length - 2].close) /
							seri[seri.length - 2].close
					)}
					<div>
						<p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<span
								data-testid="harga-terakhir"
								class="tw-data text-ink text-[30px] leading-none font-medium"
							>
								{formatHarga(seri[seri.length - 1].close)}
							</span>
							<span
								class="tw-data text-[14px] font-medium {cadangan.arah > 0
									? 'text-naik'
									: cadangan.arah < 0
										? 'text-turun'
										: 'text-secondary'}"
							>
								{cadangan.teks}
							</span>
						</p>
						<p class="text-muted mt-1.5 text-[12px]">
							{t(
								`Harga penutupan ${tanggalPendek(seri[seri.length - 1].date)} dari data harian. Kapitalisasi muncul setelah pemindaian pertama.`,
								`Closing price for ${tanggalPendek(seri[seri.length - 1].date)} from daily data. Market cap appears after the first scan.`
							)}
						</p>
					</div>
				{:else}
					<p class="text-secondary text-[13px]">
						{t(
							`Harga ${item.ticker} muncul setelah pemindaian pertama mengambil laporan emitennya dari Sectors.`,
							`The ${item.ticker} price appears after the first scan pulls its company report from Sectors.`
						)}
					</p>
				{/if}
			{/await}
		{/if}
	</div>

	<div
		class="tab"
		role="tablist"
		aria-label={t(`Rincian ${item.ticker}`, `${item.ticker} details`)}
	>
		{#each TAB as satu (satu.kunci)}
			<button
				type="button"
				role="tab"
				id="tab-{satu.kunci}"
				aria-selected={tab === satu.kunci}
				aria-controls="isi-{satu.kunci}"
				tabindex={tab === satu.kunci ? 0 : -1}
				onclick={() => (tab = satu.kunci)}
				onkeydown={geserTab}
			>
				{satu.label}
				{#if satu.kunci === 'risiko' && skor !== null}
					<span class="lencana tw-data {tierDariSkor(skor).text}">{Math.round(skor)}</span>
				{:else if satu.kunci === 'pemantauan'}
					<span class="lencana tw-data">{kondisiAktif}</span>
				{/if}
			</button>
		{/each}
	</div>

	<div
		id="isi-harga"
		role="tabpanel"
		aria-labelledby="tab-harga"
		class="isi-tab"
		hidden={tab !== 'harga'}
	>
		{#await muatan}
			<div class="kerangka" aria-live="polite">
				<LoaderCircle class="text-diamond-300 size-5 animate-spin" aria-hidden="true" />
				<span class="text-secondary text-[13px]"
					>{t(
						`Memuat harga harian ${item.ticker} dari Sectors`,
						`Loading daily prices for ${item.ticker} from Sectors`
					)}</span
				>
			</div>
		{:then hasil}
			{@const seri = hasil?.[0].seri ?? []}
			{@const peristiwa = peristiwaDari(
				(hasil?.[1] ?? []).find((satu) => satu.insight_type === 'red_flag')
			)}
			{#if seri.length > 1}
				<GrafikEmiten
					kode={item.ticker}
					{seri}
					riwayat={risiko?.history ?? []}
					{batas}
					{peristiwa}
				/>
				<dl class="mt-4 grid grid-cols-3 gap-2.5">
					{#each [{ label: t('Kinerja 1 bulan', '1-month return'), nilai: kinerja(seri, 21) }, { label: t('Kinerja 3 bulan', '3-month return'), nilai: kinerja(seri, 999) }] as sel (sel.label)}
						<div class="sel">
							<dt class="text-muted text-[11.5px]">{sel.label}</dt>
							<dd
								class="tw-data mt-0.5 text-[14px] {sel.nilai && sel.nilai.arah > 0
									? 'text-naik'
									: sel.nilai && sel.nilai.arah < 0
										? 'text-turun'
										: 'text-ink'}"
							>
								{sel.nilai?.teks ?? '-'}
							</dd>
						</div>
					{/each}
					<div class="sel">
						<dt class="text-muted text-[11.5px]">Volume</dt>
						<dd class="tw-data text-ink mt-0.5 text-[14px]">
							{seri.at(-1)?.volume
								? `${formatRingkas(seri.at(-1)?.volume ?? 0)} ${t('lbr', 'shares')}`
								: '-'}
						</dd>
					</div>
				</dl>
			{:else}
				<p data-testid="harga-kosong" class="kerangka text-secondary text-[13px]">
					{hasil?.[0].galat ||
						t(
							`Belum ada data harga harian untuk ${item.ticker}.`,
							`No daily price data for ${item.ticker} yet.`
						)}
				</p>
			{/if}
		{/await}
		{#if posisi52 !== null && kutipan}
			<div class="mt-5">
				<div class="text-muted flex justify-between text-[11.5px]">
					<span>{t('Terendah 52 minggu', '52-week low')}</span>
					<span>{t('Tertinggi 52 minggu', '52-week high')}</span>
				</div>
				<div
					class="rentang mt-1.5"
					role="img"
					aria-label={t(
						`Harga ${formatHarga(kutipan.last_close_price)} berada di ${Math.round(posisi52 * 100)} persen rentang 52 minggu`,
						`Price ${formatHarga(kutipan.last_close_price)} sits at ${Math.round(posisi52 * 100)} percent of the 52-week range`
					)}
				>
					<span class="penanda-rentang" style="left:{posisi52 * 100}%"></span>
				</div>
				<div class="tw-data text-secondary mt-1 flex justify-between text-[12px]">
					<span>{formatHarga(kutipan.low_52w)}</span>
					<span>{formatHarga(kutipan.high_52w)}</span>
				</div>
			</div>
		{/if}
	</div>

	<div
		id="isi-risiko"
		role="tabpanel"
		aria-labelledby="tab-risiko"
		class="isi-tab space-y-5"
		hidden={tab !== 'risiko'}
	>
		<section class="space-y-3" aria-labelledby="judul-risiko">
			<div class="flex items-center justify-between gap-3">
				<h3 id="judul-risiko" class="tw-overline flex items-center gap-2">
					<ShieldAlert class="size-3.5" aria-hidden="true" />
					{t('Tata kelola', 'Governance')}
				</h3>
				{#if redFlag}
					<span class="text-muted text-[11.5px]"
						>{t('dihitung', 'calculated')} {waktuRelatif(redFlag.generated_at)}</span
					>
				{/if}
			</div>

			{#if redFlag && skor !== null}
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span class="tw-data text-[26px] leading-none font-semibold {tierDariSkor(skor).text}"
						>{Math.round(skor)}</span
					>
					<span class="text-[13px] font-medium {tierDariSkor(skor).text}"
						>{tierDariSkor(skor).label}</span
					>
					{#if selisihSkor !== null && selisihSkor !== 0}
						<span class="tw-data text-secondary text-[12px]">
							{selisihSkor > 0 ? t('naik', 'up') : t('turun', 'down')}
							{Math.abs(selisihSkor)}
							{t('dari sebelumnya', 'from previous')}
						</span>
					{/if}
					{#if redFlag.multiplier && redFlag.multiplier > 1}
						<span class="chip ml-auto"
							>{t('Pola silang', 'Cross pattern')} ×{redFlag.multiplier.toLocaleString(
								lokal()
							)}</span
						>
					{/if}
				</div>
				<ul class="space-y-2.5">
					{#each subSkor as [kunci, nilai] (kunci)}
						<li
							class="grid grid-cols-[minmax(0,9.5rem)_1fr_2.2rem] items-center gap-3 text-[12.5px]"
						>
							<span class="text-secondary truncate">{NAMA_SINYAL[kunci] ?? kunci}</span>
							<span class="lajur"
								><span
									class="isi"
									style="width:{Math.max(nilai, 3)}%; background:{tierDariSkor(nilai).color}"
								></span></span
							>
							<span class="tw-data text-ink text-right">{Math.round(nilai)}</span>
						</li>
					{/each}
				</ul>
				<a href="/insights/{redFlag.id}" class="tautan">
					{t('Buka rincian dan sumber datanya', 'Open details and data sources')}
					<ArrowUpRight class="size-3.5" aria-hidden="true" />
				</a>
			{:else if memindai}
				<p class="text-secondary flex items-center gap-2 text-[13px]" data-testid="sedang-dipindai">
					<LoaderCircle class="text-diamond-300 size-4 flex-none animate-spin" aria-hidden="true" />
					{t(
						`TripWire sedang memindai ${item.ticker} dari Sectors. Skor muncul di sini dalam beberapa detik.`,
						`TripWire is scanning ${item.ticker} from Sectors. The score shows up here in a few seconds.`
					)}
				</p>
			{:else}
				<p class="text-secondary text-[13px]">
					{t(
						`Belum ada skor. Skor pertama muncul setelah putaran pemindaian berikutnya memeriksa ${item.ticker}.`,
						`No score yet. The first score appears after the next scan run checks ${item.ticker}.`
					)}
				</p>
			{/if}
		</section>

		{#await insights then hasilInsight}
			{@const daftar = hasilInsight ?? []}
			{@const peristiwa = peristiwaDari(daftar.find((satu) => satu.insight_type === 'red_flag'))}
			{#if plusData && peristiwa.length}
				<section class="space-y-2.5" aria-labelledby="judul-peristiwa">
					<h3 id="judul-peristiwa" class="tw-overline">
						{t('Peristiwa pendukung', 'Supporting events')}
					</h3>
					<ol data-testid="daftar-peristiwa" class="space-y-1.5">
						{#each peristiwa.slice(0, 6) as satu, urutan (urutan)}
							{@const Ikon = IKON_PERISTIWA[satu.jenis]}
							<li class="flex items-start gap-2.5 text-[12.5px] leading-snug">
								<span class="ikon-peristiwa"><Ikon class="size-3" aria-hidden="true" /></span>
								<span class="tw-data text-diamond-300 w-14 flex-none pt-0.5 text-[11.5px]"
									>{tanggalPendek(satu.tanggal)}</span
								>
								<span class="text-secondary min-w-0 flex-1">{satu.teks}</span>
							</li>
						{/each}
					</ol>
				</section>
			{/if}
			{#if daftar.length}
				<section class="space-y-2" aria-labelledby="judul-insight">
					<h3 id="judul-insight" class="tw-overline">
						{t(`Insight terbaru ${item.ticker}`, `Latest insights for ${item.ticker}`)}
					</h3>
					<ul class="space-y-1.5">
						{#each berbeda(daftar) as insight (insight.id)}
							<li>
								<a href="/insights/{insight.id}" data-testid="insight-emiten" class="baris-insight">
									<SkorBadge skor={insight.score} showLabel={false} />
									<span class="min-w-0 flex-1">
										<span class="text-ink block truncate text-[13px]">{judulInsight(insight)}</span>
										<span class="text-muted text-[11.5px]"
											>{labelSubtype(insight.subtype)}, {waktuRelatif(insight.generated_at)}</span
										>
									</span>
									<ArrowUpRight class="text-muted size-3.5 flex-none" aria-hidden="true" />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/await}
	</div>

	<div
		id="isi-pemantauan"
		role="tabpanel"
		aria-labelledby="tab-pemantauan"
		class="isi-tab space-y-5"
		hidden={tab !== 'pemantauan'}
	>
		<EditorKondisi {item} jadwal={jadwal.conditions} galat={galatKondisi} />

		<section class="border-line space-y-3 border-t pt-4" aria-labelledby="judul-pengaturan">
			<h3 id="judul-pengaturan" class="tw-overline">
				{t(`Pengaturan ${item.ticker}`, `${item.ticker} settings`)}
			</h3>

			<form method="POST" action={aksi('ubahTampilan')} use:enhance class="space-y-1.5">
				<input type="hidden" name="item_id" value={item.id} />
				<p id="label-tampilan" class="text-secondary text-[12.5px] font-medium">
					{t('Tampilan data', 'Data display')}
				</p>
				<div class="segmen" role="group" aria-labelledby="label-tampilan">
					{#each [['insight_only', t('Insight saja', 'Insight only')], ['insight_plus_data', t('Insight plus data pendukung', 'Insight plus supporting data')]] as [nilai, label] (nilai)}
						<button
							type="submit"
							name="data_display_pref"
							value={nilai}
							data-testid="tampilan-{nilai}"
							aria-pressed={item.data_display_pref === nilai}
							class:aktif={item.data_display_pref === nilai}
						>
							{label}
						</button>
					{/each}
				</div>
				{#if galatTampilan}
					<p role="alert" class="text-tier-critical text-[12.5px]">{galatTampilan}</p>
				{/if}
			</form>

			{#if yakinHapus}
				<form method="POST" action="?/hapus" use:enhance class="konfirmasi">
					<input type="hidden" name="item_id" value={item.id} />
					<p class="text-ink text-[13px]">
						{t(
							`Hapus ${item.ticker} beserta ${item.conditions.length} kondisinya dari watchlist?`,
							`Remove ${item.ticker} and its ${item.conditions.length} ${
								item.conditions.length === 1 ? 'condition' : 'conditions'
							} from your watchlist?`
						)}
					</p>
					<div class="flex gap-2">
						<button
							type="button"
							class="tw-ghost px-3 py-1.5 text-[13px]"
							onclick={() => (yakinHapus = false)}>{t('Batal', 'Cancel')}</button
						>
						<button type="submit" data-testid="konfirmasi-hapus" class="tombol-hapus">
							<Trash2 class="size-3.5" aria-hidden="true" />
							{t('Ya, hapus', 'Yes, remove')}
						</button>
					</div>
				</form>
			{:else}
				<button
					type="button"
					data-testid="hapus-ticker"
					class="tombol-hapus-awal"
					onclick={() => (yakinHapus = true)}
				>
					<Trash2 class="size-3.5" aria-hidden="true" />
					{t(`Hapus ${item.ticker} dari watchlist`, `Remove ${item.ticker} from watchlist`)}
				</button>
			{/if}
		</section>
	</div>
</article>

<style>
	.panel {
		outline: none;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 20px;
		box-shadow:
			0 1px 0 color-mix(in srgb, var(--cahaya) 5%, transparent) inset,
			0 40px 100px -50px rgba(74, 158, 255, 0.4);
	}

	.pil-ubah {
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-secondary) 10%, transparent);
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

	.chip {
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 1px 8px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-secondary);
	}

	.rentang {
		position: relative;
		height: 6px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--kilau) 10%, transparent),
			color-mix(in srgb, var(--kilau) 28%, transparent)
		);
	}

	.penanda-rentang {
		position: absolute;
		top: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		border: 2px solid var(--color-base);
		border-radius: 3px;
		background: var(--color-ink);
		transform: rotate(45deg);
	}

	.tab {
		display: flex;
		gap: 2px;
		margin-top: 18px;
		overflow-x: auto;
		border-bottom: 1px solid var(--edge-soft);
		scrollbar-width: none;
	}

	.tab button {
		position: relative;
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 7px;
		padding: 9px 12px 10px;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--color-muted);
		transition: color 0.2s ease;
	}

	.tab button:hover,
	.tab button[aria-selected='true'] {
		color: var(--color-ink);
	}

	.tab button[aria-selected='true']::after {
		content: '';
		position: absolute;
		right: 10px;
		bottom: -1px;
		left: 10px;
		height: 2px;
		border-radius: 2px;
		background: var(--color-diamond-500);
	}

	.lencana {
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
		padding: 0 6px;
		font-size: 11px;
		line-height: 17px;
		color: var(--color-secondary);
	}

	.isi-tab {
		padding-top: 18px;
	}

	.kerangka {
		display: flex;
		min-height: 180px;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 20px;
		text-align: center;
	}

	.sel {
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		background: color-mix(in srgb, var(--cahaya) 2%, transparent);
		padding: 8px 10px;
	}

	.ikon-peristiwa {
		display: grid;
		width: 22px;
		height: 22px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 999px;
		background: var(--color-raised);
		color: var(--color-secondary);
	}

	.baris-insight {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 8px 10px;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	@media (hover: hover) {
		.baris-insight:hover {
			border-color: var(--color-diamond-700);
			background: rgba(74, 158, 255, 0.05);
		}
	}

	.lajur {
		position: relative;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transform-origin: left;
		animation: isi 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s backwards;
	}

	@keyframes isi {
		from {
			transform: scaleX(0);
		}
	}

	.tautan-profil {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding-top: 3px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--color-diamond-300);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan-profil:hover {
			color: var(--color-diamond-100);
		}
	}

	.tautan {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-diamond-300);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan:hover {
			color: var(--color-diamond-100);
		}
	}

	.segmen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-void) 55%, transparent);
		padding: 4px;
	}

	.segmen button {
		border-radius: 9px;
		padding: 7px 10px;
		font-size: 12.5px;
		color: var(--color-secondary);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.segmen button.aktif {
		background: rgba(74, 158, 255, 0.15);
		color: var(--color-diamond-100);
	}

	.tombol-hapus-awal {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--color-muted);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tombol-hapus-awal:hover {
			color: var(--color-tier-critical);
		}
	}

	.konfirmasi {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		border: 1px solid color-mix(in srgb, var(--color-tier-critical) 35%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-tier-critical) 8%, transparent);
		padding: 10px 12px;
	}

	.tombol-hapus {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border-radius: 10px;
		background: var(--color-tier-critical);
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 600;
		color: #1a0508;
	}
</style>
