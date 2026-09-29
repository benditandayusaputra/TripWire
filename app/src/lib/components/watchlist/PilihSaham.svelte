<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		ArrowDownUp,
		Check,
		LoaderCircle,
		Plus,
		Search,
		SearchX,
		TriangleAlert,
		X
	} from 'lucide-svelte';
	import LogoEmiten from './LogoEmiten.svelte';
	import { request } from '$lib/api/client';
	import { saatTerlihat } from '$lib/terlihat';
	import {
		NAMA_SEKTOR,
		formatHarga,
		formatRupiah,
		formatUbah,
		type SahamPasar
	} from '$lib/watchlist';

	let {
		dipantau,
		penuh,
		galat = '',
		onselesai
	}: {
		dipantau: string[];
		penuh: boolean;
		galat?: string;
		onselesai: (terakhir: string | null) => void;
	} = $props();

	type Urutan = 'kapitalisasi' | 'naik' | 'turun' | 'kode';

	const LANGKAH = 60;
	const URUTAN: { nilai: Urutan; label: string }[] = [
		{ nilai: 'kapitalisasi', label: 'Terbesar' },
		{ nilai: 'naik', label: 'Naik tertinggi' },
		{ nilai: 'turun', label: 'Turun terdalam' },
		{ nilai: 'kode', label: 'Kode A-Z' }
	];

	let dialog = $state<HTMLDialogElement>();
	let kolom = $state<HTMLInputElement>();
	let formTambah = $state<HTMLFormElement>();
	let daftar = $state<SahamPasar[] | null>(null);
	let galatMuat = $state('');
	let kata = $state('');
	let sektor = $state('semua');
	let urut = $state<Urutan>('kapitalisasi');
	let batas = $state(LANGKAH);
	let aktif = $state(0);
	let pilihan = $state('');
	let mengirim = $state('');
	let galatTambah = $state('');
	let ditambah = $state<string[]>([]);
	let harian = $state(true);

	const sudah = (kode: string) => dipantau.includes(kode) || ditambah.includes(kode);
	const nilaiUbah = (satu: SahamPasar, arah: number) =>
		satu.daily_close_change === null ? -1e9 : satu.daily_close_change * arah;

	const banding: Record<Urutan, (a: SahamPasar, b: SahamPasar) => number> = {
		kapitalisasi: (a, b) => (b.market_cap ?? -1) - (a.market_cap ?? -1),
		naik: (a, b) => nilaiUbah(b, 1) - nilaiUbah(a, 1),
		turun: (a, b) => nilaiUbah(b, -1) - nilaiUbah(a, -1),
		kode: (a, b) => a.ticker.localeCompare(b.ticker)
	};

	const sektorAda = $derived.by(() => {
		const hitung = new Map<string, number>();
		for (const satu of daftar ?? []) {
			if (satu.sector) hitung.set(satu.sector, (hitung.get(satu.sector) ?? 0) + 1);
		}
		return [...hitung].sort((a, b) => b[1] - a[1]);
	});

	const saring = $derived.by(() => {
		const cari = kata.trim().toUpperCase();
		const peringkat = (satu: SahamPasar) =>
			!cari || satu.ticker === cari ? 0 : satu.ticker.startsWith(cari) ? 1 : 2;
		return (daftar ?? [])
			.filter(
				(satu) =>
					(sektor === 'semua' || satu.sector === sektor) &&
					(!cari || satu.ticker.startsWith(cari) || satu.company_name.toUpperCase().includes(cari))
			)
			.sort((a, b) => peringkat(a) - peringkat(b) || banding[urut](a, b));
	});
	const tampil = $derived(saring.slice(0, batas));
	const tanpaHarga = $derived(
		Boolean(daftar?.length) && !daftar?.some((satu) => satu.last_close_price)
	);

	async function muat() {
		if (daftar) return;
		galatMuat = '';
		try {
			daftar = (await request<{ stocks: SahamPasar[] }>('/market/stocks')).stocks ?? [];
		} catch {
			galatMuat = 'Daftar saham belum bisa dimuat. Tutup lalu buka lagi sebentar kemudian.';
		}
	}

	export async function buka() {
		kata = '';
		sektor = 'semua';
		urut = 'kapitalisasi';
		ubahSaringan();
		galatTambah = '';
		ditambah = [];
		dialog?.showModal();
		muat();
		await tick();
		kolom?.focus();
	}

	function tutup() {
		dialog?.close();
	}

	function ubahSaringan() {
		batas = LANGKAH;
		aktif = 0;
	}

	async function tambah(kode: string) {
		if (mengirim || penuh || sudah(kode)) return;
		pilihan = kode;
		await tick();
		formTambah?.requestSubmit();
	}

	function sorot(urutan: number) {
		aktif = urutan;
		document
			.getElementById(`pilih-${tampil[urutan]?.ticker}`)
			?.scrollIntoView({ block: 'nearest' });
	}

	function tombol(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') sorot(Math.min(aktif + 1, tampil.length - 1));
		else if (event.key === 'ArrowUp') sorot(Math.max(aktif - 1, 0));
		else if (event.key === 'Enter' && tampil[aktif]) tambah(tampil[aktif].ticker);
		else return;
		event.preventDefault();
	}
