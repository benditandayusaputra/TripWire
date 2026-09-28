<script lang="ts">
	import { goto, invalidate, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount, untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		Activity,
		ArrowUpRight,
		BellRing,
		ChartColumn,
		CheckCheck,
		Inbox,
		SlidersHorizontal,
		Trash2
	} from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import BarisNotifikasi from '$lib/components/notifikasi/BarisNotifikasi.svelte';
	import EmitenTeraktif from '$lib/components/notifikasi/EmitenTeraktif.svelte';
	import GrafikAktivitas from '$lib/components/notifikasi/GrafikAktivitas.svelte';
	import Panel from '$lib/components/notifikasi/Panel.svelte';
	import PanelAturan from '$lib/components/notifikasi/PanelAturan.svelte';
	import PanelPengiriman from '$lib/components/notifikasi/PanelPengiriman.svelte';
	import SebaranTier from '$lib/components/notifikasi/SebaranTier.svelte';
	import {
		hapusNotifikasi,
		hapusYangDibaca,
		riwayatNotifikasi,
		ringkasanNotifikasi,
		tandaiBelumDibaca,
		tandaiDibaca,
		tandaiSemuaDibaca,
		type Notifikasi,
		type RingkasanNotifikasi
	} from '$lib/api/notifications';
	import { waktuRelatif } from '$lib/insight';
	import { judulNotifikasi, kelompokPerHari, tautanFilter, TIER_URUT } from '$lib/notifikasi';
	import { pushStore } from '$lib/pwa.svelte';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';

	let { data } = $props();

	const KOSONG: RingkasanNotifikasi = {
		total: 0,
		unread: 0,
		last_7_days: 0,
		critical_7_days: 0,
		last_30_days: 0,
		previous_30_days: 0,
		red_flag: 0,
		market_intelligence: 0,
		critical: 0,
		high: 0,
		moderate: 0,
		low: 0,
		last_sent_at: null,
		daily: [],
		tickers: [],
		peak_30_days: null,
		push_devices: 0,
		push_enabled: false,
		online: false
	};

	const WAKIL_TIER = { critical: 90, high: 70, moderate: 45, low: 10 } as const;

	const daftarAwal = $derived(data.notifications);
	const kursorAwal = $derived(data.nextCursor);
	const ringkasanAwal = $derived(data.summary ?? KOSONG);

	let daftar = $derived(daftarAwal);
	let kursor = $derived(kursorAwal);
	let ringkasan = $derived(ringkasanAwal);

	let memuat = $state(false);
	let sibuk = $state('');
	let galat = $state('');
	let konfirmasiBersih = $state(false);
	let berbunyi = $state(false);

	const tautan = (ubah: Record<string, string | null>) => tautanFilter(page.url.searchParams, ubah);
	const kelompok = $derived(kelompokPerHari(daftar));
	const filterAktif = $derived(
		Boolean(data.filter.status || data.filter.type || data.filter.tier || data.filter.ticker)
	);
	const tab = $derived(
		data.filter.status === 'unread'
			? 'unread'
			: data.filter.type === 'red_flag'
				? 'red_flag'
				: data.filter.type === 'market_intelligence'
					? 'market'
					: 'all'
	);
	const daftarTab = $derived([
		{
			kunci: 'all',
			label: 'Semua',
			jumlah: ringkasan.total,
			href: tautan({ status: null, type: null })
		},
		{
			kunci: 'unread',
			label: 'Belum dibaca',
			jumlah: ringkasan.unread,
			href: tautan({ status: 'unread', type: null })
		},
		{
			kunci: 'red_flag',
			label: 'Red flag',
			jumlah: ringkasan.red_flag,
			href: tautan({ status: null, type: 'red_flag' })
		},
		{
			kunci: 'market',
			label: 'Intelijen pasar',
			jumlah: ringkasan.market_intelligence,
			href: tautan({ status: null, type: 'market_intelligence', tier: null })
		}
	]);
	const pilihanEmiten = $derived(
		data.filter.ticker && !ringkasan.tickers.some((satu) => satu.ticker === data.filter.ticker)
			? [{ ticker: data.filter.ticker, total: 0 }, ...ringkasan.tickers]
			: ringkasan.tickers
	);
	const tren30 = $derived.by(() => {
		const selisih = ringkasan.last_30_days - ringkasan.previous_30_days;
		if (selisih === 0) return 'sama dengan 30 hari sebelumnya';
		return `${selisih > 0 ? '▲' : '▼'} ${Math.abs(selisih)} dari 30 hari sebelumnya`;
	});
	const jumlahDibaca = $derived(ringkasan.total - ringkasan.unread);

	onMount(() => {
		pushStore.periksa();
		presenceStore.bersihkan();
		presenceStore.sambung();
		return () => presenceStore.putus();
	});

	let jumlahLive = 0;
	$effect(() => {
		const jumlah = presenceStore.insightBaru.length;
		if (jumlah > jumlahLive) {
			untrack(() => {
				berbunyi = true;
				setTimeout(() => (berbunyi = false), 900);
				invalidate('tripwire:notifikasi');
			});
		}
		jumlahLive = jumlah;
	});

	async function segarkan() {
		const [baru] = await Promise.all([
			ringkasanNotifikasi().catch(() => null),
			invalidate('tripwire:notifikasi')
		]);
		if (baru) ringkasan = baru;
	}

	async function jalankan(kunci: string, aksi: () => Promise<unknown>) {
		if (sibuk) return;
		sibuk = kunci;
		galat = '';
		try {
			await aksi();
		} catch (err) {
			galat = err instanceof Error ? err.message : 'Aksi gagal, coba lagi.';
		} finally {
			sibuk = '';
		}
	}

	function buka(event: MouseEvent, item: { id: string; read_at?: string | null }) {
		if (item.read_at) return;

		const tujuan = (event.currentTarget as HTMLAnchorElement).href;
		const ditandai = tandaiDibaca(item.id).catch(() => undefined);
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;

		event.preventDefault();
		ditandai.then(() => goto(tujuan, { invalidateAll: true }));
	}

	function tandai(item: Notifikasi) {
		jalankan(item.id, async () => {
			const { notification } = item.read_at
				? await tandaiBelumDibaca(item.id)
				: await tandaiDibaca(item.id);
			daftar = daftar.map((satu) =>
				satu.id === item.id ? { ...satu, read_at: notification.read_at } : satu
			);
			await segarkan();
		});
	}

	function hapus(item: Notifikasi) {
		jalankan(item.id, async () => {
			await hapusNotifikasi(item.id);
			daftar = daftar.filter((satu) => satu.id !== item.id);
			await segarkan();
		});
	}

	function tandaiSemua() {
		jalankan('semua', async () => {
			await tandaiSemuaDibaca();
			presenceStore.bersihkan();
			await invalidateAll();
		});
	}

	function bersihkan() {
		jalankan('bersih', async () => {
			await hapusYangDibaca();
			konfirmasiBersih = false;
			await invalidateAll();
		});
	}

	function serapLive() {
		jalankan('live', async () => {
			presenceStore.bersihkan();
			await invalidateAll();
		});
	}

	async function muatLagi() {
		if (!kursor || memuat) return;
		memuat = true;
		galat = '';
		try {
			const query = new URLSearchParams(data.query);
			query.set('before', kursor);
			const hasil = await riwayatNotifikasi(query.toString());
			const ada = new Set(daftar.map((satu) => satu.id));
			daftar = [...daftar, ...hasil.notifications.filter((satu) => !ada.has(satu.id))];
			kursor = hasil.next_cursor;
		} catch (err) {
			galat = err instanceof Error ? err.message : 'Gagal memuat notifikasi berikutnya.';
		} finally {
			memuat = false;
		}
	}

	function pilihEmiten(kode: string) {
		goto(tautan({ ticker: kode || null }), { noScroll: true, keepFocus: true });
	}
