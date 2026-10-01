<script lang="ts">
	import {
		ArrowLeft,
		Braces,
		CalendarClock,
		Database,
		Factory,
		Gem,
		LoaderCircle,
		MapPin,
		ShieldCheck,
		ShieldX,
		TrendingDown,
		TrendingUp
	} from 'lucide-svelte';
	import GrafikHarga from '$lib/components/Chart/GrafikHarga.svelte';
	import PetaSitus from '$lib/components/Map/PetaSitus.svelte';
	import { warnaKomoditas } from '$lib/components/Map/warna';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import BuktiSectors from '$lib/components/insight/BuktiSectors.svelte';
	import RumusSkor from '$lib/components/insight/RumusSkor.svelte';
	import GrafikEmiten from '$lib/components/watchlist/GrafikEmiten.svelte';
	import {
		formatAngka,
		formatBertanda,
		formatTanggal,
		formatTanggalSaja,
		formatPoin,
		judulInsight,
		labelKategori,
		labelKomoditas,
		labelMetrik,
		labelSubtype,
		labelSumber,
		labelTipePerusahaan,
		satuanAwam,
		selisihHari
	} from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';
	import { peristiwaDari } from '$lib/watchlist';
	import { bahasa, t } from '$lib/bahasa.svelte';

	let { data } = $props();

	const TIER = [
		{ batas: 30, warna: 'var(--color-tier-low)' },
		{ batas: 60, warna: 'var(--color-tier-moderate)' },
		{ batas: 85, warna: 'var(--color-tier-high)' },
		{ batas: 100, warna: 'var(--color-tier-critical)' }
	];

	const insight = $derived(data.insight);
	const payload = $derived(insight.payload ?? {});
	const verifikasi = $derived(data.verification);
	const adaSkor = $derived(insight.score !== null && insight.score !== undefined);
	const tier = $derived(tierDariSkor(insight.score));
	const redFlag = $derived(insight.insight_type === 'red_flag');
	const peristiwa = $derived(redFlag ? peristiwaDari(insight) : []);

	const snapshot = $derived(payload.sector_snapshot);
	const metrik = $derived(snapshot?.metrics ?? []);
	const eksposur = $derived(payload.commodity_exposure);
	const produksi = $derived(payload.production_trend);
	const harga = $derived(payload.commodity_price);
	const radar = $derived(payload.license_radar);
	const situs = $derived(payload.mine_sites ?? []);
	const situsBerkoordinat = $derived(
		situs.filter((item) => item.latitude !== null && item.longitude !== null)
	);
	const sumber = $derived(labelSumber(payload.data_sources ?? []));

	const labelSkor = $derived(
		redFlag ? 'Red Flag Score' : t('Eksposur komoditas', 'Commodity exposure')
	);

	const komponenEksposur = $derived(
		eksposur
			? [
					{
						kunci: 'production_trend',
						label: t('Tren produksi', 'Production trend'),
						nilai: eksposur.components.production_trend
					},
					{
						kunci: 'commodity_price_trend',
						label: t('Tren harga komoditas', 'Commodity price trend'),
						nilai: eksposur.components.commodity_price_trend
					},
					{
						kunci: 'reserve_life',
						label: t('Umur cadangan', 'Reserve life'),
						nilai: eksposur.components.reserve_life
					}
				]
			: []
	);

	function alasanSegel(hasil: {
		signature_valid: boolean;
		hash_valid: boolean;
		chain_valid: boolean;
	}) {
		if (!hasil.signature_valid)
			return t(
				'Isi insight ini sudah berubah setelah disegel.',
				'The content of this insight changed after it was sealed.'
			);
		if (!hasil.hash_valid)
			return t(
				'Catatan insight ini tidak cocok dengan urutan catatan sebelumnya.',
				'This insight record does not match the sequence of earlier records.'
			);
		if (!hasil.chain_valid)
			return t(
				'Catatan insight sebelumnya tidak ditemukan.',
				'The previous insight record could not be found.'
			);
		return '';
	}

	function penjelasanEntitas(tipe: string, faktor: number) {
		const nama = labelTipePerusahaan(tipe).toLowerCase();
		const jenis = `${/^[aeiou]/.test(nama) ? 'an' : 'a'} ${nama}`;
		if (faktor >= 1)
			return t(
				`Perusahaan ini ${nama}, jadi skornya dihitung penuh.`,
				`This company is ${jenis}, so its score counts in full.`
			);
		return t(
			`Perusahaan ini ${nama}, bukan penambang langsung, jadi skornya dikurangi.`,
			`This company is ${jenis}, not a direct miner, so its score is reduced.`
		);
	}

	function teksSelisih(baris: { unit: string; difference: number; difference_pct: number | null }) {
		if (baris.unit === '%') return formatPoin(baris.difference);
		return formatBertanda(baris.difference_pct);
	}

	function teksNilai(nilai: number, unit: string) {
		return unit === '%' ? `${formatAngka(nilai)}%` : `${formatAngka(nilai)}x`;
	}

	function skala(baris: { value: number; sector_average: number }) {
		return Math.max(Math.abs(baris.value), Math.abs(baris.sector_average), 0.0001);
	}

	function teksLisensi(kedaluwarsa: string) {
		const hari = selisihHari(kedaluwarsa, insight.generated_at);
		const jumlah = Math.abs(hari);
		const satuan = jumlah === 1 ? 'day' : 'days';
		if (hari < 0) return t(`lewat ${jumlah} hari`, `${jumlah} ${satuan} ago`);
		return t(`${hari} hari lagi`, `${hari} ${satuan} left`);
	}
