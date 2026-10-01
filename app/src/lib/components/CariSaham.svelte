<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { History, LoaderCircle, Search, X } from 'lucide-svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import { request } from '$lib/api/client';
	import { t } from '$lib/bahasa.svelte';

	type Emiten = { code: string; name: string };

	const KUNCI_TERAKHIR = 'tripwire:saham-terakhir';

	let dialog = $state<HTMLDialogElement>();
	let masukan = $state<HTMLInputElement>();
	let kata = $state('');
	let hasil = $state<Emiten[]>([]);
	let terakhir = $state<Emiten[]>([]);
	let sorot = $state(0);
	let memuat = $state(false);
	let nomor = 0;

	let mac = $state(false);
	let siap = $state(false);

	const daftar = $derived(kata.trim() ? hasil : terakhir);

	onMount(() => {
		mac = /mac|iphone|ipad/i.test(navigator.userAgent);
		siap = true;
	});

	function bacaTerakhir(): Emiten[] {
		try {
			return JSON.parse(localStorage.getItem(KUNCI_TERAKHIR) ?? '[]');
		} catch {
			return [];
		}
	}

	function simpanTerakhir(emiten: Emiten) {
		const baru = [emiten, ...bacaTerakhir().filter((satu) => satu.code !== emiten.code)].slice(
			0,
			5
		);
		try {
			localStorage.setItem(KUNCI_TERAKHIR, JSON.stringify(baru));
		} catch {
			return;
		}
	}

	export function buka() {
		if (!dialog || dialog.open) return;
		kata = '';
		hasil = [];
		sorot = 0;
		terakhir = bacaTerakhir();
		dialog.showModal();
		masukan?.focus();
	}

	async function cari(teks: string) {
		const urutan = ++nomor;
		if (!teks.trim()) {
			memuat = false;
			return;
		}
		memuat = true;
		try {
			const isi = await request<{ tickers: Emiten[] }>(
				`/tickers?q=${encodeURIComponent(teks.trim())}&limit=8`
			);
			if (urutan === nomor) {
				hasil = isi.tickers ?? [];
				sorot = 0;
			}
		} catch {
			if (urutan === nomor) hasil = [];
		} finally {
			if (urutan === nomor) memuat = false;
		}
	}

	$effect(() => {
		const teks = kata;
		const jeda = setTimeout(() => cari(teks), 120);
		return () => clearTimeout(jeda);
	});

	function pilih(emiten: Emiten) {
		simpanTerakhir(emiten);
		dialog?.close();
		goto(`/stocks/${emiten.code}`);
	}

	function tombol(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!daftar.length) return;
			const arah = event.key === 'ArrowDown' ? 1 : -1;
			sorot = (sorot + arah + daftar.length) % daftar.length;
		} else if (event.key === 'Enter' && daftar[sorot]) {
			event.preventDefault();
			pilih(daftar[sorot]);
		}
	}

	function pintasan(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			buka();
		}
	}
</script>

<svelte:window onkeydown={pintasan} />

<button
	type="button"
	class="pemicu"
	data-testid="buka-cari-saham"
	data-siap={siap}
	aria-keyshortcuts="Control+K Meta+K"
	aria-label={t('Cari saham', 'Search stocks')}
	onclick={buka}
>
	<Search class="size-4" aria-hidden="true" />
	<span class="hidden xl:inline">{t('Cari saham', 'Search stocks')}</span>
	<kbd class="hidden lg:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
</button>

<dialog
	bind:this={dialog}
	class="dialog-cari"
	aria-label={t('Cari saham BEI', 'Search IDX stocks')}
	onclick={(event) => {
		if (event.target === dialog) dialog?.close();
	}}
