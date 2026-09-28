<script lang="ts">
	import {
		ArrowLeft,
		CalendarClock,
		Database,
		ExternalLink,
		Factory,
		Gem,
		MapPin,
		ShieldAlert,
		ShieldCheck,
		ShieldX,
		TrendingDown,
		TrendingUp,
		Users
	} from 'lucide-svelte';
	import GrafikHarga from '$lib/components/Chart/GrafikHarga.svelte';
	import PetaSitus from '$lib/components/Map/PetaSitus.svelte';
	import { warnaKomoditas } from '$lib/components/Map/warna';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import {
		formatAngka,
		formatBertanda,
		formatRingkas,
		formatTanggal,
		formatTanggalSaja,
		judulInsight,
		labelKeparahan,
		labelKomoditas,
		labelSinyal,
		labelSubtype,
		labelTransaksi,
		selisihHari
	} from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';

	let { data } = $props();

	const insight = $derived(data.insight);
	const payload = $derived(insight.payload ?? {});
	const verifikasi = $derived(data.verification);
	const tier = $derived(tierDariSkor(insight.score));
	const pola = $derived(payload.cross_pattern);
	const pendukung = $derived(payload.supporting_data ?? {});

	const subSkor = $derived(Object.entries(payload.sub_scores ?? {}));
	const suspensi = $derived(pendukung.suspensions ?? []);
	const insider = $derived(pendukung.insider_transactions ?? []);
	const perubahan = $derived(pendukung.ownership_changes ?? []);
	const pemegang = $derived(pendukung.major_shareholders ?? []);

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
	const sumber = $derived(payload.data_sources ?? []);

	const komponenEksposur = $derived(
		eksposur
			? [
					{ kunci: 'production_trend', label: 'Tren produksi', nilai: eksposur.components.production_trend },
					{
						kunci: 'commodity_price_trend',
						label: 'Tren harga komoditas',
						nilai: eksposur.components.commodity_price_trend
					},
					{ kunci: 'reserve_life', label: 'Umur cadangan', nilai: eksposur.components.reserve_life }
				]
			: []
	);

	const WARNA_KEPARAHAN: Record<number, string> = {
		1: 'bg-tier-moderate',
		2: 'bg-tier-high',
		3: 'bg-tier-critical'
	};

	function warnaTransaksi(jenis: string) {
		if (jenis === 'sell') return 'bg-tier-high';
		if (jenis === 'buy') return 'bg-tier-low';
		return 'bg-secondary';
	}

	function teksSelisih(baris: { unit: string; difference: number; difference_pct: number | null }) {
		if (baris.unit === '%') return formatBertanda(baris.difference, ' pp');
		return formatBertanda(baris.difference_pct);
	}

	function teksNilai(nilai: number, unit: string) {
		return unit === '%' ? `${formatAngka(nilai)}%` : `${formatAngka(nilai)}x`;
	}

	function teksLisensi(kedaluwarsa: string) {
		const hari = selisihHari(kedaluwarsa, insight.generated_at);
		if (hari < 0) return `lewat ${Math.abs(hari)} hari`;
		return `${hari} hari lagi`;
	}
</script>

<svelte:head>
	<title>{insight.ticker} · Detail insight TripWire</title>
</svelte:head>

