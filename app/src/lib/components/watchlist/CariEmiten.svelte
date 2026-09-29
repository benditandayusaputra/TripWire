<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { Check, LoaderCircle, Plus, Search, TriangleAlert } from 'lucide-svelte';
	import { request } from '$lib/api/client';
	import { formatHarga, formatUbah, type SahamTeratas } from '$lib/watchlist';

	let {
		dipantau,
		galat = '',
		penuh = false,
		populer = []
	}: { dipantau: string[]; galat?: string; penuh?: boolean; populer?: SahamTeratas[] } = $props();

	type Saran = { code: string; name: string; harga?: number; ubah?: number | null };

	let form: HTMLFormElement;
	let ticker = $state('');
	let saran = $state<Saran[]>([]);
	let buka = $state(false);
	let aktif = $state(-1);
	let mengirim = $state(false);
	let jeda: ReturnType<typeof setTimeout> | undefined;
	let urutanPermintaan = 0;

	function tampilkanPopuler() {
		saran = populer.map((satu) => ({
			code: satu.ticker,
			name: satu.company_name,
			harga: satu.last_close_price,
			ubah: satu.daily_close_change
		}));
		buka = saran.length > 0;
	}

	function cari() {
		clearTimeout(jeda);
		const kata = ticker.trim();
		aktif = -1;
		urutanPermintaan += 1;
		if (kata.length < 1) {
			tampilkanPopuler();
			return;
		}
		saran = [];
		buka = false;
		jeda = setTimeout(async () => {
			const nomor = ++urutanPermintaan;
			try {
				const hasil = await request<{ tickers: Saran[] }>(
					`/tickers?q=${encodeURIComponent(kata)}&limit=8`
				);
				if (nomor !== urutanPermintaan) return;
				saran = hasil.tickers ?? [];
				buka = saran.length > 0;
			} catch {
				saran = [];
				buka = false;
			}
		}, 120);
	}

	async function pilih(kode: string) {
		ticker = kode;
		buka = false;
		await tick();
		form.requestSubmit();
	}

	function tombol(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' && saran.length) {
			buka = true;
			aktif = (aktif + 1) % saran.length;
		} else if (event.key === 'ArrowUp' && saran.length) {
			aktif = aktif <= 0 ? saran.length - 1 : aktif - 1;
		} else if (event.key === 'Enter' && buka && saran.length && (aktif >= 0 || ticker.trim())) {
			const persis = saran.find((satu) => satu.code === ticker.trim().toUpperCase());
			pilih((aktif >= 0 ? saran[aktif] : (persis ?? saran[0])).code);
		} else if (event.key === 'Escape') {
			buka = false;
			return;
		} else {
			return;
		}
		event.preventDefault();
	}
</script>

<form
	bind:this={form}
	method="POST"
	action="?/tambah"
	class="space-y-3"
	use:enhance={() => {
		mengirim = true;
		buka = false;
		return async ({ result, update }) => {
			await update({ reset: false });
			mengirim = false;
			if (result.type !== 'failure') ticker = '';
		};
	}}