</script>

<div class="pemicu-wadah">
	<button
		type="button"
		data-testid="buka-pilih-saham"
		data-tur="cari"
		class="pemicu"
		onclick={buka}
	>
		<Search class="text-muted size-4 flex-none" aria-hidden="true" />
		<span class="min-w-0 flex-1 truncate text-left">
			<span class="text-ink font-medium">Cari atau pilih saham</span>
			<span class="text-muted hidden sm:inline"> dari daftar lengkap BEI</span>
		</span>
		<kbd class="pintasan" aria-hidden="true">/</kbd>
		<span class="tambah-cta">
			<Plus class="size-4" aria-hidden="true" />
			<span class="hidden sm:inline">Tambah saham</span>
		</span>
	</button>
	{#if galat}
		<p
			data-testid="watchlist-error"
			role="alert"
			class="text-tier-critical mt-2.5 flex items-start gap-2 text-[13px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{galat}
		</p>
	{/if}
	{#if penuh}
		<p class="text-muted mt-2.5 text-[12px]">
			Watchlist sudah penuh, hapus satu saham untuk menambah yang baru.
		</p>
	{/if}
</div>

<dialog
	bind:this={dialog}
	class="modal"
	aria-labelledby="judul-pilih"
	onclose={() => {
		onselesai(ditambah.at(-1) ?? null);
		ditambah = [];
	}}
	onclick={(event) => event.target === dialog && tutup()}
>
	<div class="isi">
		<header class="flex items-start justify-between gap-3 px-5 pt-5">
			<div class="min-w-0">
				<h2 id="judul-pilih" class="tw-heading text-ink">Tambah saham ke watchlist</h2>
				<p class="text-muted mt-0.5 text-[12.5px]">
					{daftar ? `${daftar.length} emiten BEI` : 'Memuat daftar emiten'}, harga penutupan dan
					kapitalisasi dari Sectors
				</p>
			</div>
			<button type="button" class="tombol-tutup" onclick={tutup} aria-label="Tutup daftar saham">
				<X class="size-4" aria-hidden="true" />
			</button>
		</header>

		<div class="px-5 pt-4">
			<label for="cari-saham" class="sr-only">Cari saham</label>
			<div class="relative">
				<Search
					class="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
					aria-hidden="true"
				/>
				<input
					bind:this={kolom}
					bind:value={kata}
					id="cari-saham"
					oninput={ubahSaringan}
					onkeydown={tombol}
					placeholder="Cari kode atau nama saham"
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded="true"
					aria-controls="daftar-pilih"
					aria-activedescendant={tampil[aktif] ? `pilih-${tampil[aktif].ticker}` : undefined}
					class="tw-field tw-data pl-10 tracking-wide uppercase placeholder:tracking-normal placeholder:normal-case"
				/>
			</div>
		</div>

		<div class="saringan">
			<div class="chip-gulir" role="group" aria-label="Saring sektor">
				<button
					type="button"
					class="chip"
					aria-pressed={sektor === 'semua'}
					onclick={() => ((sektor = 'semua'), ubahSaringan())}
				>
					Semua
				</button>
				{#each sektorAda as [nama, jumlah] (nama)}
					<button
						type="button"
						class="chip"
						data-testid="sektor-{nama}"
						aria-pressed={sektor === nama}
						onclick={() => ((sektor = nama), ubahSaringan())}
					>
						{NAMA_SEKTOR[nama] ?? nama}
						<span class="tw-data text-muted">{jumlah}</span>
					</button>
				{/each}
			</div>
			<label class="relative flex-none">
				<span class="sr-only">Urutkan daftar saham</span>
				<ArrowDownUp
					class="text-muted pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					aria-hidden="true"
				/>
				<select
					bind:value={urut}
					onchange={ubahSaringan}
					class="tw-field w-auto py-1.5 pr-3 pl-8 text-[12.5px]"
				>
					{#each URUTAN as satu (satu.nilai)}
						<option value={satu.nilai}>{satu.label}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="daftar" id="daftar-pilih" role="listbox" aria-label="Daftar saham BEI">
			{#if galatMuat}
				<p class="kosong">{galatMuat}</p>
			{:else if !daftar}
				{#each [0, 1, 2, 3, 4, 5, 6] as urutan (urutan)}
					<div class="kerangka" aria-hidden="true"><span></span><span></span><span></span></div>
				{/each}
			{:else if !tampil.length}
				<p class="kosong" data-testid="pilih-kosong">
					<SearchX class="text-muted mx-auto mb-2 size-5" aria-hidden="true" />
					Tidak ada saham dengan kode atau nama "{kata.trim()}" di BEI.
				</p>
			{:else}
				{#if tanpaHarga}
					<p class="text-muted px-5 pt-2 pb-1 text-[12px]">
						Harga dari Sectors sedang tidak tersedia, saham tetap bisa ditambahkan.
					</p>
				{/if}
				{#each tampil as satu, urutan (satu.ticker)}
					{@const ubah = formatUbah(satu.daily_close_change)}
					{@const dipilih = sudah(satu.ticker)}
					<div
						id="pilih-{satu.ticker}"
						role="option"
						tabindex="-1"
						data-testid="pilih-item"
						data-ticker={satu.ticker}
						aria-selected={urutan === aktif}
						aria-disabled={dipilih || penuh}
						class="baris"
						class:aktif={urutan === aktif}
						onpointerenter={() => (aktif = urutan)}
						onclick={() => tambah(satu.ticker)}
						onkeydown={(event) => event.key === 'Enter' && tambah(satu.ticker)}
					>
						<LogoEmiten kode={satu.ticker} />
						<span class="min-w-0">
							<span class="flex items-center gap-2">
								<span class="tw-data text-ink text-[14px] font-semibold tracking-wide"
									>{satu.ticker}</span
								>
								{#if satu.sector}
									<span class="sektor">{NAMA_SEKTOR[satu.sector] ?? satu.sector}</span>
								{/if}
							</span>
							<span class="text-muted block truncate text-[12px]">{satu.company_name}</span>
						</span>
						<span class="flex flex-col items-end">
							<span class="tw-data text-ink text-[14px]">{formatHarga(satu.last_close_price)}</span>
							{#if satu.daily_close_change !== null}
								<span class="pil" data-arah={ubah.arah}>{ubah.teks}</span>
							{/if}
						</span>
						<span class="tw-data text-muted hidden text-right text-[12px] sm:block"
							>{formatRupiah(satu.market_cap)}</span
						>
						<span class="aksi" data-status={dipilih ? 'dipantau' : 'baru'}>
							{#if mengirim === satu.ticker}
								<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
							{:else if dipilih}
								<Check class="size-3.5" aria-hidden="true" />
							{:else}
								<Plus class="size-3.5" aria-hidden="true" />
							{/if}
							<span class="hidden sm:inline">{dipilih ? 'Dipantau' : 'Pantau'}</span>
						</span>
					</div>
				{/each}
				{#if saring.length > batas}
					{#key batas}
						<div
							class="px-5 py-3 text-center"
							{@attach saatTerlihat(() => (batas += LANGKAH), '0px')}
						>
							<button
								type="button"
								class="text-diamond-300 text-[13px] font-medium"
								onclick={() => (batas += LANGKAH)}
							>
								Tampilkan {Math.min(LANGKAH, saring.length - batas)} saham lagi
							</button>
						</div>
					{/key}
				{/if}
			{/if}
		</div>

		<footer class="kaki">
			<label class="text-secondary flex cursor-pointer items-center gap-2 text-[13px] select-none">
				<input type="checkbox" bind:checked={harian} class="accent-diamond-500 size-4" />
				Cek otomatis tiap hari
			</label>
			<div class="flex min-w-0 flex-1 items-center justify-end gap-3">
				{#if galatTambah}
					<p role="alert" class="text-tier-critical truncate text-[12.5px]">{galatTambah}</p>
				{:else if ditambah.length}
					<p
						data-testid="jumlah-ditambah"
						class="text-secondary truncate text-[12.5px]"
						aria-live="polite"
					>
						{ditambah.join(', ')} masuk watchlist
					</p>
				{/if}
				<button type="button" class="tw-primary px-4 py-2 text-[13.5px]" onclick={tutup}
					>Selesai</button
				>
			</div>
		</footer>
	</div>

	<form
		bind:this={formTambah}
		method="POST"
		action="?/tambah"
		class="hidden"
		use:enhance={() => {
			const kode = pilihan;
			mengirim = kode;
			galatTambah = '';
			return async ({ result, update }) => {
				mengirim = '';
				if (result.type === 'success') {
					ditambah = [...ditambah, kode];
					await update({ reset: false });
				} else if (result.type === 'failure') {
					galatTambah = String(result.data?.error ?? `Gagal menambah ${kode}`);
				} else {
					await update();
				}
			};
		}}
	>
		<input type="hidden" name="ticker" value={pilihan} />
		<input type="hidden" name="tetap" value="1" />
		{#if harian}
			<input type="hidden" name="pantau_harian" value="on" />
		{/if}
	</form>
</dialog>

<style>
	.pemicu-wadah {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.025));
		padding: 10px;
	}

	.pemicu {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge);
		border-radius: 14px;
		background: rgba(8, 11, 18, 0.55);
		padding: 7px 7px 7px 14px;
		font-size: 14px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	@media (hover: hover) {
		.pemicu:hover {
			border-color: var(--color-diamond-700);
		}
	}

	.pemicu:focus-visible {
		outline: none;
		border-color: var(--color-diamond-500);
		box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.18);
	}

	.pintasan {
		display: none;
		border: 1px solid var(--edge-strong);
		border-radius: 6px;
		padding: 0 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 18px;
		color: var(--color-muted);
	}

	@media (min-width: 640px) {
		.pintasan {
			display: block;
		}
	}

	.tambah-cta {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		border-radius: 10px;
		background: var(--color-diamond-500);
		padding: 8px 12px;
		font-size: 13.5px;
		font-weight: 600;
		color: #04101f;
	}

	.modal {
		width: min(760px, calc(100vw - 32px));
		max-width: none;
		height: min(780px, calc(100dvh - 48px));
		max-height: none;
		margin: auto;
		overflow: hidden;
		border: 1px solid var(--edge-strong);
		border-radius: 22px;
		background: linear-gradient(180deg, #121b2f, #0d1422);
		padding: 0;
		color: var(--color-ink);
		box-shadow: 0 40px 120px -30px #000;
	}

	.modal[open] {
		display: flex;
		animation: muncul-modal 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.modal::backdrop {
		background: rgba(5, 8, 14, 0.72);
		backdrop-filter: blur(4px);
	}

	:global(html:has(dialog.modal[open])) {
		overflow: hidden;
	}

	@keyframes muncul-modal {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.985);
		}
	}

	@media (max-width: 639.98px) {
		.modal {
			width: 100vw;
			height: 100dvh;
			border: 0;
			border-radius: 0;
		}
	}

	.isi {
		display: flex;
		min-height: 0;
		width: 100%;
		flex-direction: column;
	}

	.tombol-tutup {
		display: grid;
		width: 34px;
		height: 34px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 10px;
		color: var(--color-secondary);
	}

	.saringan {
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 12px 20px;
	}

	.chip-gulir {
		display: flex;
		min-width: 0;
		flex: 1;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.chip {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 4px 11px;
		font-size: 12.5px;
		white-space: nowrap;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.chip[aria-pressed='true'] {
		border-color: var(--color-diamond-500);
		background: rgba(74, 158, 255, 0.12);
		color: var(--color-diamond-100);
	}

	.daftar {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 6px 8px;
	}

	.baris {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) 5rem 2.5rem;
		align-items: center;
		gap: 12px;
		border-radius: 14px;
		padding: 9px 12px;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	@media (min-width: 640px) {
		.baris {
			grid-template-columns: auto minmax(0, 1fr) 5.5rem 4.5rem 6.75rem;
			gap: 14px;
		}
	}

	.baris.aktif {
		background: rgba(74, 158, 255, 0.08);
	}

	.baris[aria-disabled='true'] {
		cursor: default;
	}

	.sektor {
		overflow: hidden;
		border-radius: 999px;
		background: rgba(154, 169, 196, 0.1);
		padding: 0 7px;
		font-size: 10.5px;
		line-height: 17px;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-secondary);
	}

	.pil {
		margin-top: 3px;
		border-radius: 6px;
		background: rgba(154, 169, 196, 0.1);
		padding: 0 6px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		line-height: 1.5;
		white-space: nowrap;
		color: var(--color-secondary);
	}

	.pil[data-arah='1'] {
		background: color-mix(in srgb, var(--color-naik) 15%, transparent);
		color: var(--color-naik);
	}

	.pil[data-arah='-1'] {
		background: color-mix(in srgb, var(--color-turun) 15%, transparent);
		color: var(--color-turun);
	}

	.aksi {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 1px solid var(--color-diamond-700);
		border-radius: 10px;
		background: rgba(74, 158, 255, 0.08);
		padding: 6px 10px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-diamond-100);
	}

	.aksi[data-status='dipantau'] {
		border-color: color-mix(in srgb, var(--color-tier-low) 35%, transparent);
		background: color-mix(in srgb, var(--color-tier-low) 10%, transparent);
		color: var(--color-tier-low);
	}

	.kosong {
		padding: 40px 20px;
		text-align: center;
		font-size: 13.5px;
		color: var(--color-secondary);
	}

	.kerangka {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 70px;
		align-items: center;
		gap: 12px;
		padding: 12px;
	}

	.kerangka span {
		height: 14px;
		border-radius: 6px;
		background: rgba(180, 205, 255, 0.08);
		animation: denyut-kerangka 1.4s ease-in-out infinite;
	}

	.kerangka span:first-child {
		height: 36px;
		border-radius: 11px;
	}

	@keyframes denyut-kerangka {
		50% {
			opacity: 0.45;
		}
	}

	.kaki {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
		border-top: 1px solid var(--edge-soft);
		background: rgba(8, 11, 18, 0.45);
		padding: 12px 20px;
	}
</style>
