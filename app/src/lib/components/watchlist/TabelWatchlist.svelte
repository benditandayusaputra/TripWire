<script lang="ts">
	import { ArrowDownUp, Download, Search } from 'lucide-svelte';
	import BarisSaham from './BarisSaham.svelte';
	import { tierDariSkor, type Tier } from '$lib/skor';
	import { t } from '$lib/bahasa.svelte';
	import { tanggalPendek, urutkan, type Baris, type KunciUrut } from '$lib/watchlist';

	let { baris, terpilih, memuat }: { baris: Baris[]; terpilih: string | null; memuat: boolean } =
		$props();

	type Saringan = Tier | 'semua' | 'kosong';

	let kunci = $state<KunciUrut>('skor');
	let naik = $state(false);
	let saring = $state<Saringan>('semua');
	let cari = $state('');

	const KOLOM: { kunci: KunciUrut | null; label: string; kelas: string }[] = $derived([
		{ kunci: 'kode', label: t('Saham', 'Stock'), kelas: 'col-span-2 text-left' },
		{ kunci: null, label: t('1 bulan', '1 month'), kelas: 'kolom-bulan text-left' },
		{ kunci: 'ubah', label: t('Harga', 'Price'), kelas: 'text-right' },
		{ kunci: 'skor', label: t('Skor', 'Score'), kelas: 'text-right' }
	]);

	const PILIHAN_URUT: { kunci: KunciUrut; label: string; pendek: string }[] = $derived([
		{ kunci: 'skor', label: 'Red Flag Score', pendek: t('Skor', 'Score') },
		{
			kunci: 'ubah',
			label: t('Perubahan harian', 'Daily change'),
			pendek: t('Perubahan', 'Change')
		},
		{
			kunci: 'kapitalisasi',
			label: t('Kapitalisasi pasar', 'Market cap'),
			pendek: t('Kapitalisasi', 'Market cap')
		},
		{ kunci: 'kode', label: t('Kode', 'Ticker'), pendek: t('Kode', 'Ticker') }
	]);

	const SARINGAN: { nilai: Saringan; label: string }[] = $derived([
		{ nilai: 'semua', label: t('Semua', 'All') },
		{ nilai: 'critical', label: t('Kritis', 'Critical') },
		{ nilai: 'high', label: t('Tinggi', 'High') },
		{ nilai: 'moderate', label: t('Sedang', 'Moderate') },
		{ nilai: 'low', label: t('Rendah', 'Low') },
		{ nilai: 'kosong', label: t('Belum dipindai', 'Not scanned yet') }
	]);

	const labelUrut = $derived(PILIHAN_URUT.find((p) => p.kunci === kunci)?.label);

	const tierBaris = (b: Baris): Saringan =>
		b.skor === null ? 'kosong' : tierDariSkor(b.skor).tier;

	const jumlahSaringan = $derived.by(() => {
		const hitung: Record<string, number> = { semua: baris.length };
		for (const b of baris) hitung[tierBaris(b)] = (hitung[tierBaris(b)] ?? 0) + 1;
		return hitung;
	});

	const tampil = $derived.by(() => {
		const kata = cari.trim().toUpperCase();
		const lolos = baris.filter(
			(b) =>
				(saring === 'semua' || tierBaris(b) === saring) &&
				(!kata || b.item.ticker.includes(kata) || b.item.company_name.toUpperCase().includes(kata))
		);
		return urutkan(lolos, kunci, naik);
	});

	const tanggalTutup = $derived(
		baris
			.map((b) => b.penutupan?.tanggal ?? '')
			.sort()
			.at(-1) ?? ''
	);

	function urutBerdasar(baru: KunciUrut) {
		if (kunci === baru) naik = !naik;
		else {
			kunci = baru;
			naik = baru === 'kode';
		}
	}

	function selisih(b: Baris) {
		const sebelum = b.risiko?.previous_score;
		return b.skor !== null && sebelum !== null && sebelum !== undefined
			? Math.round(b.skor - sebelum)
			: 0;
	}

	function unduh() {
		const kepala = [
			t('Kode', 'Ticker'),
			t('Nama', 'Name'),
			t('Harga tutup', 'Closing price'),
			t('Tanggal tutup', 'Closing date'),
			t('Perubahan harian %', 'Daily change %'),
			'Red Flag Score',
			t('Tingkat', 'Level'),
			t('Sektor', 'Sector')
		];
		const isi = tampil.map((b) => [
			b.item.ticker,
			b.item.company_name,
			b.penutupan?.harga ?? '',
			b.penutupan?.tanggal ?? '',
			b.ubah === null ? '' : (b.ubah * 100).toFixed(2),
			b.skor === null ? '' : Math.round(b.skor),
			b.skor === null ? t('Belum dipindai', 'Not scanned yet') : tierDariSkor(b.skor).label,
			b.kutipan?.sector ?? ''
		]);
		const csv = [kepala, ...isi]
			.map((kolom) => kolom.map((sel) => `"${String(sel).replaceAll('"', '""')}"`).join(','))
			.join('\n');
		const tautan = document.createElement('a');
		tautan.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		tautan.download = `watchlist-tripwire-${new Date().toISOString().slice(0, 10)}.csv`;
		tautan.click();
		URL.revokeObjectURL(tautan.href);
	}