</script>

<svelte:head>
	<title>{ringkasan.unread > 0 ? `(${ringkasan.unread}) ` : ''}Notifikasi TripWire</title>
</svelte:head>

<div class="space-y-6">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="space-y-1.5">
			<p class="tw-overline">Pusat notifikasi</p>
			<h1 class="tw-title text-ink flex items-center gap-3">
				Notifikasi
				<span class="lonceng" class:bunyi={berbunyi}>
					<BellRing class="text-diamond-300 size-6" aria-hidden="true" />
				</span>
			</h1>
			<p class="tw-caption max-w-xl">
				Peringatan risiko dan pembaruan analisis dari saham di watchlist kamu, masuk begitu skornya
				melewati batas yang kamu atur.
				{#if ringkasan.last_sent_at}
					Terakhir masuk <span class="tw-data text-secondary"
						>{waktuRelatif(ringkasan.last_sent_at)}</span
					>.
				{/if}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<span
				data-testid="status-stream"
				data-terhubung={presenceStore.terhubung}
				class="pil-langsung"
				class:hidup={presenceStore.terhubung}
			>
				<span class="denyut" aria-hidden="true"></span>
				{presenceStore.terhubung ? 'Langsung' : 'Menyambungkan'}
			</span>
			<button
				type="button"
				data-testid="tandai-semua"
				class="tw-ghost px-3.5 py-2 text-[13px]"
				disabled={sibuk !== '' || ringkasan.unread === 0}
				onclick={tandaiSemua}
			>
				<CheckCheck class="size-4" aria-hidden="true" />
				{sibuk === 'semua' ? 'Menandai' : 'Tandai semua dibaca'}
			</button>
		</div>
	</header>

	<dl class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpi-notifikasi">
		<div class="tile">
			<dt class="text-muted text-[12px]">Belum dibaca</dt>
			<dd data-testid="kpi-belum" class="tw-data text-ink mt-1.5 text-[26px] leading-none">
				{ringkasan.unread}
			</dd>
			<dd class="text-secondary mt-2 text-[12px]">dari {ringkasan.total} notifikasi</dd>
		</div>
		<div class="tile">
			<dt class="text-muted text-[12px]">Kritis 7 hari</dt>
			<dd
				data-testid="kpi-kritis"
				class="tw-data text-ink mt-1.5 flex items-center gap-2 text-[26px] leading-none"
			>
				{ringkasan.critical_7_days}
				{#if ringkasan.critical_7_days > 0}
					<span class="tanda-kritis" aria-hidden="true"></span>
				{/if}
			</dd>
			<dd class="text-secondary mt-2 text-[12px]">skor 86 ke atas</dd>
		</div>
		<div class="tile">
			<dt class="text-muted text-[12px]">Masuk 30 hari</dt>
			<dd data-testid="kpi-30-hari" class="tw-data text-ink mt-1.5 text-[26px] leading-none">
				{ringkasan.last_30_days}
			</dd>
			<dd class="text-secondary tw-data mt-2 text-[11.5px]">{tren30}</dd>
		</div>
		<div class="tile">
			<dt class="text-muted text-[12px]">Skor tertinggi 30 hari</dt>
			{#if ringkasan.peak_30_days}
				{@const puncak = ringkasan.peak_30_days}
				{@const info = tierDariSkor(puncak.score)}
				<dd data-testid="kpi-puncak" class="mt-1.5 flex items-baseline gap-2">
					<span class="tw-data text-ink text-[26px] leading-none">{bulatkanSkor(puncak.score)}</span
					>
					<span class="text-secondary flex items-center gap-1.5 text-[12px]">
						<span class="kotak" style="background:{info.color}"></span>{info.label}
					</span>
				</dd>
				<dd class="mt-2 text-[12px]">
					<a
						href="/insights/{puncak.insight_id}"
						class="text-diamond-300 inline-flex items-center gap-1 hover:underline"
					>
						<span class="tw-data">{puncak.ticker}</span>
						<ArrowUpRight class="size-3.5" aria-hidden="true" />
					</a>
				</dd>
			{:else}
				<dd class="tw-data text-muted mt-1.5 text-[26px] leading-none">-</dd>
				<dd class="text-secondary mt-2 text-[12px]">belum ada red flag</dd>
			{/if}
		</div>
	</dl>

	<div class="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
		<section class="kotak-masuk" aria-labelledby="judul-kotak-masuk">
			<div class="space-y-3 px-4 pt-4 sm:px-5">
				<div class="flex items-center justify-between gap-3">
					<h2
						id="judul-kotak-masuk"
						class="text-ink flex items-center gap-2 text-[15px] font-semibold"
					>
						<Inbox class="text-secondary size-4" aria-hidden="true" />
						Kotak masuk
					</h2>
					{#if filterAktif}
						<a
							href="/notifications"
							data-testid="reset-filter"
							class="text-diamond-300 text-[12.5px] hover:underline"
						>
							Reset filter
						</a>
					{/if}
				</div>

				<nav class="tab-bar" aria-label="Kategori notifikasi">
					{#each daftarTab as satu (satu.kunci)}
						<a
							href={satu.href}
							data-sveltekit-noscroll
							data-testid="tab-{satu.kunci}"
							aria-current={tab === satu.kunci ? 'page' : undefined}
							class="tab"
							class:aktif={tab === satu.kunci}
						>
							{satu.label}
							<span class="tw-data jumlah">{satu.jumlah}</span>
						</a>
					{/each}
				</nav>

				<div class="flex flex-wrap items-center gap-2">
					<div class="flex flex-wrap gap-1.5" role="group" aria-label="Tingkat risiko">
						{#each TIER_URUT as tier (tier)}
							{@const info = tierDariSkor(WAKIL_TIER[tier])}
							<a
								href={tautan({
									tier: data.filter.tier === tier ? null : tier,
									type: data.filter.type === 'market_intelligence' ? null : data.filter.type || null
								})}
								data-sveltekit-noscroll
								data-testid="chip-{tier}"
								aria-current={data.filter.tier === tier ? 'true' : undefined}
								class="chip"
								class:aktif={data.filter.tier === tier}
							>
								<span class="kotak" style="background:{info.color}"></span>
								{info.label}
								<span class="tw-data text-muted">{ringkasan[tier]}</span>
							</a>
						{/each}
					</div>

					<label class="ml-auto">
						<span class="sr-only">Filter emiten</span>
						<select
							data-testid="filter-emiten"
							class="pilih"
							value={data.filter.ticker}
							onchange={(event) => pilihEmiten(event.currentTarget.value)}
						>
							<option value="">Semua emiten</option>
							{#each pilihanEmiten as satu (satu.ticker)}
								<option value={satu.ticker}>{satu.ticker} ({satu.total})</option>
							{/each}
						</select>
					</label>
				</div>
			</div>

			<div class="langsung" aria-live="polite">
				<p class="tw-overline flex items-center gap-2">
					<span class="titik-langsung" class:hidup={presenceStore.terhubung} aria-hidden="true"
					></span>
					Baru masuk
					{#if presenceStore.insightBaru.length}
						<button
							type="button"
							data-testid="serap-live"
							class="text-diamond-300 ml-auto tracking-normal normal-case hover:underline"
							disabled={sibuk !== ''}
							onclick={serapLive}
						>
							Tampilkan di daftar
						</button>
					{/if}
				</p>

				<ul data-testid="insight-live" class="mt-2 space-y-2">
					{#each presenceStore.insightBaru as insight (insight.notification_id)}
						<li
							data-testid="insight-live-item"
							data-ticker={insight.ticker}
							class="kartu-live"
							in:fly={{ y: -18, duration: 450 }}
						>
							<span class="emblem-live tw-data">{insight.ticker}</span>
							<span class="min-w-0 flex-1">
								<span class="text-ink block truncate text-[13.5px] font-semibold">
									{judulNotifikasi(insight)}
								</span>
								<span class="text-secondary block truncate text-[12px]">
									{insight.company_name} · baru saja
								</span>
							</span>
							{#if insight.insight_type === 'red_flag'}
								<SkorBadge skor={insight.score} />
							{/if}
							<a
								href="/insights/{insight.insight_id}"
								class="text-diamond-300 inline-flex flex-none items-center gap-1 text-[12.5px] hover:underline"
								onclick={(event) => buka(event, { id: insight.notification_id })}
							>
								Lihat
								<ArrowUpRight class="size-3.5" aria-hidden="true" />
							</a>
						</li>
					{:else}
						<li data-testid="insight-live-kosong" class="text-muted text-[12.5px]">
							Belum ada insight baru sejak halaman ini dibuka.
						</li>
					{/each}
				</ul>
			</div>

			<div data-testid="notifikasi-riwayat" class="px-2 pb-2 sm:px-3">
				{#if daftar.length}
					{#each kelompok as grup (grup.tanggal)}
						<section class="pt-3" aria-label={grup.label}>
							<h3 class="kepala-grup">
								<span>{grup.label}</span>
								<span class="tw-data">{grup.isi.length}</span>
							</h3>
							<ul class="divide-line divide-y">
								{#each grup.isi as item (item.id)}
									<BarisNotifikasi
										{item}
										sibuk={sibuk === item.id}
										onbuka={buka}
										ontandai={tandai}
										onhapus={hapus}
									/>
								{/each}
							</ul>
						</section>
					{/each}

					<div class="flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-2">
						{#if kursor}
							<button
								type="button"
								data-testid="muat-lagi"
								class="tw-ghost px-3.5 py-2 text-[13px]"
								disabled={memuat}
								onclick={muatLagi}
							>
								{memuat ? 'Memuat' : 'Muat lebih banyak'}
							</button>
						{:else}
							<p class="text-muted text-[12.5px]">Semua notifikasi sudah ditampilkan.</p>
						{/if}

						{#if jumlahDibaca > 0}
							{#if konfirmasiBersih}
								<span class="flex items-center gap-2 text-[12.5px]">
									<span class="text-secondary"
										>Hapus {jumlahDibaca} notifikasi yang sudah dibaca?</span
									>
									<button
										type="button"
										data-testid="konfirmasi-bersih"
										class="tw-ghost px-3 py-1.5 text-[12.5px]"
										disabled={sibuk !== ''}
										onclick={bersihkan}
									>
										Hapus
									</button>
									<button
										type="button"
										class="text-muted hover:text-ink px-1"
										onclick={() => (konfirmasiBersih = false)}
									>
										Batal
									</button>
								</span>
							{:else}
								<button
									type="button"
									data-testid="bersihkan-dibaca"
									class="text-muted hover:text-ink inline-flex items-center gap-1.5 text-[12.5px]"
									onclick={() => (konfirmasiBersih = true)}
								>
									<Trash2 class="size-3.5" aria-hidden="true" />
									Bersihkan yang sudah dibaca
								</button>
							{/if}
						{/if}
					</div>
				{:else if filterAktif}
					<div data-testid="kosong-filter" class="kosong">
						<p class="text-ink text-[14px] font-medium">Tidak ada notifikasi yang cocok</p>
						<p class="tw-caption">Coba ubah kategori, tingkat risiko, atau emitennya.</p>
						<a href="/notifications" class="tw-ghost mt-2 px-3.5 py-2 text-[13px]"
							>Lihat semua notifikasi</a
						>
					</div>
				{:else}
					<div data-testid="kosong-total" class="kosong">
						<span class="lingkar-kosong">
							<BellRing class="text-diamond-300 size-5" aria-hidden="true" />
						</span>
						<p class="text-ink text-[15px] font-medium">Belum ada notifikasi</p>
						<p class="tw-caption max-w-sm">
							Notifikasi muncul begitu insight baru dibuat untuk saham di watchlist kamu dan lolos
							kondisi yang kamu atur.
						</p>
						<a href="/watchlist" class="tw-primary mt-2 px-4 py-2 text-[13.5px]">Atur watchlist</a>
					</div>
				{/if}

				{#if galat}
					<p class="text-secondary px-2 pb-3 text-[12.5px]" role="alert">{galat}</p>
				{/if}
			</div>
		</section>

		<aside class="min-w-0 space-y-5" aria-label="Ringkasan dan pengaturan notifikasi">
			<Panel
				judul="Aktivitas 30 hari"
				keterangan="Notifikasi per hari, waktu WIB"
				ikon={ChartColumn}
				testid="panel-aktivitas"
			>
				<GrafikAktivitas hari={ringkasan.daily} />
				<div class="border-line mt-5 border-t pt-4">
					<p class="tw-overline mb-2">Sebaran tingkat risiko</p>
					<SebaranTier
						jumlah={ringkasan}
						tautan={(tier) => tautan({ tier, type: null })}
						aktif={data.filter.tier}
					/>
				</div>
			</Panel>

			<Panel
				judul="Emiten paling sering"
				keterangan="Urut dari jumlah notifikasi 30 hari"
				ikon={Activity}
				testid="panel-emiten"
			>
				{#if ringkasan.tickers.length}
					<EmitenTeraktif
						emiten={ringkasan.tickers.slice(0, 6)}
						tautan={(ticker) => tautan({ ticker })}
						aktif={data.filter.ticker}
					/>
				{:else}
					<p class="text-muted text-[12.5px]">Belum ada emiten yang memicu notifikasi.</p>
				{/if}
			</Panel>

			<Panel
				judul="Saluran pengiriman"
				keterangan="Cara TripWire mengabari kamu"
				ikon={BellRing}
				testid="panel-pengiriman"
			>
				<PanelPengiriman perangkat={data.devices} pushServer={ringkasan.push_enabled} />
			</Panel>

			<Panel
				judul="Aturan peringatan"
				keterangan="Kondisi yang menentukan insight mana yang dikirim"
				ikon={SlidersHorizontal}
				testid="panel-aturan"
			>
				{#snippet aksi()}
					<a href="/watchlist" class="text-diamond-300 flex-none text-[12.5px] hover:underline"
						>Atur</a
					>
				{/snippet}
				<PanelAturan emiten={data.watchlist} />
			</Panel>

			<DisclaimerBar />
		</aside>
	</div>
</div>

<style>
	.lonceng {
		display: inline-grid;
		transform-origin: 50% 10%;
	}

	.lonceng.bunyi {
		animation: goyang 0.8s ease;
	}

	@keyframes goyang {
		20% {
			transform: rotate(-16deg);
		}
		40% {
			transform: rotate(13deg);
		}
		60% {
			transform: rotate(-8deg);
		}
		80% {
			transform: rotate(4deg);
		}
	}

	.pil-langsung {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 7px 12px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.pil-langsung.hidup {
		color: var(--color-tier-low);
		border-color: color-mix(in srgb, var(--color-tier-low) 30%, transparent);
	}

	.denyut,
	.titik-langsung {
		width: 7px;
		height: 7px;
		flex: none;
		border-radius: 999px;
		background: var(--color-muted);
	}

	.hidup .denyut,
	.titik-langsung.hidup {
		background: var(--color-tier-low);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		0% {
			box-shadow: 0 0 0 0 rgba(62, 224, 184, 0.55);
		}
		70%,
		100% {
			box-shadow: 0 0 0 7px rgba(62, 224, 184, 0);
		}
	}

	.tile {
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		padding: 16px 18px;
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	@media (hover: hover) {
		.tile:hover {
			transform: translateY(-2px);
			border-color: rgba(180, 205, 255, 0.22);
		}
	}

	.tanda-kritis {
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--color-tier-critical);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-tier-critical) 22%, transparent);
	}

	.kotak {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 2px;
	}

	.kotak-masuk {
		min-width: 0;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
	}

	.tab-bar {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		border-radius: 12px;
		background: var(--color-void);
		padding: 4px;
		scrollbar-width: none;
	}

	@media (max-width: 639px) {
		.tab-bar {
			mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
		}
	}

	.tab {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 8px;
		border-radius: 9px;
		padding: 7px 12px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-secondary);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	.tab .jumlah {
		font-size: 11px;
		color: var(--color-muted);
	}

	.tab.aktif {
		background: rgba(74, 158, 255, 0.14);
		color: var(--color-diamond-100);
	}

	.tab.aktif .jumlah {
		color: var(--color-diamond-300);
	}

	@media (hover: hover) {
		.tab:not(.aktif):hover {
			color: var(--color-ink);
		}
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 4px 10px;
		font-size: 12.5px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.chip.aktif {
		border-color: var(--color-diamond-500);
		background: rgba(74, 158, 255, 0.1);
		color: var(--color-ink);
	}

	@media (hover: hover) {
		.chip:not(.aktif):hover {
			border-color: var(--edge-strong);
			color: var(--color-ink);
		}
	}

	.pilih {
		border: 1px solid var(--edge);
		border-radius: 10px;
		background: var(--color-void);
		padding: 6px 10px;
		font-family: var(--font-mono);
		font-size: 12.5px;
		color: var(--color-ink);
	}

	.langsung {
		margin: 14px 16px 0;
		border: 1px dashed rgba(143, 208, 255, 0.22);
		border-radius: 14px;
		background:
			radial-gradient(420px 120px at 0% 0%, rgba(74, 158, 255, 0.08), transparent 70%),
			var(--color-void);
		padding: 12px 14px;
	}

	.kartu-live {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 12px;
		background: var(--color-raised);
		padding: 10px 12px;
		box-shadow: 0 18px 36px -24px rgba(74, 158, 255, 0.7);
	}

	.emblem-live {
		display: grid;
		width: 38px;
		height: 38px;
		flex: none;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 10px;
		font-size: 10.5px;
		font-weight: 600;
		color: var(--color-diamond-100);
	}

	.kepala-grup {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #7b8ca8;
	}

	.kosong {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 48px 20px;
		text-align: center;
	}

	.lingkar-kosong {
		display: grid;
		width: 48px;
		height: 48px;
		margin-bottom: 6px;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 999px;
		box-shadow: 0 0 0 6px rgba(74, 158, 255, 0.07);
	}

	@media (min-width: 640px) {
		.langsung {
			margin: 14px 20px 0;
		}
	}
</style>