>
	<div class="isi">
		<div class="kolom">
			<Search class="text-muted size-4 flex-none" aria-hidden="true" />
			<input
				bind:this={masukan}
				bind:value={kata}
				type="text"
				inputmode="search"
				enterkeyhint="go"
				role="combobox"
				aria-expanded={daftar.length > 0}
				aria-controls="hasil-cari-saham"
				aria-activedescendant={daftar[sorot] ? `opsi-saham-${daftar[sorot].code}` : undefined}
				aria-label={t('Kode atau nama saham', 'Ticker or company name')}
				placeholder={t('Ketik kode atau nama saham', 'Type a ticker or company name')}
				autocomplete="off"
				data-testid="input-cari-saham"
				onkeydown={tombol}
			/>
			{#if memuat}
				<LoaderCircle class="text-muted size-4 flex-none animate-spin" aria-hidden="true" />
			{/if}
			<button
				type="button"
				class="tutup"
				aria-label={t('Tutup pencarian', 'Close search')}
				onclick={() => dialog?.close()}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>

		{#if !kata.trim() && terakhir.length}
			<p class="judul-daftar">
				<History class="size-3.5" aria-hidden="true" />
				{t('Terakhir dibuka', 'Recently opened')}
			</p>
		{/if}

		{#if daftar.length}
			<ul id="hasil-cari-saham" role="listbox" class="daftar">
				{#each daftar as emiten, urutan (emiten.code)}
					<li
						id="opsi-saham-{emiten.code}"
						role="option"
						aria-selected={urutan === sorot}
						class:sorot={urutan === sorot}
					>
						<a
							href="/stocks/{emiten.code}"
							data-testid="hasil-cari-saham"
							data-ticker={emiten.code}
							onclick={(event) => {
								event.preventDefault();
								pilih(emiten);
							}}
							onmouseenter={() => (sorot = urutan)}
						>
							<LogoEmiten kode={emiten.code} ukuran={30} />
							<span class="tw-data text-ink text-[13.5px] font-semibold">{emiten.code}</span>
							<span class="text-secondary min-w-0 flex-1 truncate text-[13px]">{emiten.name}</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else if kata.trim() && !memuat}
			<p class="kosong" data-testid="cari-saham-kosong">
				{t(
					`Tidak ada saham BEI yang cocok dengan "${kata.trim()}".`,
					`No IDX stock matches "${kata.trim()}".`
				)}
			</p>
		{:else if !kata.trim()}
			<p class="kosong">
				{t(
					'Cari dari seluruh saham BEI, lalu buka halamannya: harga, Red Flag Score, dan siapa di baliknya.',
					'Search every IDX stock, then open its page: price, Red Flag Score, and who is behind it.'
				)}
			</p>
		{/if}

		<p class="petunjuk" aria-hidden="true">
			<span><kbd>↑</kbd><kbd>↓</kbd> {t('pilih', 'move')}</span>
			<span><kbd>Enter</kbd> {t('buka', 'open')}</span>
			<span><kbd>Esc</kbd> {t('tutup', 'close')}</span>
		</p>
	</div>
</dialog>

<style>
	.pemicu {
		display: inline-flex;
		flex: none;
		white-space: nowrap;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--edge);
		border-radius: 12px;
		padding: 6px 9px;
		font-size: 13px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}

	.pemicu:hover {
		border-color: var(--color-diamond-700);
		color: var(--color-ink);
	}

	kbd {
		white-space: nowrap;
		border: 1px solid var(--edge);
		border-radius: 6px;
		padding: 0 5px;
		font-family: var(--font-mono);
		font-size: 10.5px;
		color: var(--color-muted);
	}

	.dialog-cari {
		width: min(36rem, calc(100vw - 32px));
		max-height: min(32rem, calc(100dvh - 64px));
		margin: 12vh auto auto;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 0;
		color: var(--color-ink);
		box-shadow: 0 40px 120px -40px rgba(0, 0, 0, 0.6);
	}

	.dialog-cari::backdrop {
		background: color-mix(in srgb, var(--color-void) 70%, transparent);
		backdrop-filter: blur(4px);
	}

	.isi {
		display: flex;
		flex-direction: column;
	}

	.kolom {
		display: flex;
		align-items: center;
		gap: 10px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 14px 16px;
	}

	.kolom input {
		width: 100%;
		background: transparent;
		font-size: 15px;
		color: var(--color-ink);
		outline: none;
	}

	.tutup {
		display: grid;
		width: 28px;
		height: 28px;
		flex: none;
		place-items: center;
		border-radius: 8px;
		color: var(--color-muted);
	}

	.tutup:hover {
		color: var(--color-ink);
	}

	.judul-daftar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 12px 16px 0;
		font-size: 12px;
		color: var(--color-muted);
	}

	.daftar {
		display: grid;
		gap: 2px;
		overflow-y: auto;
		padding: 8px;
	}

	.daftar a {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 12px;
		padding: 8px 10px;
	}

	.daftar li.sorot a {
		background: color-mix(in srgb, var(--color-diamond-500) 12%, transparent);
	}

	.kosong {
		padding: 18px 16px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--color-secondary);
	}

	.petunjuk {
		display: none;
		flex-wrap: wrap;
		gap: 14px;
		border-top: 1px solid var(--edge-soft);
		padding: 10px 16px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	@media (min-width: 640px) {
		.petunjuk {
			display: flex;
		}
	}

	.petunjuk kbd + kbd {
		margin-left: 3px;
	}
</style>