<section class="space-y-6">
	<a
		href="/dashboard"
		class="text-secondary hover:text-ink inline-flex items-center gap-1.5 text-[13.5px] transition"
	>
		<ArrowLeft class="size-3.5" aria-hidden="true" />
		Kembali ke dashboard
	</a>

	<DisclaimerBar />

	<header class="tw-card space-y-5 p-6">
		<div class="flex flex-wrap items-start gap-5">
			<SkorBadge skor={insight.score} size="lg" />

			<div class="min-w-0 flex-1 space-y-2">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span
						data-testid="detail-ticker"
						class="tw-data text-diamond-300 text-2xl font-semibold tracking-wider"
					>
						{insight.ticker}
					</span>
					<span class="tw-caption">{insight.company_name}</span>
				</div>

				<h1 data-testid="detail-judul" class="tw-heading text-ink">{judulInsight(insight)}</h1>

				<p class="tw-overline">
					{labelSubtype(insight.subtype)} · {formatTanggal(insight.generated_at)} WIB
				</p>
			</div>
		</div>

		{#if verifikasi}
			<div
				data-testid="badge-signature"
				data-valid={verifikasi.valid}
				class="rounded-glass flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3 {verifikasi.valid
					? 'border-tier-low/35 bg-tier-low/10'
					: 'border-tier-critical/35 bg-tier-critical/10'}"
			>
				{#if verifikasi.valid}
					<span class="text-tier-low inline-flex items-center gap-2">
						<ShieldCheck class="size-4" aria-hidden="true" />
						<span class="tw-overline text-tier-low">Signature terverifikasi</span>
					</span>
				{:else}
					<span class="text-tier-critical inline-flex items-center gap-2">
						<ShieldX class="size-4" aria-hidden="true" />
						<span class="tw-overline text-tier-critical">Signature tidak valid</span>
					</span>
				{/if}

				<span class="tw-data text-secondary text-[12px]">
					{verifikasi.algorithm} · 0x{verifikasi.digest.slice(0, 4)}...{verifikasi.digest.slice(-4)}
				</span>

				<a
					href="/verify-insight?id={insight.id}"
					class="text-diamond-300 hover:text-diamond-100 ml-auto text-[13px] font-medium transition"
				>
					Verifikasi mandiri
				</a>
			</div>

			{#if verifikasi.reason}
				<p class="text-tier-critical text-[13px]">{verifikasi.reason}</p>
			{/if}
		{/if}
	</header>

	{#if subSkor.length > 0}
		<div class="tw-card space-y-4 p-6">
			<h2 class="tw-heading text-ink">Rincian sub skor</h2>

			<dl class="grid gap-3 sm:grid-cols-3">
				{#each subSkor as [kunci, nilai] (kunci)}
					{@const sub = tierDariSkor(nilai)}
					<div class="tw-glass p-4" data-testid="sub-skor" data-nama={kunci}>
						<dt class="tw-overline">{labelSinyal(kunci)}</dt>
						<dd class="font-display mt-2 text-xl font-semibold {sub.text}">
							{Math.round(nilai)}
						</dd>
					</div>
				{/each}
			</dl>

			{#if pola?.multiplier_applied}
				<p
					data-testid="pola-silang"
					class="rounded-glass border-line bg-void/50 flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<ShieldAlert class="mt-0.5 size-4 flex-none {tier.text}" aria-hidden="true" />
					<span class="text-secondary">
						{#if pola.multiplier_applied > 1}
							Pengali pola silang <span class="tw-data text-ink">{pola.multiplier_applied}x</span>
							aktif karena {pola.signals_active_in_window} sinyal muncul bersamaan dalam {pola.window_days}
							hari: {(pola.active_signals ?? []).map(labelSinyal).join(', ')}.
						{:else}
							Tidak ada pola silang aktif dalam {pola.window_days} hari terakhir, skor memakai bobot dasar.
						{/if}
					</span>
				</p>
			{/if}
		</div>
	{/if}

	{#if suspensi.length > 0}
		<div class="tw-card space-y-3 p-6" data-testid="bagian-suspensi">
			<h2 class="tw-heading text-ink">Riwayat suspensi</h2>
			<ul class="space-y-2">
				{#each suspensi as item (item.date + item.reason)}
					<li class="tw-glass flex gap-3 px-3.5 py-3">
						<span
							class="mt-1.5 size-2.25 flex-none rotate-45 rounded-xs {WARNA_KEPARAHAN[
								item.severity_tier
							] ?? 'bg-tier-high'}"
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1 space-y-1">
							<p class="text-ink text-[13.5px] leading-snug">{item.reason || 'Alasan tidak dicantumkan'}</p>
							<p class="tw-overline flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
								<span>IDX · {formatTanggalSaja(item.date)}</span>
								<span>{labelKeparahan(item.severity_tier)}</span>
								{#if item.pdf_url}
									<a
										href={item.pdf_url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-diamond-300 hover:text-diamond-100 inline-flex items-center gap-1 normal-case"
									>
										Pengumuman resmi
										<ExternalLink class="size-3" aria-hidden="true" />
									</a>
								{/if}
							</p>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if insider.length > 0}
		<div class="tw-card space-y-3 p-6" data-testid="bagian-insider">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="tw-heading text-ink">Transaksi insider dan pemegang saham mayor</h2>
				<span class="tw-overline">90 hari · KSEI</span>
			</div>
			<ul class="space-y-2">
				{#each insider as item, urutan (urutan)}
					<li class="tw-glass flex gap-3 px-3.5 py-3">
						<span
							class="mt-1.5 size-2.25 flex-none rotate-45 rounded-xs {warnaTransaksi(
								item.transaction_type
							)}"
							aria-hidden="true"
						></span>
						<div class="min-w-0 flex-1 space-y-1">
							<p class="text-ink text-[13.5px] leading-snug">
								{item.holder_name}
								<span class="text-muted">{labelTransaksi(item.transaction_type)}</span>
								{#if item.transaction_value > 0}
									<span class="tw-data text-secondary">Rp {formatRingkas(item.transaction_value)}</span>
								{/if}
							</p>
							<p class="tw-overline flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
								<span>{formatTanggalSaja(item.date)}</span>
								{#if item.share_pct_before !== undefined && item.share_pct_after !== undefined}
									<span class="tw-data normal-case">
										{formatAngka(item.share_pct_before, 3)}% ke {formatAngka(item.share_pct_after, 3)}%
									</span>
								{/if}
								{#if item.source_url}
									<a
										href={item.source_url}
										target="_blank"
										rel="noopener noreferrer"
										class="text-diamond-300 hover:text-diamond-100 inline-flex items-center gap-1 normal-case"
									>
										Dokumen
										<ExternalLink class="size-3" aria-hidden="true" />
									</a>
								{/if}
							</p>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if perubahan.length > 0 || pemegang.length > 0}
		<div class="tw-card space-y-4 p-6" data-testid="bagian-kepemilikan">
			<div class="flex items-center gap-2.5">
				<Users class="text-secondary size-4" aria-hidden="true" />
				<h2 class="tw-heading text-ink">Konsentrasi kepemilikan</h2>
			</div>

			{#if perubahan.length > 0}
				<ul class="space-y-2">
					{#each perubahan as item (item.holder_name)}
						<li class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
							<span class="text-ink text-[13.5px]">{item.holder_name}</span>
							<span class="tw-data text-secondary text-[13px]">
								{formatAngka(item.share_pct_before)}% ke {formatAngka(item.share_pct_after)}%
								<span class={Math.abs(item.delta_pp) > 3 ? 'text-tier-high' : 'text-muted'}>
									({formatBertanda(item.delta_pp, ' pp')})
								</span>
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if pemegang.length > 0}
				<div class="space-y-2">
					<p class="tw-overline">Pemegang saham utama saat ini</p>
					{#each pemegang as item (item.name)}
						<div class="space-y-1">
							<div class="flex items-baseline justify-between gap-3 text-[13px]">
								<span class="text-secondary">{item.name === 'Public' ? 'Publik (free float)' : item.name}</span>
								<span class="tw-data text-ink">{formatAngka(item.percentage)}%</span>
							</div>
							<div class="bg-line h-1.5 overflow-hidden rounded-full">
								<div
									class="bg-diamond-700 h-full rounded-full"
									style="width: {Math.min(100, item.percentage)}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#if eksposur}
		<div class="tw-card space-y-4 p-6" data-testid="bagian-eksposur">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="tw-heading text-ink">Skor eksposur komoditas</h2>
				<span class="tw-overline">{labelKomoditas(eksposur.commodity)} · {eksposur.category}</span>
			</div>

			<dl class="grid gap-3 sm:grid-cols-3">
				{#each komponenEksposur as item (item.kunci)}
					<div class="tw-glass p-4" data-testid="komponen-eksposur" data-nama={item.kunci}>
						<dt class="tw-overline">{item.label}</dt>
						<dd class="font-display text-ink mt-2 text-xl font-semibold">
							{item.nilai === null ? '-' : Math.round(item.nilai)}
						</dd>
					</div>
				{/each}
			</dl>

			<p class="text-secondary text-[13px]">
				Skor dasar <span class="tw-data text-ink">{formatAngka(eksposur.base_score)}</span> dikali
				faktor tipe entitas <span class="tw-data text-ink">{eksposur.entity_factor}x</span>
				({eksposur.entity_type.replace(/_/g, ' ')}). Komponen tanpa data tidak ikut dihitung dan bobotnya
				dibagi ulang ke komponen lain.
			</p>
		</div>
	{/if}

	{#if metrik.length > 0}
		<div class="tw-card space-y-4 p-6" data-testid="bagian-sektor">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="tw-heading text-ink">Fundamental terhadap rata rata sektor</h2>
				<span class="tw-overline">{snapshot?.sub_sector}</span>
			</div>

			<ul class="space-y-2">
				{#each metrik as baris (baris.key)}
					<li
						class="tw-glass flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3.5 py-2.5"
						data-testid="metrik-sektor"
						data-kunci={baris.key}
					>
						<span class="text-ink text-[13.5px]">
							{baris.label}
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
						<span class="tw-data text-muted w-full text-[12px]">
							Emiten <span class="text-ink">{teksNilai(baris.value, baris.unit)}</span> · Sektor
							<span class="text-secondary">{teksNilai(baris.sector_average, baris.unit)}</span>
						</span>
					</li>
				{/each}
			</ul>

			<p class="text-muted text-[12px]">
				Valuasi dibandingkan dengan rata rata peer satu subsektor dari laporan emiten Sectors.
				Pertumbuhan dibandingkan dengan rata rata tertimbang subsektor. Posisi di atas atau di bawah
				rata rata bukan penilaian baik atau buruk.
			</p>
		</div>
	{/if}

	{#if payload.mode === 'mining_deep'}
		<div class="space-y-4" data-testid="bagian-tambang">
			<div class="flex items-center gap-2.5">
				<span
					class="tw-overline border-diamond-500/30 bg-diamond-500/15 text-diamond-300 rounded-glass-sm border px-2 py-1 text-[9.5px]"
				>
					Sektor tambang
				</span>
				<h2 class="tw-heading text-ink">Lokasi situs</h2>
			</div>

			{#if situs.length > 0}
				<div class="rounded-glass-lg border-line overflow-hidden border">
					{#if situsBerkoordinat.length > 0}
						<PetaSitus situs={situsBerkoordinat} />
					{/if}
					<ul class="bg-line grid gap-px">
						{#each situs as item (item.name + item.region)}
							<li class="bg-base/85 flex items-center gap-2.5 px-3.5 py-2.5" data-testid="situs-tambang">
								<span
									class="size-2.25 flex-none rotate-45 rounded-xs {warnaKomoditas(item.commodity)
										.latar}"
									aria-hidden="true"
								></span>
								<span class="min-w-0 flex-1 text-[13px] font-medium">
									{item.name}{#if item.region}<span class="text-secondary">, {item.region}</span>{/if}
								</span>
								<span class="tw-data text-muted flex-none text-[11px]">{labelKomoditas(item.commodity)}</span>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="tw-glass text-secondary flex items-center gap-2 px-4 py-3 text-[13px]">
					<MapPin class="size-4" aria-hidden="true" />
					Sectors belum mencatat situs tambang untuk emiten ini.
				</p>
			{/if}

			{#if harga}
				<div class="tw-card space-y-3 p-5" data-testid="harga-komoditas">
					<p class="tw-overline text-[10px]">Harga {labelKomoditas(harga.commodity)} · 12 bulan</p>
					<div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
						<span class="tw-data text-ink text-2xl font-semibold">{formatAngka(harga.latest)}</span>
						<span class="tw-data text-muted text-[11.5px]">{harga.unit}</span>
						{#if harga.yoy_pct !== null}
							<span
								class="tw-data text-[11.5px] {harga.yoy_pct >= 0 ? 'text-tier-low' : 'text-tier-high'}"
							>
								{formatBertanda(harga.yoy_pct)}
							</span>
						{/if}
						<span class="tw-overline ml-auto text-[9.5px]">per {formatTanggalSaja(harga.latest_date)}</span>
					</div>
					<GrafikHarga seri={harga.series} />
					<p class="text-muted text-[12px] leading-relaxed">
						Harga komoditas menjadi salah satu komponen skor eksposur komoditas, bukan bagian dari
						perhitungan Red Flag Score.
					</p>
				</div>
			{/if}

			{#if produksi}
				<div class="tw-card space-y-3 p-5" data-testid="tren-produksi">
					<div class="flex items-center gap-2.5">
						<Factory class="text-secondary size-4" aria-hidden="true" />
						<h3 class="text-ink text-[15px] font-semibold">
							Produksi {labelKomoditas(produksi.commodity)} {produksi.year}
						</h3>
					</div>
					<ul class="space-y-2">
						{#each produksi.rows as baris (baris.sub_type + baris.unit)}
							<li class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
								<span class="text-secondary text-[13px]">
									{baris.sub_type || labelKomoditas(produksi.commodity)}
								</span>
								<span class="tw-data text-ink text-[13px]">
									{formatAngka(baris.production)} {baris.unit}
									{#if baris.yoy_pct !== null}
										<span class="text-muted">({formatBertanda(baris.yoy_pct)} dari {produksi.previous_year})</span>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
					{#if produksi.reserve_life_years !== null}
						<p class="text-secondary text-[13px]">
							Cadangan <span class="tw-data text-ink">{formatAngka(produksi.reserves)} {produksi.reserve_unit}</span>,
							cukup sekitar
							<span class="tw-data text-ink">{formatAngka(produksi.reserve_life_years, 1)} tahun</span>
							pada laju produksi {produksi.year}.
						</p>
					{/if}
				</div>
			{/if}

			{#if radar}
				<div class="tw-card space-y-3 p-5" data-testid="radar-lisensi">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<div class="flex items-center gap-2.5">
							<CalendarClock class="text-secondary size-4" aria-hidden="true" />
							<h3 class="text-ink text-[15px] font-semibold">Radar lisensi tambang</h3>
						</div>
						<span class="tw-overline">{radar.total_licenses} lisensi tercatat</span>
					</div>

					{#if radar.expiring_soon.length > 0}
						<ul class="space-y-2">
							{#each radar.expiring_soon as lisensi (lisensi.license_id + lisensi.expires_at)}
								<li class="tw-glass flex gap-3 px-3.5 py-3" data-testid="lisensi-segera">
									<span
										class="mt-1.5 size-2.25 flex-none rotate-45 rounded-xs {lisensi.expired
											? 'bg-tier-critical'
											: 'bg-tier-high'}"
										aria-hidden="true"
									></span>
									<div class="min-w-0 flex-1 space-y-1">
										<p class="text-ink text-[13.5px] leading-snug">
											{lisensi.license_type ?? 'Lisensi'} {lisensi.license_id}
											<span class="text-muted">· {labelKomoditas(lisensi.commodity)}, {lisensi.status}</span>
										</p>
										<p class="tw-overline flex flex-wrap gap-x-3 text-[10px]">
											<span>
												Berakhir {formatTanggalSaja(lisensi.expires_at)} · {teksLisensi(lisensi.expires_at)}
											</span>
											{#if lisensi.city || lisensi.province}
												<span class="normal-case">
													{[lisensi.city, lisensi.province].filter(Boolean).join(', ')}
												</span>
											{/if}
										</p>
									</div>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-secondary text-[13px]">
							Tidak ada lisensi yang berakhir dalam {radar.window_days} hari ke depan maupun ke belakang.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if sumber.length > 0}
		<div class="tw-glass space-y-2 px-4 py-3.5" data-testid="sumber-data">
			<p class="tw-overline flex items-center gap-2 text-[10px]">
				<Database class="size-3.5" aria-hidden="true" />
				Sumber data Sectors API v2
			</p>
			<ul class="flex flex-wrap gap-1.5">
				{#each sumber as endpoint (endpoint)}
					<li class="tw-data rounded-glass-sm border-line text-secondary border px-2 py-0.5 text-[11px]">
						{endpoint}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if payload.mining_profile}
		<p class="text-muted flex items-center gap-2 text-[12px]">
			<Gem class="size-3.5" aria-hidden="true" />
			{payload.mining_profile.name} · {payload.mining_profile.company_type} ·
			{payload.mining_profile.commodities.map(labelKomoditas).join(', ')}
		</p>
	{/if}
</section>
