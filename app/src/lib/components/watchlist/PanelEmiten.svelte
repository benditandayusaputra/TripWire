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
	import { tierDariSkor } from '$lib/skor';
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
		type Risiko
	} from '$lib/watchlist';

	let {
		item,
		kutipan,
		risiko,
		jadwal,
		harga,
		insights,
		galatKondisi = '',
		galatTampilan = ''
	}: {
		item: ItemWatchlist;
		kutipan: Kutipan | null;
		risiko: Risiko | null;
		jadwal: Jadwal;
		harga: Promise<HasilHarga> | null;
		insights: Promise<Insight[]> | null;
		galatKondisi?: string;
		galatTampilan?: string;
	} = $props();

	const IKON_PERISTIWA = { jual: UserMinus, beli: UserPlus, kepemilikan: ChartPie, suspensi: Ban };

	let yakinHapus = $state(false);

	const aksi = (nama: string) => `?emiten=${item.ticker}&/${nama}`;
	const ubah = $derived(formatUbah(kutipan?.daily_close_change));
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
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0 space-y-1">
			<div class="flex items-center gap-2">
				<span
					id="judul-panel"
					class="tw-data bg-raised text-ink rounded-md px-2 py-0.5 text-[14px] font-semibold tracking-wide"
				>
					{item.ticker}
				</span>
				{#each kutipan?.indices ?? [] as indeks (indeks)}
					<span class="chip">{indeks}</span>
				{/each}
			</div>
			<p class="text-ink truncate text-[15px] font-medium">{item.company_name}</p>
			{#if kutipan?.sector}
				<p class="text-muted truncate text-[12px]">
					{kutipan.sector}{kutipan.sub_sector && kutipan.sub_sector !== kutipan.sector
						? `, ${kutipan.sub_sector}`
						: ''}
				</p>
			{/if}
		</div>
		<div class="flex flex-none items-center gap-2">
			<SkorBadge {skor} size="md" />
			<a
				href="/watchlist"
				data-sveltekit-noscroll
				class="tutup-lembar border-line text-secondary grid size-8 place-items-center rounded-lg border lg:hidden"
				aria-label="Tutup detail {item.ticker}"
			>
				<X class="size-4" aria-hidden="true" />
			</a>
		</div>
	</header>

	<div class="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		{#if kutipan}
			<div>
				<p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span
						data-testid="harga-terakhir"
						class="tw-data text-ink text-[30px] leading-none font-medium"
					>
						{formatHarga(kutipan.last_close_price)}
					</span>
					<span
						data-testid="perubahan-harian"
						class="tw-data text-[14px] font-medium {ubah.arah > 0
							? 'text-naik'
							: ubah.arah < 0
								? 'text-turun'
								: 'text-secondary'}"
					>
						{ubah.teks}
					</span>
				</p>
				<p class="text-muted mt-1.5 text-[12px]">
					Harga penutupan{kutipan.latest_close_date
						? ` ${tanggalPendek(kutipan.latest_close_date)}`
						: ''}, bukan harga berjalan
				</p>
			</div>
			<dl class="flex gap-5 text-right">
				<div>
					<dt class="text-muted text-[11.5px]">Kapitalisasi</dt>
					<dd class="tw-data text-ink mt-0.5 text-[14px]">{formatRupiah(kutipan.market_cap)}</dd>
				</div>
				{#if kutipan.market_cap_rank}
					<div>
						<dt class="text-muted text-[11.5px]">Peringkat</dt>
						<dd class="tw-data text-ink mt-0.5 text-[14px]">#{kutipan.market_cap_rank}</dd>
					</div>
				{/if}
			</dl>
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
							Harga penutupan {tanggalPendek(seri[seri.length - 1].date)} dari data harian. Kapitalisasi
							muncul setelah pemindaian pertama.
						</p>
					</div>
				{:else}
					<p class="text-secondary text-[13px]">
						Harga {item.ticker} muncul setelah pemindaian pertama mengambil laporan emitennya dari Sectors.
					</p>
				{/if}
			{/await}
		{/if}
	</div>

	{#if posisi52 !== null && kutipan}
		<div class="mt-4">
			<div class="text-muted flex justify-between text-[11.5px]">
				<span>Terendah 52 minggu</span>
				<span>Tertinggi 52 minggu</span>
			</div>
			<div
				class="rentang mt-1.5"
				role="img"
				aria-label="Harga {formatHarga(kutipan.last_close_price)} berada di {Math.round(
					posisi52 * 100
				)} persen rentang 52 minggu"
			>
				<span class="penanda-rentang" style="left:{posisi52 * 100}%"></span>
			</div>
			<div class="tw-data text-secondary mt-1 flex justify-between text-[12px]">
				<span>{formatHarga(kutipan.low_52w)}</span>
				<span>{formatHarga(kutipan.high_52w)}</span>
			</div>
		</div>
	{/if}

	<div class="border-line mt-5 border-t pt-4">
		{#await muatan}
			<div class="kerangka" aria-live="polite">
				<LoaderCircle class="text-diamond-300 size-5 animate-spin" aria-hidden="true" />
				<span class="text-secondary text-[13px]"
					>Memuat harga harian {item.ticker} dari Sectors</span
				>
			</div>
		{:then hasil}
			{@const seri = hasil?.[0].seri ?? []}
			{@const daftar = hasil?.[1] ?? []}
			{@const peristiwa = peristiwaDari(daftar.find((satu) => satu.insight_type === 'red_flag'))}
			{#if seri.length > 1}
				<GrafikEmiten
					kode={item.ticker}
					{seri}
					riwayat={risiko?.history ?? []}
					{batas}
					{peristiwa}
				/>
				<dl class="mt-4 grid grid-cols-3 gap-2.5">
					{#each [{ label: '1 bulan', nilai: kinerja(seri, 21) }, { label: '3 bulan', nilai: kinerja(seri, 999) }] as sel (sel.label)}
						<div class="sel">
							<dt class="text-muted text-[11.5px]">Kinerja {sel.label}</dt>
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
							{seri.at(-1)?.volume ? `${formatRingkas(seri.at(-1)?.volume ?? 0)} lbr` : '-'}
						</dd>
					</div>
				</dl>
			{:else}
				<p data-testid="harga-kosong" class="kerangka text-secondary text-[13px]">
					{hasil?.[0].galat || `Belum ada data harga harian untuk ${item.ticker}.`}
				</p>
			{/if}

			{#if plusData && peristiwa.length}
				<section class="mt-5 space-y-2.5" aria-labelledby="judul-peristiwa">
					<h3 id="judul-peristiwa" class="tw-overline">Peristiwa pendukung</h3>
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
				<section class="mt-5 space-y-2" aria-labelledby="judul-insight">
					<h3 id="judul-insight" class="tw-overline">Insight terbaru {item.ticker}</h3>
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

	<section class="border-line mt-5 space-y-3 border-t pt-4" aria-labelledby="judul-risiko">
		<div class="flex items-center justify-between gap-3">
			<h3 id="judul-risiko" class="tw-overline flex items-center gap-2">
				<ShieldAlert class="size-3.5" aria-hidden="true" />
				Tata kelola
			</h3>
			{#if redFlag}
				<span class="text-muted text-[11.5px]">dihitung {waktuRelatif(redFlag.generated_at)}</span>
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
						{selisihSkor > 0 ? 'naik' : 'turun'}
						{Math.abs(selisihSkor)} dari sebelumnya
					</span>
				{/if}
				{#if redFlag.multiplier && redFlag.multiplier > 1}
					<span class="chip ml-auto">Pola silang ×{redFlag.multiplier.toLocaleString('id-ID')}</span
					>
				{/if}
			</div>
			<ul class="space-y-2.5">
				{#each subSkor as [kunci, nilai] (kunci)}
					<li class="grid grid-cols-[minmax(0,9.5rem)_1fr_2.2rem] items-center gap-3 text-[12.5px]">
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
				Buka rincian dan sumber datanya
				<ArrowUpRight class="size-3.5" aria-hidden="true" />
			</a>
		{:else}
			<p class="text-secondary text-[13px]">
				Belum ada skor. Skor pertama muncul setelah putaran pemindaian berikutnya memeriksa {item.ticker}.
			</p>
		{/if}
	</section>

	<div class="border-line mt-5 border-t pt-4">
		<EditorKondisi {item} jadwal={jadwal.conditions} galat={galatKondisi} />
	</div>

	<section class="border-line mt-5 space-y-3 border-t pt-4" aria-labelledby="judul-pengaturan">
		<h3 id="judul-pengaturan" class="tw-overline">Pengaturan {item.ticker}</h3>

		<form method="POST" action={aksi('ubahTampilan')} use:enhance class="space-y-1.5">
			<input type="hidden" name="item_id" value={item.id} />
			<p id="label-tampilan" class="text-secondary text-[12.5px] font-medium">Tampilan data</p>
			<div class="segmen" role="group" aria-labelledby="label-tampilan">
				{#each [['insight_only', 'Insight saja'], ['insight_plus_data', 'Insight plus data pendukung']] as [nilai, label] (nilai)}
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
					Hapus {item.ticker} beserta {item.conditions.length} kondisinya dari watchlist?
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						onclick={() => (yakinHapus = false)}>Batal</button
					>
					<button type="submit" data-testid="konfirmasi-hapus" class="tombol-hapus">
						<Trash2 class="size-3.5" aria-hidden="true" />
						Ya, hapus
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
				Hapus {item.ticker} dari watchlist
			</button>
		{/if}
	</section>
</article>

<style>
	.panel {
		outline: none;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 20px;
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.05) inset,
			0 40px 100px -50px rgba(74, 158, 255, 0.4);
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
		background: linear-gradient(90deg, rgba(180, 205, 255, 0.1), rgba(180, 205, 255, 0.28));
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
		background: rgba(255, 255, 255, 0.02);
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
		background: rgba(180, 205, 255, 0.08);
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
		background: rgba(8, 11, 18, 0.55);
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