</script>

<svelte:head>
	<title>{insight.ticker} · {judulInsight(insight)}</title>
</svelte:head>

<section class="space-y-5">
	<a href="/stocks/{insight.ticker}" class="kembali">
		<ArrowLeft class="size-3.5" aria-hidden="true" />
		{t(`Kembali ke halaman ${insight.ticker}`, `Back to ${insight.ticker}`)}
	</a>

	<header class="panel hero" style="--rona-tier:{adaSkor ? tier.color : 'var(--color-secondary)'}">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
			<div class="skor-hero" data-testid="skor-badge" data-tier={adaSkor ? tier.tier : 'none'}>
				{#if adaSkor}
					<span class="tw-data text-[46px] leading-none font-semibold {tier.text}">
						{Math.round(insight.score ?? 0)}
					</span>
					<span class="text-[13px] font-semibold sm:mt-1.5 {tier.text}">{tier.label}</span>
				{:else}
					<span class="font-display text-secondary text-[26px] leading-none font-semibold"
						>Info</span
					>
					<span class="text-muted text-[12px] sm:mt-1.5">{t('Tanpa skor', 'No score')}</span>
				{/if}
				{#if adaSkor}
					<span class="tw-overline text-[9.5px] sm:mt-2">{labelSkor}</span>
				{/if}
			</div>

			<div class="min-w-0 flex-1 space-y-2">
				<p class="tw-overline">
					{labelSubtype(insight.subtype)} · {formatTanggal(insight.generated_at)} WIB
				</p>
				<h1
					data-testid="detail-judul"
					class="tw-title text-ink text-[22px] leading-snug sm:text-[26px]"
				>
					{judulInsight(insight)}
				</h1>
				<p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
					<a
						href="/stocks/{insight.ticker}"
						data-testid="detail-ticker"
						class="tw-data text-diamond-300 hover:text-diamond-100 text-[17px] font-semibold tracking-wider transition"
					>
						{insight.ticker}
					</a>
					<span class="text-secondary text-[14px]">{insight.company_name}</span>
				</p>
				{#if redFlag && adaSkor}
					<div class="meteran" aria-hidden="true">
						{#each TIER as satu, urutan (satu.batas)}
							<span
								style="flex-basis:{satu.batas -
									(urutan ? TIER[urutan - 1].batas : 0)}%; background:{satu.warna}"
							></span>
						{/each}
						<span class="jarum" style="left:{Math.min(100, insight.score ?? 0)}%"></span>
					</div>
				{/if}
			</div>
		</div>

		{#if verifikasi}
			<div class="segel" data-testid="badge-signature" data-valid={verifikasi.valid}>
				{#if verifikasi.valid}
					<ShieldCheck class="text-tier-low size-5 flex-none" aria-hidden="true" />
					<div class="min-w-0 flex-1">
						<p class="text-tier-low text-[13px] font-semibold">
							{t('Segel keaslian valid', 'Authenticity seal valid')}
						</p>
						<p class="text-secondary text-[12.5px]">
							{t(
								'Ditandatangani Ed25519 dan tersambung ke rantai hash. Isinya sama persis dengan saat dibuat.',
								'Signed with Ed25519 and linked to the hash chain. The content is exactly as it was when created.'
							)}
						</p>
						<p class="tw-data text-muted mt-1 truncate text-[11px]">
							hash {insight.current_hash.slice(0, 16)}…
						</p>
					</div>
				{:else}
					<ShieldX class="text-tier-critical size-5 flex-none" aria-hidden="true" />
					<div class="min-w-0 flex-1">
						<p class="text-tier-critical text-[13px] font-semibold">
							{t('Segel tidak cocok', 'Seal does not match')}
						</p>
						{#if alasanSegel(verifikasi)}
							<p class="text-tier-critical text-[12.5px]">{alasanSegel(verifikasi)}</p>
						{/if}
					</div>
				{/if}
				<a
					href="/verify-insight?id={insight.id}"
					class="tw-ghost flex-none px-3 py-1.5 text-[13px]"
					data-testid="cek-keaslian"
				>
					{t('Cek keaslian', 'Check authenticity')}
				</a>
			</div>
		{/if}
	</header>

	<DisclaimerBar />

	{#if redFlag}
		<div class="grid items-stretch gap-5 lg:grid-cols-12">
			<div class="min-w-0 lg:col-span-5">
				<RumusSkor {insight} />
			</div>
			<div class="min-w-0 lg:col-span-7">
				<section
					class="panel h-full"
					aria-label={t('Harga dan peristiwa', 'Price and events')}
					data-testid="grafik-insight"
				>
					{#await data.harga}
						<div class="kerangka" aria-live="polite">
							<LoaderCircle class="text-diamond-300 size-5 animate-spin" aria-hidden="true" />
							<span class="text-secondary text-[13px]">
								{t('Memuat harga harian dari Sectors', 'Loading daily prices from Sectors')}
							</span>
						</div>
					{:then hasil}
						{#if hasil && hasil.seri.length > 1}
							<GrafikEmiten
								kode={insight.ticker}
								seri={hasil.seri}
								riwayat={data.riwayat}
								batas={data.batas}
								{peristiwa}
							/>
							<p class="text-muted mt-3 text-[12px] leading-relaxed">
								{t(
									'Ikon di bawah candle menandai kapan suspensi, transaksi orang dalam, dan perubahan pemegang saham terjadi. Tanda bahaya yang jatuh berdekatan itulah yang menaikkan skor.',
									'Icons under the candles mark when suspensions, insider trades, and shareholder changes happened. Red flags that land close together are what raise the score.'
								)}
							</p>
						{:else}
							<p class="kerangka text-secondary text-[13px]">
								{hasil?.galat ||
									t('Harga harian belum tersedia.', 'Daily prices are not available yet.')}
							</p>
						{/if}
					{/await}
				</section>
			</div>
		</div>

		<BuktiSectors {insight} />
	{/if}

	{#if eksposur}
		<div class="grid items-stretch gap-5 lg:grid-cols-12">
			<section class="panel lg:col-span-5" data-testid="bagian-eksposur">
				<h2 class="tw-heading text-ink">
					{t('Seberapa besar pengaruh komoditas', 'How much commodities affect the business')}
				</h2>
				<p class="tw-overline mt-1">
					{labelKomoditas(eksposur.commodity)} · {labelKategori(eksposur.category)}
				</p>
				<dl class="mt-4 space-y-3">
					{#each komponenEksposur as item (item.kunci)}
						<div class="komponen" data-testid="komponen-eksposur" data-nama={item.kunci}>
							<dt class="text-secondary text-[13px]">{item.label}</dt>
							<dd class="flex items-center gap-3">
								<span class="lajur">
									{#if item.nilai !== null}
										<span class="isi" style="width:{Math.max(item.nilai, 2)}%"></span>
									{/if}
								</span>
								<span class="tw-data text-ink w-8 text-right text-[14px]">
									{item.nilai === null ? '-' : Math.round(item.nilai)}
								</span>
							</dd>
						</div>
					{/each}
				</dl>
				<p class="text-secondary mt-4 text-[13px] leading-relaxed">
					{#if bahasa() === 'en'}
						The higher the score, the more swings in {labelKomoditas(
							eksposur.commodity
						).toLowerCase()} prices and production affect the company's business.
						{penjelasanEntitas(eksposur.entity_type, eksposur.entity_factor)} Parts without available
						data are left out of the calculation.
					{:else}
						Makin tinggi skornya, makin besar pengaruh naik turun harga dan produksi
						{labelKomoditas(eksposur.commodity).toLowerCase()} terhadap bisnis perusahaan.
						{penjelasanEntitas(eksposur.entity_type, eksposur.entity_factor)} Bagian yang datanya belum
						tersedia tidak ikut dihitung.
					{/if}
				</p>
			</section>

			{#if harga}
				<section class="panel lg:col-span-7" data-testid="harga-komoditas">
					<p class="tw-overline">
						{t(
							`Harga ${labelKomoditas(harga.commodity)} · 12 bulan`,
							`${labelKomoditas(harga.commodity)} price · 12 months`
						)}
					</p>
					<div class="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
						<span class="tw-data text-ink text-[28px] font-semibold"
							>{formatAngka(harga.latest)}</span
						>
						<span class="tw-data text-muted text-[12px]">{harga.unit}</span>
						{#if harga.yoy_pct !== null}
							<span class="tw-data text-[13px] {harga.yoy_pct >= 0 ? 'text-naik' : 'text-turun'}">
								{harga.yoy_pct >= 0 ? '▲' : '▼'}
								{formatBertanda(harga.yoy_pct)}
							</span>
						{/if}
						<span class="tw-overline ml-auto text-[9.5px]">
							{t('per', 'as of')}
							{formatTanggalSaja(harga.latest_date)}
						</span>
					</div>
					<div class="mt-3"><GrafikHarga seri={harga.series} /></div>
					<p class="text-muted mt-3 text-[12px] leading-relaxed">
						{t(
							'Harga komoditas ikut menentukan skor pengaruh komoditas, tapi tidak memengaruhi skor risiko tata kelola.',
							'Commodity prices feed into the commodity exposure score, but they do not affect the governance risk score.'
						)}
					</p>
				</section>
			{/if}
		</div>
	{/if}

	{#if metrik.length > 0}
		<section class="panel" data-testid="bagian-sektor">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="tw-heading text-ink">
					{t('Dibanding rata rata sektor', 'Compared with the sector average')}
				</h2>
				<span class="tw-overline">{snapshot?.sub_sector}</span>
			</div>

			<ul class="mt-4 grid gap-3 md:grid-cols-2">
				{#each metrik as baris (baris.key)}
					<li class="metrik" data-testid="metrik-sektor" data-kunci={baris.key}>
						<div class="flex items-baseline justify-between gap-3">
							<span class="text-ink text-[13.5px]">
								{labelMetrik(baris.key, baris.label)}
								<span class="tw-overline ml-1 text-[9.5px]">{baris.year}</span>
							</span>
							<span class="tw-data text-secondary inline-flex items-center gap-1 text-[13px]">
								{#if baris.position.startsWith('di atas')}
									<TrendingUp class="size-3.5" aria-hidden="true" />
								{:else if baris.position.startsWith('di bawah')}
									<TrendingDown class="size-3.5" aria-hidden="true" />
								{/if}
								{teksSelisih(baris)}
							</span>
						</div>
						<dl class="mt-2.5 space-y-1.5">
							{#each [{ label: t('Emiten', 'Company'), nilai: baris.value, kelas: 'emiten' }, { label: t('Sektor', 'Sector'), nilai: baris.sector_average, kelas: 'sektor' }] as sel (sel.kelas)}
								<div class="banding">
									<dt class="text-muted text-[11.5px]">{sel.label}</dt>
									<dd class="flex items-center gap-2.5">
										<span class="lajur">
											<span
												class="isi {sel.kelas}"
												style="width:{Math.max((Math.abs(sel.nilai) / skala(baris)) * 100, 2)}%"
											></span>
										</span>
										<span class="tw-data text-ink w-16 text-right text-[12.5px]">
											{teksNilai(sel.nilai, baris.unit)}
										</span>
									</dd>
								</div>
							{/each}
						</dl>
					</li>
				{/each}
			</ul>

			<p class="text-muted mt-4 text-[12px] leading-relaxed">
				{t(
					'Angka perusahaan dibandingkan dengan rata rata perusahaan sejenis di subsektor yang sama. Berada di atas atau di bawah rata rata bukan berarti baik atau buruk.',
					"The company's figures are compared with the average of similar companies in the same subsector. Being above or below the average is not good or bad in itself."
				)}
			</p>
		</section>
	{/if}

	{#if payload.mode === 'mining_deep'}
		<div class="grid items-stretch gap-5 lg:grid-cols-2">
			{#if produksi}
				<section class="panel" data-testid="tren-produksi">
					<h2 class="text-ink flex items-center gap-2.5 text-[15px] font-semibold">
						<Factory class="text-secondary size-4" aria-hidden="true" />
						{t(
							`Produksi ${labelKomoditas(produksi.commodity)}`,
							`${labelKomoditas(produksi.commodity)} production`
						)}
						{produksi.year}
					</h2>
					<ul class="mt-3 space-y-2">
						{#each produksi.rows as baris (baris.sub_type + baris.unit)}
							<li class="baris-data">
								<span class="text-secondary text-[13px]">
									{baris.sub_type || labelKomoditas(produksi.commodity)}
								</span>
								<span class="tw-data text-ink text-[13px]">
									{formatAngka(baris.production)}
									{satuanAwam(baris.unit)}
									{#if baris.yoy_pct !== null}
										<span class="text-muted"
											>({formatBertanda(baris.yoy_pct)}
											{t('dari', 'from')}
											{produksi.previous_year})</span
										>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
					{#if produksi.reserve_life_years !== null}
						<p class="text-secondary mt-3 text-[13px]">
							{#if bahasa() === 'en'}
								{@const tahun = formatAngka(produksi.reserve_life_years, 1)}
								Its reserves of
								<span class="tw-data text-ink"
									>{formatAngka(produksi.reserves)} {satuanAwam(produksi.reserve_unit)}</span
								>
								would last about
								<span class="tw-data text-ink">{tahun} {tahun === '1' ? 'year' : 'years'}</span>
								if production stays at the {produksi.year} level.
							{:else}
								Cadangannya
								<span class="tw-data text-ink"
									>{formatAngka(produksi.reserves)} {satuanAwam(produksi.reserve_unit)}</span
								>, cukup untuk sekitar
								<span class="tw-data text-ink"
									>{formatAngka(produksi.reserve_life_years, 1)} tahun</span
								>
								kalau produksi tetap seperti tahun {produksi.year}.
							{/if}
						</p>
					{/if}
				</section>
			{/if}

			{#if radar}
				<section class="panel" data-testid="radar-lisensi">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<h2 class="text-ink flex items-center gap-2.5 text-[15px] font-semibold">
							<CalendarClock class="text-secondary size-4" aria-hidden="true" />
							{t('Izin tambang yang segera berakhir', 'Mining licenses expiring soon')}
						</h2>
						<span class="tw-overline">
							{t(
								`${radar.total_licenses} izin tercatat`,
								`${radar.total_licenses} ${radar.total_licenses === 1 ? 'license' : 'licenses'} on record`
							)}
						</span>
					</div>

					{#if radar.expiring_soon.length > 0}
						<ul class="mt-3 space-y-2">
							{#each radar.expiring_soon as lisensi (lisensi.license_id + lisensi.expires_at)}
								<li class="baris-lisensi" data-testid="lisensi-segera">
									<span
										class="penanda {lisensi.expired ? 'bg-tier-critical' : 'bg-tier-high'}"
										aria-hidden="true"
									></span>
									<div class="min-w-0 flex-1 space-y-1">
										<p class="text-ink text-[13px] leading-snug">
											{lisensi.license_type ?? t('Izin', 'License')}
											{lisensi.license_id}
											<span class="text-muted"
												>· {labelKomoditas(lisensi.commodity)}, {lisensi.status}</span
											>
										</p>
										<p class="text-muted flex flex-wrap gap-x-3 text-[11.5px]">
											<span>
												{t('Berakhir', lisensi.expired ? 'Expired' : 'Expires')}
												{formatTanggalSaja(lisensi.expires_at)} · {teksLisensi(lisensi.expires_at)}
											</span>
											{#if lisensi.city || lisensi.province}
												<span>{[lisensi.city, lisensi.province].filter(Boolean).join(', ')}</span>
											{/if}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-secondary mt-3 text-[13px]">
							{t(
								'Tidak ada izin tambang yang berakhir dalam setahun terakhir maupun setahun ke depan.',
								'No mining licenses ended in the past year or are due to end in the next year.'
							)}
						</p>
					{/if}
				</section>
			{/if}
		</div>

		<section class="panel" data-testid="bagian-tambang">
			<div class="flex flex-wrap items-center gap-2.5">
				<span class="lencana-tambang">{t('Sektor tambang', 'Mining sector')}</span>
				<h2 class="tw-heading text-ink">{t('Lokasi tambang', 'Mine locations')}</h2>
				{#if payload.mining_profile}
					<span class="text-muted flex items-center gap-1.5 text-[12px] sm:ml-auto">
						<Gem class="size-3.5" aria-hidden="true" />
						{payload.mining_profile.name} · {labelTipePerusahaan(
							payload.mining_profile.company_type
						)}
					</span>
				{/if}
			</div>

			{#if situs.length > 0}
				<div class="peta mt-4">
					{#if situsBerkoordinat.length > 0}
						<PetaSitus situs={situsBerkoordinat} />
					{/if}
					<ul class="grid gap-px sm:grid-cols-2">
						{#each situs as item (item.name + item.region)}
							<li class="situs" data-testid="situs-tambang">
								<span class="penanda {warnaKomoditas(item.commodity).latar}" aria-hidden="true"
								></span>
								<span class="min-w-0 flex-1 text-[13px] font-medium">
									{item.name}{#if item.region}<span class="text-secondary">, {item.region}</span
										>{/if}
								</span>
								<span class="tw-data text-muted flex-none text-[11px]"
									>{labelKomoditas(item.commodity)}</span
								>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="text-secondary mt-3 flex items-center gap-2 text-[13px]">
					<MapPin class="size-4" aria-hidden="true" />
					{t(
						'Belum ada data lokasi tambang untuk perusahaan ini.',
						'No mine location data for this company yet.'
					)}
				</p>
			{/if}
		</section>
	{/if}

	<section class="panel sumber" aria-label={t('Sumber data', 'Data sources')}>
		{#if sumber.length > 0}
			<div data-testid="sumber-data" class="flex flex-wrap items-center gap-2">
				<span class="tw-overline flex items-center gap-2 text-[10px]">
					<Database class="size-3.5" aria-hidden="true" />
					{t('Sumber data dari Sectors', 'Data sourced from Sectors')}
				</span>
				{#each sumber as nama (nama)}
					<span class="chip">{nama}</span>
				{/each}
			</div>
		{/if}

		<details class="mentah" data-testid="data-mentah">
			<summary>
				<Braces class="size-3.5" aria-hidden="true" />
				{t('Lihat data mentah yang disegel', 'View the sealed raw data')}
			</summary>
			<pre class="tw-data">{JSON.stringify(payload, null, 2)}</pre>
		</details>
	</section>
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

	.hero {
		display: grid;
		gap: 18px;
		background:
			radial-gradient(
				560px 240px at 0% 0%,
				color-mix(in srgb, var(--rona-tier) 12%, transparent),
				transparent 70%
			),
			var(--color-base);
	}

	@media (min-width: 1024px) {
		.hero {
			grid-template-columns: minmax(0, 1fr) minmax(0, 24rem);
			align-items: center;
		}
	}

	.skor-hero {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		border: 1px solid color-mix(in srgb, var(--rona-tier) 35%, transparent);
		border-radius: 18px;
		background: color-mix(in srgb, var(--rona-tier) 8%, transparent);
		padding: 12px 16px;
	}

	@media (min-width: 640px) {
		.skor-hero {
			min-width: 112px;
			flex-direction: column;
			flex-wrap: nowrap;
			align-items: center;
			justify-content: center;
			gap: 0;
			padding: 14px 16px;
		}
	}

	.meteran {
		position: relative;
		display: flex;
		max-width: 26rem;
		height: 6px;
		margin-top: 10px;
		gap: 2px;
	}

	.meteran > span:not(.jarum) {
		border-radius: 999px;
		opacity: 0.55;
	}

	.jarum {
		position: absolute;
		top: 50%;
		width: 4px;
		height: 16px;
		margin: -8px 0 0 -2px;
		border: 1px solid var(--color-base);
		border-radius: 2px;
		background: var(--color-ink);
	}

	.segel {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 12px;
		border: 1px solid var(--edge);
		border-radius: 16px;
		background: color-mix(in srgb, var(--kilau) 3%, transparent);
		padding: 14px;
	}

	.segel[data-valid='true'] {
		border-color: color-mix(in srgb, var(--color-tier-low) 35%, transparent);
	}

	.segel[data-valid='false'] {
		border-color: color-mix(in srgb, var(--color-tier-critical) 35%, transparent);
	}

	.kerangka {
		display: flex;
		min-height: 240px;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 20px;
		text-align: center;
	}

	.komponen dt {
		margin-bottom: 5px;
	}

	.lajur {
		position: relative;
		display: block;
		height: 6px;
		flex: 1;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		background: var(--color-secondary);
	}

	.isi.emiten {
		background: var(--color-ink);
	}

	.isi.sektor {
		background: color-mix(in srgb, var(--color-secondary) 55%, transparent);
	}

	.metrik {
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		padding: 12px 14px;
	}

	.banding {
		display: grid;
		grid-template-columns: 3.6rem 1fr;
		align-items: center;
		gap: 8px;
	}

	.baris-data {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 9px 12px;
	}

	.baris-lisensi {
		display: flex;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 10px 12px;
	}

	.penanda {
		width: 9px;
		height: 9px;
		flex: none;
		margin-top: 5px;
		border-radius: 2px;
		transform: rotate(45deg);
	}

	.lencana-tambang {
		border: 1px solid color-mix(in srgb, var(--color-diamond-500) 30%, transparent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--color-diamond-500) 14%, transparent);
		padding: 3px 8px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-diamond-300);
	}

	.peta {
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 16px;
		background: var(--edge-soft);
	}

	.situs {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--color-base);
		padding: 10px 14px;
	}

	.situs .penanda {
		margin-top: 0;
	}

	.sumber {
		display: grid;
		gap: 12px;
	}

	.chip {
		border: 1px solid var(--edge);
		border-radius: 8px;
		padding: 2px 8px;
		font-size: 12px;
		color: var(--color-secondary);
	}

	.mentah summary {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-diamond-300);
	}

	.mentah pre {
		max-height: 420px;
		margin-top: 12px;
		overflow: auto;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		background: var(--color-void);
		padding: 12px 14px;
		font-size: 11.5px;
		line-height: 1.55;
		color: var(--color-secondary);
		white-space: pre;
	}
</style>
