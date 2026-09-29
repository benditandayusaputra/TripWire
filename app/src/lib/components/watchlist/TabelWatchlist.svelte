<script lang="ts">
	import { ArrowDownUp, Download, Search } from 'lucide-svelte';
	import BarisSaham from './BarisSaham.svelte';
	import { tierDariSkor, type Tier } from '$lib/skor';
	import { tanggalPendek, urutkan, type Baris, type KunciUrut } from '$lib/watchlist';

	let { baris, terpilih, memuat }: { baris: Baris[]; terpilih: string | null; memuat: boolean } =
		$props();

	type Saringan = Tier | 'semua' | 'kosong';

	let kunci = $state<KunciUrut>('skor');
	let naik = $state(false);
	let saring = $state<Saringan>('semua');
	let cari = $state('');

	const KOLOM: { kunci: KunciUrut | null; label: string; kelas: string }[] = [
		{ kunci: 'kode', label: 'Saham', kelas: 'col-span-2 text-left' },
		{ kunci: null, label: '1 bulan', kelas: 'kolom-bulan text-left' },
		{ kunci: 'ubah', label: 'Harga', kelas: 'text-right' },
		{ kunci: 'skor', label: 'Skor', kelas: 'text-right' }
	];

	const PILIHAN_URUT: { kunci: KunciUrut; label: string; pendek: string }[] = [
		{ kunci: 'skor', label: 'Red Flag Score', pendek: 'Skor' },
		{ kunci: 'ubah', label: 'Perubahan harian', pendek: 'Perubahan' },
		{ kunci: 'kapitalisasi', label: 'Kapitalisasi pasar', pendek: 'Kapitalisasi' },
		{ kunci: 'kode', label: 'Kode', pendek: 'Kode' }
	];

	const SARINGAN: { nilai: Saringan; label: string }[] = [
		{ nilai: 'semua', label: 'Semua' },
		{ nilai: 'critical', label: 'Kritis' },
		{ nilai: 'high', label: 'Tinggi' },
		{ nilai: 'moderate', label: 'Sedang' },
		{ nilai: 'low', label: 'Rendah' },
		{ nilai: 'kosong', label: 'Belum dipindai' }
	];

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
			'Kode',
			'Nama',
			'Harga tutup',
			'Tanggal tutup',
			'Perubahan harian %',
			'Red Flag Score',
			'Tingkat',
			'Sektor'
		];
		const isi = tampil.map((b) => [
			b.item.ticker,
			b.item.company_name,
			b.penutupan?.harga ?? '',
			b.penutupan?.tanggal ?? '',
			b.ubah === null ? '' : (b.ubah * 100).toFixed(2),
			b.skor === null ? '' : Math.round(b.skor),
			b.skor === null ? 'Belum dipindai' : tierDariSkor(b.skor).label,
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
			Daftar pantauan <span class="tw-data text-muted text-[14px] font-normal">{baris.length}</span>
		</h2>
		<div class="flex items-center gap-2">
			<label class="relative sm:hidden">
				<span class="sr-only">Urutkan daftar</span>
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
				aria-label="Unduh daftar sebagai CSV"
				title="Unduh CSV"
			>
				<Download class="size-4" aria-hidden="true" />
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
		<div class="flex flex-wrap gap-1.5" role="group" aria-label="Saring tingkat risiko">
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
				<span class="sr-only">Saring kode atau nama di watchlist</span>
				<Search
					class="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					aria-hidden="true"
				/>
				<input
					bind:value={cari}
					placeholder="Saring watchlist"
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
					aria-label="Urutkan berdasarkan {PILIHAN_URUT.find((p) => p.kunci === k)?.label}"
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
		Diurutkan berdasarkan {PILIHAN_URUT.find((p) => p.kunci === kunci)?.label}, {naik
			? 'naik'
			: 'turun'}, {tampil.length} saham tampil
	</div>

	{#if tampil.length === 0}
		<p class="text-secondary px-5 py-8 text-center text-[13px]">
			Tidak ada saham yang cocok dengan saringan ini.
			<button
				type="button"
				class="text-diamond-300 font-medium"
				onclick={() => ((saring = 'semua'), (cari = ''))}>Tampilkan semua</button
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
						catatan={b.aktif === 0 ? 'tanpa jadwal' : ''}
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
			Harga penutupan {tanggalPendek(tanggalTutup)} dari Sectors, bukan harga berjalan. Garis kecil menunjukkan
			harga sebulan terakhir.
		{:else if memuat}
			Mengambil harga penutupan dari Sectors.
		{:else}
			Harga muncul setelah data harian emiten tersedia di Sectors.
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
		background: rgba(8, 11, 18, 0.45);
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