</script>

<section class="daftar" aria-labelledby="judul-daftar">
	<div class="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
		<h2 id="judul-daftar" class="tw-heading text-ink text-[17px] whitespace-nowrap">
			{t('Daftar pantauan', 'Watchlist')}
			<span class="tw-data text-muted text-[14px] font-normal">{baris.length}</span>
		</h2>
		<div class="flex items-center gap-2">
			<label class="relative sm:hidden">
				<span class="sr-only">{t('Urutkan daftar', 'Sort list')}</span>
				<ArrowDownUp
					class="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					aria-hidden="true"
				/>
				<select bind:value={kunci} class="tw-field w-auto py-1.5 pr-3 pl-8 text-[12.5px]">
					{#each PILIHAN_URUT as pilihan (pilihan.kunci)}
						<option value={pilihan.kunci}>{pilihan.pendek}</option>
					{/each}
				</select>
			</label>
			<button
				type="button"
				onclick={unduh}
				class="tombol-ikon hidden sm:grid"
				disabled={!tampil.length}
				aria-label={t('Unduh daftar sebagai CSV', 'Download list as CSV')}
				title={t('Unduh CSV', 'Download CSV')}
			>
				<Download class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
		<div
			class="flex flex-wrap gap-1.5"
			role="group"
			aria-label={t('Saring tingkat risiko', 'Filter by risk level')}
		>
			{#each SARINGAN as pilihan (pilihan.nilai)}
				{#if pilihan.nilai === 'semua' || jumlahSaringan[pilihan.nilai]}
					<button
						type="button"
						data-testid="saring-{pilihan.nilai}"
						aria-pressed={saring === pilihan.nilai}
						class="saring"
						onclick={() => (saring = pilihan.nilai)}
					>
						{#if pilihan.nilai !== 'semua' && pilihan.nilai !== 'kosong'}
							<span
								class="size-1.5 rounded-full"
								style="background:{tierDariSkor(
									{ critical: 90, high: 70, moderate: 45, low: 10 }[pilihan.nilai]
								).color}"
							></span>
						{/if}
						{pilihan.label}
						<span class="tw-data text-muted">{jumlahSaringan[pilihan.nilai]}</span>
					</button>
				{/if}
			{/each}
		</div>
		{#if baris.length >= 5}
			<label class="relative ml-auto w-full sm:w-44">
				<span class="sr-only"
					>{t(
						'Saring kode atau nama di watchlist',
						'Filter tickers or names in your watchlist'
					)}</span
				>
				<Search
					class="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					aria-hidden="true"
				/>
				<input
					bind:value={cari}
					placeholder={t('Saring watchlist', 'Filter watchlist')}
					class="tw-field py-1.5 pl-8 text-[12.5px]"
				/>
			</label>
		{/if}
	</div>

	<div class="kepala mt-3">
		{#each KOLOM as kolom (kolom.label)}
			{#if kolom.kunci}
				{@const k = kolom.kunci}
				<button
					type="button"
					class="{kolom.kelas} tombol-kepala"
					class:aktif={kunci === k}
					aria-label="{t('Urutkan berdasarkan', 'Sort by')} {PILIHAN_URUT.find((p) => p.kunci === k)
						?.label}"
					onclick={() => urutBerdasar(k)}
				>
					{kolom.label}{kunci === k ? (naik ? ' ↑' : ' ↓') : ''}
				</button>
			{:else}
				<span class={kolom.kelas}>{kolom.label}</span>
			{/if}
		{/each}
	</div>

	<div class="sr-only" aria-live="polite">
		{t(
			`Diurutkan berdasarkan ${labelUrut}, ${naik ? 'naik' : 'turun'}, ${tampil.length} saham tampil`,
			`Sorted by ${labelUrut}, ${naik ? 'ascending' : 'descending'}, ${tampil.length} ${
				tampil.length === 1 ? 'stock' : 'stocks'
			} shown`
		)}
	</div>

	{#if tampil.length === 0}
		<p class="text-secondary px-5 py-8 text-center text-[13px]">
			{t('Tidak ada saham yang cocok dengan saringan ini.', 'No stocks match this filter.')}
			<button
				type="button"
				class="text-diamond-300 font-medium"
				onclick={() => ((saring = 'semua'), (cari = ''))}>{t('Tampilkan semua', 'Show all')}</button
			>
		</p>
	{:else}
		<ul data-testid="watchlist-items" class="space-y-0.5 px-2 pt-1 pb-2">
			{#each tampil as b, urutan (b.item.id)}
				<li data-testid="watchlist-item" data-ticker={b.item.ticker}>
					<BarisSaham
						kode={b.item.ticker}
						nama={b.item.company_name}
						tren={b.tren}
						penutupan={b.penutupan}
						skor={b.skor}
						selisih={selisih(b)}
						catatan={b.aktif === 0 ? t('tanpa jadwal', 'no schedule') : ''}
						href="?emiten={b.item.ticker}"
						aktif={terpilih === b.item.ticker}
						{memuat}
						tur={urutan === 0}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	<p class="kaki">
		{#if tanggalTutup}
			{t(
				`Harga penutupan ${tanggalPendek(tanggalTutup)} dari Sectors, bukan harga berjalan. Garis kecil menunjukkan harga sebulan terakhir.`,
				`Closing prices as of ${tanggalPendek(tanggalTutup)} from Sectors, not live prices. The small line shows the past month of prices.`
			)}
		{:else if memuat}
			{t('Mengambil harga penutupan dari Sectors.', 'Fetching closing prices from Sectors.')}
		{:else}
			{t(
				'Harga muncul setelah data harian emiten tersedia di Sectors.',
				'Prices appear once daily company data is available on Sectors.'
			)}
		{/if}
	</p>
</section>

<style>
	.daftar {
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
	}

	.kepala {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr) 48px 76px 36px;
		align-items: center;
		gap: 10px;
		border-block: 1px solid var(--edge-soft);
		background: color-mix(in srgb, var(--color-void) 45%, transparent);
		padding: 7px 18px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	@media (min-width: 640px) {
		.kepala {
			grid-template-columns: 36px minmax(0, 1fr) 84px 96px 38px;
			gap: 14px;
			padding-inline: 22px;
		}
	}

	@media (min-width: 1024px) {
		.kepala {
			grid-template-columns: 36px minmax(0, 1fr) 64px 86px 38px;
			gap: 12px;
		}
	}

	@media (max-width: 359.98px) {
		.kepala {
			grid-template-columns: 32px minmax(0, 1fr) 76px 36px;
		}

		.kepala :global(.kolom-bulan) {
			display: none;
		}
	}

	.kepala > :global(*) {
		white-space: nowrap;
	}

	.kepala > :global(.text-right) {
		justify-self: end;
	}

	.tombol-kepala {
		transition: color 0.2s ease;
	}

	.tombol-kepala.aktif,
	.tombol-kepala:hover {
		color: var(--color-diamond-100);
	}

	.saring {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 3px 10px;
		font-size: 12px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			color 0.2s ease,
			background 0.2s ease;
	}

	.saring[aria-pressed='true'] {
		border-color: var(--color-diamond-500);
		background: rgba(74, 158, 255, 0.12);
		color: var(--color-diamond-100);
	}

	.tombol-ikon {
		width: 34px;
		height: 34px;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 10px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}

	@media (hover: hover) {
		.tombol-ikon:not(:disabled):hover {
			border-color: var(--color-diamond-700);
			color: var(--color-ink);
		}
	}

	.kaki {
		border-top: 1px solid var(--edge-soft);
		padding: 10px 20px 12px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--color-muted);
	}
</style>
