<script lang="ts">
	import { ArrowDownUp, Download, Search } from 'lucide-svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Sparkline from './Sparkline.svelte';
	import { tierDariSkor, type Tier } from '$lib/skor';
	import {
		formatHarga,
		formatRupiah,
		formatUbah,
		urutkan,
		type Baris,
		type KunciUrut
	} from '$lib/watchlist';

	let { baris, terpilih }: { baris: Baris[]; terpilih: string | null } = $props();

	type Saringan = Tier | 'semua' | 'kosong';

	let kunci = $state<KunciUrut>('skor');
	let naik = $state(false);
	let saring = $state<Saringan>('semua');
	let cari = $state('');

	const KOLOM: { kunci: KunciUrut | null; label: string; kelas: string }[] = [
		{ kunci: 'kode', label: 'Emiten', kelas: 'text-left' },
		{ kunci: 'kapitalisasi', label: 'Harga', kelas: 'text-right' },
		{ kunci: 'ubah', label: 'Hari ini', kelas: 'text-right hidden md:block lg:hidden' },
		{ kunci: null, label: '52 minggu', kelas: 'text-left hidden md:block lg:hidden' },
		{ kunci: 'skor', label: 'Skor', kelas: 'text-left' },
		{ kunci: null, label: 'Tren', kelas: 'text-left hidden md:block' },
		{ kunci: 'kondisi', label: 'Aktif', kelas: 'text-right hidden md:block' }
	];

	const PILIHAN_URUT: { kunci: KunciUrut; label: string }[] = [
		{ kunci: 'skor', label: 'Red Flag Score' },
		{ kunci: 'ubah', label: 'Perubahan harian' },
		{ kunci: 'kapitalisasi', label: 'Kapitalisasi pasar' },
		{ kunci: 'kode', label: 'Kode' },
		{ kunci: 'kondisi', label: 'Kondisi aktif' }
	];

	const tierBaris = (b: Baris): Saringan =>
		b.skor === null ? 'kosong' : tierDariSkor(b.skor).tier;

	const jumlahSaringan = $derived.by(() => {
		const hitung: Record<string, number> = { semua: baris.length };
		for (const b of baris) hitung[tierBaris(b)] = (hitung[tierBaris(b)] ?? 0) + 1;
		return hitung;
	});

	const SARINGAN: { nilai: Saringan; label: string }[] = [
		{ nilai: 'semua', label: 'Semua' },
		{ nilai: 'critical', label: 'Kritis' },
		{ nilai: 'high', label: 'Tinggi' },
		{ nilai: 'moderate', label: 'Sedang' },
		{ nilai: 'low', label: 'Rendah' },
		{ nilai: 'kosong', label: 'Belum dipindai' }
	];

	const tampil = $derived.by(() => {
		const kata = cari.trim().toUpperCase();
		const lolos = baris.filter(
			(b) =>
				(saring === 'semua' || tierBaris(b) === saring) &&
				(!kata || b.item.ticker.includes(kata) || b.item.company_name.toUpperCase().includes(kata))
		);
		return urutkan(lolos, kunci, naik);
	});

	function urutBerdasar(baru: KunciUrut) {
		if (kunci === baru) naik = !naik;
		else {
			kunci = baru;
			naik = baru === 'kode';
		}
	}

	function unduh() {
		const kepala = [
			'Kode',
			'Nama',
			'Harga tutup',
			'Perubahan harian %',
			'Red Flag Score',
			'Tingkat',
			'Sektor',
			'Kondisi aktif'
		];
		const isi = tampil.map((b) => [
			b.item.ticker,
			b.item.company_name,
			b.kutipan?.last_close_price ?? '',
			b.ubah === null ? '' : (b.ubah * 100).toFixed(2),
			b.skor === null ? '' : Math.round(b.skor),
			b.skor === null ? 'Belum dipindai' : tierDariSkor(b.skor).label,
			b.kutipan?.sector ?? '',
			b.aktif
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

<section class="tabel" aria-labelledby="judul-tabel">
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
		<h2 id="judul-tabel" class="tw-heading text-ink text-[17px]">Daftar pantauan</h2>
		<div class="flex items-center gap-2">
			<span class="relative md:hidden">
				<ArrowDownUp
					class="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					aria-hidden="true"
				/>
				<select
					bind:value={kunci}
					aria-label="Urutkan daftar"
					class="tw-field w-auto py-1.5 pr-3 pl-8 text-[12.5px]"
				>
					{#each PILIHAN_URUT as pilihan (pilihan.kunci)}
						<option value={pilihan.kunci}>{pilihan.label}</option>
					{/each}
				</select>
			</span>
			<button
				type="button"
				onclick={unduh}
				class="tw-ghost px-3 py-1.5 text-[12.5px]"
				disabled={!tampil.length}
			>
				<Download class="size-3.5" aria-hidden="true" />
				CSV
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
						class:aktif={saring === pilihan.nilai}
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
			: 'turun'}, {tampil.length} emiten tampil
	</div>

	{#if tampil.length === 0}
		<p class="text-secondary px-5 py-8 text-center text-[13px]">
			Tidak ada emiten yang cocok dengan saringan ini.
			<button
				type="button"
				class="text-diamond-300 font-medium"
				onclick={() => ((saring = 'semua'), (cari = ''))}>Tampilkan semua</button
			>
		</p>
	{:else}
		<ul data-testid="watchlist-items" class="mt-1 pb-2">
			{#each tampil as b (b.item.id)}
				{@const ubah = formatUbah(b.ubah)}
				{@const posisi =
					b.kutipan?.high_52w && b.kutipan.low_52w && b.kutipan.high_52w > b.kutipan.low_52w
						? Math.min(
								1,
								Math.max(
									0,
									(b.kutipan.last_close_price - b.kutipan.low_52w) /
										(b.kutipan.high_52w - b.kutipan.low_52w)
								)
							)
						: null}
				{@const delta =
					b.skor !== null &&
					b.risiko?.previous_score !== null &&
					b.risiko?.previous_score !== undefined
						? Math.round(b.skor - b.risiko.previous_score)
						: 0}
				<li data-testid="watchlist-item" data-ticker={b.item.ticker}>
					<a
						href="?emiten={b.item.ticker}"
						data-sveltekit-noscroll
						aria-current={terpilih === b.item.ticker ? 'true' : undefined}
						class="baris"
					>
						<span class="min-w-0">
							<span class="flex items-center gap-2">
								<span class="tw-data text-ink text-[14px] font-semibold tracking-wide"
									>{b.item.ticker}</span
								>
								{#if b.aktif === 0}
									<span class="tw-overline text-muted text-[9.5px]!">tanpa jadwal</span>
								{/if}
							</span>
							<span class="text-muted block truncate text-[12px]">{b.item.company_name}</span>
						</span>

						<span class="text-right">
							<span class="tw-data text-ink block text-[14px]"
								>{formatHarga(b.kutipan?.last_close_price)}</span
							>
							<span
								class="tw-data block text-[11px] md:hidden lg:block {ubah.arah > 0
									? 'text-naik'
									: ubah.arah < 0
										? 'text-turun'
										: 'text-muted'}"
							>
								{ubah.teks}
							</span>
							<span class="tw-data text-muted hidden text-[11px] md:block lg:hidden"
								>{formatRupiah(b.kutipan?.market_cap)}</span
							>
						</span>

						<span
							class="tw-data hidden text-right text-[13px] md:block lg:hidden {ubah.arah > 0
								? 'text-naik'
								: ubah.arah < 0
									? 'text-turun'
									: 'text-muted'}"
						>
							{ubah.teks}
						</span>

						<span class="hidden md:block lg:hidden">
							{#if posisi !== null}
								<span
									class="rentang-mini"
									title="Rentang 52 minggu {formatHarga(b.kutipan?.low_52w)} sampai {formatHarga(
										b.kutipan?.high_52w
									)}"
								>
									<span style="left:{posisi * 100}%"></span>
								</span>
							{:else}
								<span class="text-muted tw-data text-[11px]">-</span>
							{/if}
						</span>

						<span class="flex items-center gap-1.5">
							{#if b.skor === null}
								<span class="belum tw-data">belum</span>
							{:else}
								<SkorBadge skor={b.skor} showLabel={false} />
							{/if}
							{#if delta !== 0}
								<span class="tw-data text-secondary text-[11px]">{delta > 0 ? '+' : ''}{delta}</span
								>
							{/if}
						</span>

						<span class="hidden md:block">
							<Sparkline
								nilai={(b.risiko?.history ?? []).map((t) => t.score)}
								warna={tierDariSkor(b.skor).color}
								label="Tren Red Flag Score {b.item.ticker}"
							/>
						</span>

						<span class="tw-data text-secondary hidden text-right text-[12.5px] md:block">
							{b.aktif}/{b.item.conditions.length}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.tabel {
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
	}

	.kepala,
	.baris {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 84px 52px;
		align-items: center;
		gap: 12px;
	}

	@media (min-width: 768px) {
		.kepala,
		.baris {
			grid-template-columns: minmax(0, 1.5fr) 88px 76px 88px 84px 76px 48px;
		}
	}

	@media (min-width: 1024px) {
		.kepala,
		.baris {
			grid-template-columns: minmax(0, 1fr) 76px 70px 76px 34px;
			gap: 10px;
		}

		.kepala {
			padding-inline: 18px;
		}
	}

	.belum {
		display: inline-flex;
		border: 1px dashed var(--edge-strong);
		border-radius: 999px;
		padding: 2px 8px;
		font-size: 11px;
		color: var(--color-muted);
	}

	.kepala {
		border-block: 1px solid var(--edge-soft);
		background: rgba(8, 11, 18, 0.45);
		padding: 8px 20px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #7b8ca8;
	}

	.tombol-kepala {
		letter-spacing: inherit;
		text-transform: inherit;
		transition: color 0.2s ease;
	}

	.tombol-kepala.aktif,
	.tombol-kepala:hover {
		color: var(--color-diamond-100);
	}

	.baris {
		position: relative;
		margin: 2px 8px;
		border: 1px solid transparent;
		border-radius: 12px;
		padding: 10px 12px;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	@media (hover: hover) {
		.baris:hover {
			background: rgba(255, 255, 255, 0.03);
		}
	}

	.baris[aria-current='true'] {
		border-color: color-mix(in srgb, var(--color-diamond-500) 45%, transparent);
		background: rgba(74, 158, 255, 0.07);
	}

	.baris[aria-current='true']::before {
		content: '';
		position: absolute;
		left: -9px;
		top: 12px;
		bottom: 12px;
		width: 3px;
		border-radius: 0 3px 3px 0;
		background: var(--color-diamond-500);
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

	.saring.aktif {
		border-color: var(--color-diamond-500);
		background: rgba(74, 158, 255, 0.12);
		color: var(--color-diamond-100);
	}

	.rentang-mini {
		position: relative;
		display: block;
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(180, 205, 255, 0.1), rgba(180, 205, 255, 0.3));
	}

	.rentang-mini span {
		position: absolute;
		top: 50%;
		width: 8px;
		height: 8px;
		margin: -4px 0 0 -4px;
		border: 1.5px solid var(--color-base);
		border-radius: 2px;
		background: var(--color-ink);
		transform: rotate(45deg);
	}
</style>
