<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import { goto, invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import { BellRing, Database, Plus, Radar, ShieldCheck, TriangleAlert } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import CariEmiten from '$lib/components/watchlist/CariEmiten.svelte';
	import PanelEmiten from '$lib/components/watchlist/PanelEmiten.svelte';
	import RingkasanPantauan from '$lib/components/watchlist/RingkasanPantauan.svelte';
	import TabelWatchlist from '$lib/components/watchlist/TabelWatchlist.svelte';
	import { emiten } from '$lib/emiten';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';
	import { tierDariSkor } from '$lib/skor';
	import { BATAS_WATCHLIST, type Baris } from '$lib/watchlist';

	let { data, form } = $props();

	let sekarang = $state(Date.now());
	let kabar = $state<{ ticker: string; skor: number | null } | null>(null);
	let terakhirTerbaca = presenceStore.insightBaru[0]?.notification_id;
	let jedaKabar: ReturnType<typeof setTimeout> | undefined;

	const baris = $derived<Baris[]>(
		data.items.map((item) => ({
			item,
			kutipan: data.quotes[item.ticker] ?? null,
			risiko: data.risk[item.ticker] ?? null,
			skor: data.risk[item.ticker]?.red_flag?.score ?? null,
			ubah: data.quotes[item.ticker]?.daily_close_change ?? null,
			aktif: item.conditions.filter((kondisi) => kondisi.is_active).length
		}))
	);
	const terpilih = $derived(baris.find((b) => b.item.ticker === data.kode) ?? null);
	const dipantau = $derived(data.items.map((item) => item.ticker));
	const populer = $derived(emiten.filter(([kode]) => !dipantau.includes(kode)).slice(0, 8));
	const penuh = $derived(data.items.length >= BATAS_WATCHLIST);

	onMount(() => {
		const detak = setInterval(() => (sekarang = Date.now()), 30_000);
		presenceStore.sambung();
		return () => {
			clearInterval(detak);
			clearTimeout(jedaKabar);
			presenceStore.putus();
		};
	});

	$effect(() => {
		const terbaru = presenceStore.insightBaru[0];
		if (!terbaru || terbaru.notification_id === terakhirTerbaca) return;
		terakhirTerbaca = terbaru.notification_id;
		kabar = { ticker: terbaru.ticker, skor: terbaru.score };
		if (!navigating.to) invalidateAll();
		clearTimeout(jedaKabar);
		jedaKabar = setTimeout(() => (kabar = null), 6000);
	});

	function fokusLembar(node: HTMLElement) {
		if (data.dipilih && matchMedia('(max-width: 1023.98px)').matches) {
			node
				.querySelector<HTMLElement>('[data-testid="panel-emiten"]')
				?.focus({ preventScroll: true });
		}
	}

	function pintasan(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const mengetik =
			['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
		if (event.key === '/' && !mengetik) {
			event.preventDefault();
			document.getElementById('ticker')?.focus();
		} else if (event.key === 'Escape' && data.dipilih && !mengetik) {
			goto('/watchlist', { noScroll: true });
		}
	}
</script>

<svelte:head>
	<title>Watchlist TripWire</title>
</svelte:head>

<svelte:window onkeydown={pintasan} />

<section class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
		<div class="space-y-1.5">
			<p class="tw-overline">Watchlist</p>
			<h1 class="tw-title text-ink">Emiten yang kamu pantau</h1>
			<p class="text-secondary max-w-2xl text-[14px]">
				Harga penutupan dan kapitalisasi dibaca dari Sectors, skor risiko dari pemindaian TripWire.
				Pilih satu emiten untuk melihat grafik, sinyal tata kelola, dan jadwal pengecekannya.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<p
				data-testid="status-langsung"
				data-terhubung={presenceStore.terhubung}
				class="langsung"
				class:aktif={presenceStore.terhubung}
			>
				<span class="titik" aria-hidden="true"></span>
				{presenceStore.terhubung ? 'Pembaruan langsung' : 'Menyambungkan'}
			</p>
			<div
				class="slot"
				aria-label="{data.items.length} dari {BATAS_WATCHLIST} slot watchlist terpakai"
			>
				<p class="flex items-baseline justify-between gap-6">
					<span class="tw-overline">Slot</span>
					<span class="tw-data text-ink text-[14px]">
						{data.items.length} <span class="text-muted">/ {BATAS_WATCHLIST}</span>
					</span>
				</p>
				<span class="lajur-slot"
					><span style="width:{(data.items.length / BATAS_WATCHLIST) * 100}%"></span></span
				>
			</div>
		</div>
	</header>

	{#if kabar}
		<p
			data-testid="kabar-insight"
			class="kabar"
			role="status"
			transition:fly={{ y: -12, duration: 250 }}
		>
			<BellRing class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
			<span>
				Insight baru <span class="tw-data text-ink font-semibold">{kabar.ticker}</span>
				{#if kabar.skor !== null}
					dengan skor <span class="tw-data font-semibold {tierDariSkor(kabar.skor).text}"
						>{Math.round(kabar.skor)}</span
					>
				{/if}, watchlist sudah diperbarui.
			</span>
		</p>
	{/if}

	<div class="tw-card relative z-20 p-4 sm:p-5">
		<CariEmiten {dipantau} {penuh} galat={form?.aksi === 'tambah' ? (form?.error ?? '') : ''} />
		<p class="text-muted mt-2.5 hidden text-[12px] sm:block">
			Tekan <kbd class="tw-data border-line rounded border px-1 text-[11px]">/</kbd> untuk langsung
			mencari.
			{penuh ? 'Watchlist sudah penuh, hapus satu emiten untuk menambah yang baru.' : ''}
		</p>
	</div>

	{#if form?.aksi === 'hapus' && form?.error}
		<p role="alert" class="text-tier-critical flex items-center gap-2 text-[13px]">
			<TriangleAlert class="size-4" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	{#if data.items.length === 0}
		<div class="kosong">
			<div class="max-w-xl space-y-3">
				<span class="ikon-kosong"><Radar class="size-5" aria-hidden="true" /></span>
				<h2 class="tw-heading text-ink">Mulai dari satu emiten</h2>
				<p data-testid="watchlist-kosong" class="text-secondary text-[14px] leading-relaxed">
					Belum ada emiten yang dipantau. Cari kode emiten di atas, atau pilih salah satu di bawah.
					TripWire langsung memasang jadwal cek harian supaya emiten itu ikut dipindai.
				</p>
			</div>

			<div class="mt-5 flex flex-wrap gap-2">
				{#each populer as [kode, nama] (kode)}
					<form method="POST" action="?/tambah" use:enhance>
						<input type="hidden" name="ticker" value={kode} />
						<input type="hidden" name="pantau_harian" value="on" />
						<button type="submit" class="chip-populer" title="Pantau {nama}">
							<Plus class="size-3" aria-hidden="true" />
							<span class="tw-data text-ink font-semibold">{kode}</span>
							<span class="text-muted hidden sm:inline">{nama}</span>
						</button>
					</form>
				{/each}
			</div>

			<ol class="mt-7 grid gap-3 sm:grid-cols-3">
				{#each [{ ikon: Database, judul: 'Data dari Sectors', teks: 'Laporan emiten, transaksi orang dalam, dan riwayat suspensi diambil otomatis.' }, { ikon: ShieldCheck, judul: 'Skor 0 sampai 100', teks: 'Tiga sinyal tata kelola digabung jadi Red Flag Score yang bisa dicek sumbernya.' }, { ikon: BellRing, judul: 'Kabar saat melewati batas', teks: 'Atur kondisi pemicu per emiten, notifikasi datang lengkap dengan alasannya.' }] as langkah (langkah.judul)}
					<li class="langkah">
						<langkah.ikon class="text-diamond-300 size-4" aria-hidden="true" />
						<p class="text-ink mt-2 text-[14px] font-medium">{langkah.judul}</p>
						<p class="tw-caption mt-1">{langkah.teks}</p>
					</li>
				{/each}
			</ol>
		</div>
	{:else}
		<RingkasanPantauan {baris} jadwal={data.schedule} {sekarang} />

		<div class="grid items-start gap-5 lg:grid-cols-12">
			<div class="min-w-0 lg:col-span-5">
				<TabelWatchlist {baris} terpilih={data.kode} />
			</div>

			<div class="min-w-0 lg:col-span-7">
				{#if terpilih}
					{#key terpilih.item.id}
						<div class="wadah-panel" class:lembar={data.dipilih} {@attach fokusLembar}>
							<PanelEmiten
								item={terpilih.item}
								kutipan={terpilih.kutipan}
								risiko={terpilih.risiko}
								jadwal={data.schedule}
								harga={data.harga}
								insights={data.insights}
								galatKondisi={form?.aksi === 'kondisi' ? (form?.error ?? '') : ''}
								galatTampilan={form?.aksi === 'tampilan' ? (form?.error ?? '') : ''}
							/>
						</div>
					{/key}
				{/if}
			</div>
		</div>
	{/if}

	<DisclaimerBar />
</section>

<style>
	.langsung {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--edge-soft);
		border-radius: 999px;
		padding: 5px 12px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.langsung .titik {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-muted);
	}

	.langsung.aktif {
		color: var(--color-secondary);
	}

	.langsung.aktif .titik {
		background: var(--color-diamond-300);
		box-shadow: 0 0 0 0 rgba(143, 208, 255, 0.6);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		70% {
			box-shadow: 0 0 0 7px rgba(143, 208, 255, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(143, 208, 255, 0);
		}
	}

	.kabar {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 14px;
		background: rgba(20, 28, 46, 0.9);
		padding: 10px 14px;
		font-size: 13px;
		color: var(--color-secondary);
	}

	.slot {
		min-width: 12rem;
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.025);
		padding: 10px 14px;
	}

	.lajur-slot {
		display: block;
		height: 4px;
		margin-top: 8px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.1);
	}

	.lajur-slot span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--color-diamond-500);
	}

	.kosong {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background:
			radial-gradient(600px 240px at 20% 0%, rgba(74, 158, 255, 0.12), transparent 70%),
			var(--color-base);
		padding: 28px;
	}

	.ikon-kosong {
		display: grid;
		width: 40px;
		height: 40px;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 12px;
		background: var(--color-diamond-900);
		color: var(--color-diamond-300);
	}

	.chip-populer {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 6px 12px;
		font-size: 12.5px;
		color: var(--color-diamond-300);
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	@media (hover: hover) {
		.chip-populer:hover {
			border-color: var(--color-diamond-500);
			background: rgba(74, 158, 255, 0.08);
			transform: translateY(-2px);
		}
	}

	.langkah {
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.02);
		padding: 14px 16px;
	}

	.wadah-panel {
		display: none;
	}

	.wadah-panel.lembar {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: block;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: rgba(8, 11, 18, 0.78);
		backdrop-filter: blur(8px);
		padding: 12px 8px 24px;
		animation: naik-lembar 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes naik-lembar {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}

	@media (min-width: 1024px) {
		.wadah-panel,
		.wadah-panel.lembar {
			position: sticky;
			top: 84px;
			z-index: auto;
			display: block;
			overflow: visible;
			background: none;
			backdrop-filter: none;
			padding: 0;
			animation: none;
		}
	}
</style>