>
	<div class="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 sm:flex">
		<div class="relative min-w-0 flex-1 space-y-1.5">
			<label for="ticker" class="sr-only">Cari saham</label>
			<div class="relative" data-tur="cari">
				<Search
					class="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
					aria-hidden="true"
				/>
				<input
					id="ticker"
					name="ticker"
					bind:value={ticker}
					oninput={cari}
					onkeydown={tombol}
					onfocus={() => (ticker.trim() ? (buka = saran.length > 0) : tampilkanPopuler())}
					onblur={() => (buka = false)}
					placeholder="Ketik kode atau nama, misalnya BBCA atau Telkom"
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={buka}
					aria-controls="saran-emiten"
					aria-activedescendant={aktif >= 0 ? `saran-${saran[aktif]?.code}` : undefined}
					aria-invalid={galat ? 'true' : undefined}
					disabled={penuh}
					class="tw-field tw-data pl-10 tracking-wide uppercase placeholder:tracking-normal placeholder:normal-case sm:pr-10"
				/>
				{#if !ticker}
					<kbd class="pintasan" aria-hidden="true">/</kbd>
				{/if}
				{#if buka}
					<div class="saran">
						{#if !ticker.trim()}
							<p class="judul-saran" aria-hidden="true">
								Kapitalisasi terbesar di BEI, data Sectors
							</p>
						{/if}
						<ul
							id="saran-emiten"
							role="listbox"
							aria-label={ticker.trim()
								? 'Saran saham'
								: 'Saham berkapitalisasi terbesar dari Sectors'}
						>
							{#each saran as satu, urutan (satu.code)}
								{@const sudah = dipantau.includes(satu.code)}
								<li
									id="saran-{satu.code}"
									role="option"
									aria-selected={urutan === aktif}
									aria-disabled={sudah}
									class="opsi"
									class:aktif={urutan === aktif}
									onpointerdown={(event) => {
										event.preventDefault();
										if (!sudah) pilih(satu.code);
									}}
								>
									<span class="tw-data text-ink w-12 flex-none text-[13px] font-semibold"
										>{satu.code}</span
									>
									<span class="text-secondary min-w-0 flex-1 truncate text-[13px]">{satu.name}</span
									>
									{#if satu.harga !== undefined}
										{@const ubah = formatUbah(satu.ubah)}
										<span class="flex flex-none flex-col items-end leading-tight">
											<span class="tw-data text-ink text-[12.5px]">{formatHarga(satu.harga)}</span>
											<span
												class="tw-data text-[11px] {ubah.arah > 0
													? 'text-naik'
													: ubah.arah < 0
														? 'text-turun'
														: 'text-muted'}">{ubah.teks}</span
											>
										</span>
									{/if}
									{#if sudah}
										<span class="text-tier-low flex flex-none items-center gap-1 text-[11.5px]">
											<Check class="size-3" aria-hidden="true" />
											Dipantau
										</span>
									{:else}
										<Plus class="text-diamond-300 size-3.5 flex-none" aria-hidden="true" />
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</div>

		<label
			class="text-secondary order-last col-span-2 flex cursor-pointer items-center gap-2 text-[13px] select-none sm:order-none sm:px-1 sm:py-2.5"
		>
			<input type="checkbox" name="pantau_harian" checked class="accent-diamond-500 size-4" />
			Cek otomatis tiap hari
		</label>

		<button
			type="submit"
			data-testid="tambah-ticker"
			class="tw-primary px-4 py-2.75"
			disabled={penuh || mengirim}
		>
			{#if mengirim}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				Menambah
			{:else}
				<Plus class="size-4" aria-hidden="true" />
				Pantau
			{/if}
		</button>
	</div>

	{#if galat}
		<p
			data-testid="watchlist-error"
			role="alert"
			class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical flex items-start gap-2.5 border px-3.5 py-2.5 text-[13px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{galat}
		</p>
	{/if}
</form>

<style>
	.saran {
		position: absolute;
		inset: calc(100% + 6px) 0 auto;
		z-index: 30;
		max-height: 320px;
		overflow-y: auto;
		border: 1px solid var(--edge-strong);
		border-radius: 12px;
		background: rgba(20, 28, 46, 0.98);
		padding: 5px;
		box-shadow: 0 24px 50px -20px #000;
	}

	.opsi {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 8px;
		padding: 8px 10px;
		cursor: pointer;
	}

	.pintasan {
		position: absolute;
		top: 50%;
		right: 12px;
		display: none;
		border: 1px solid var(--edge-strong);
		border-radius: 6px;
		padding: 0 6px;
		font-family: var(--font-mono);
		font-size: 11px;
		line-height: 18px;
		color: var(--color-muted);
		transform: translateY(-50%);
		pointer-events: none;
	}

	@media (min-width: 640px) {
		.pintasan {
			display: block;
		}
	}

	.judul-saran {
		padding: 6px 10px 4px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.opsi.aktif,
	.opsi:hover {
		background: rgba(74, 158, 255, 0.1);
	}

	.opsi[aria-disabled='true'] {
		cursor: default;
		opacity: 0.7;
	}
</style>
