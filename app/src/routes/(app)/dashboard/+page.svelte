<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowRight,
		Bell,
		CalendarClock,
		ChartPie,
		ExternalLink,
		Factory,
		Gem,
		ListChecks,
		MailWarning,
		Newspaper,
		Radar,
		Radio,
		Scale,
		ShieldAlert,
		UserMinus,
		X
	} from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import GrafikHarga from '$lib/components/Chart/GrafikHarga.svelte';
	import InsightCard from '$lib/components/InsightCard.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Panel from '$lib/components/dashboard/Panel.svelte';
	import PetaRisiko from '$lib/components/dashboard/PetaRisiko.svelte';
	import PitaWatchlist from '$lib/components/dashboard/PitaWatchlist.svelte';
	import SorotanEmiten from '$lib/components/dashboard/SorotanEmiten.svelte';
	import StatusBursa from '$lib/components/dashboard/StatusBursa.svelte';
	import TabelWatchlist from '$lib/components/dashboard/TabelWatchlist.svelte';
	import TambahEmiten from '$lib/components/dashboard/TambahEmiten.svelte';
	import type { RingkasanInsight } from '$lib/api/notifications';
	import {
		agendaEmiten,
		aktivitasOrangDalam,
		insightPerHari,
		komoditasTerpantau,
		sebaranSektor,
		susunBaris,
		valuasiSektor
	} from '$lib/dashboard';
	import {
		formatAngka,
		formatRingkas,
		labelKomoditas,
		labelTransaksi,
		satuanAwam,
		selisihHari,
		waktuRelatif
	} from '$lib/insight';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';
	import { gerakDikurangi } from '$lib/terlihat';

	let { data } = $props();

	const sekarang = new Date();
	const MAKS_WATCHLIST = 50;

	const baris = $derived(susunBaris(data.items, data.insights, data.quotes));
	const dinilai = $derived(baris.filter((satu) => satu.skor !== null));
	const tertinggi = $derived(dinilai.toSorted((a, b) => (b.skor ?? 0) - (a.skor ?? 0))[0]);
	const perhatian = $derived(dinilai.filter((satu) => (satu.skor ?? 0) >= 61));
	const kritis = $derived(dinilai.filter((satu) => (satu.skor ?? 0) >= 86).length);
	const rataRata = $derived(
		dinilai.length
			? dinilai.reduce((total, satu) => total + (satu.skor ?? 0), 0) / dinilai.length
			: null
	);
	const perHari = $derived(insightPerHari(data.insights, sekarang));
	const puncakHarian = $derived(Math.max(1, ...perHari));
	const insightMingguIni = $derived(perHari.reduce((total, jumlah) => total + jumlah, 0));
	const belumDibaca = $derived(data.notifications.filter((item) => item.read_at === null));
	const emailTerverifikasi = $derived(Boolean(data.user?.email_verified_at));

	let pilihanManual = $state<string | null>(null);
	const pilihan = $derived(
		baris.find((satu) => satu.ticker === pilihanManual)?.ticker ??
			tertinggi?.ticker ??
			baris[0]?.ticker ??
			null
	);
	const sorotan = $derived(baris.find((satu) => satu.ticker === pilihan) ?? null);

	const jenis = $derived(page.url.searchParams.get('type') ?? '');
	const feed = $derived(
		jenis ? data.insights.filter((item) => item.insight_type === jenis) : data.insights
	);
	let feedLengkap = $state(false);

	const orangDalam = $derived(aktivitasOrangDalam(baris));
	const agenda = $derived(agendaEmiten(baris, sekarang));
	const valuasi = $derived(valuasiSektor(baris));
	const komoditas = $derived(komoditasTerpantau(baris));
	const sektor = $derived(sebaranSektor(baris));
	const sektorDikenal = $derived(sektor.some((item) => item.nama !== 'Belum diketahui'));
	const notifikasiTerbaru = $derived(
		data.notifications.toSorted((a, b) => b.sent_at.localeCompare(a.sent_at)).slice(0, 5)
	);

	const saringan = [
		{ nilai: '', label: 'Semua' },
		{ nilai: 'red_flag', label: 'Risiko' },
		{ nilai: 'market_intelligence', label: 'Analisis pasar' }
	];

	function jamLokal(zona: string) {
		try {
			return Number(
				new Intl.DateTimeFormat('en-US', {
					hour: 'numeric',
					hourCycle: 'h23',
					timeZone: zona
				}).format(sekarang)
			);
		} catch {
			return (sekarang.getUTCHours() + 7) % 24;
		}
	}

	const sapaan = $derived.by(() => {
		const jam = jamLokal(data.user?.timezone || 'Asia/Jakarta');
		if (jam < 11) return 'Selamat pagi';
		if (jam < 15) return 'Selamat siang';
		if (jam < 19) return 'Selamat sore';
		return 'Selamat malam';
	});

	const kalimat = $derived.by(() => {
		if (baris.length === 0) {
			return 'Watchlist kamu masih kosong. Tambahkan emiten pertama supaya TripWire mulai berjaga.';
		}
		if (!tertinggi) {
			return `${baris.length} emiten dipantau. Skor pertama muncul setelah pemindaian terjadwal berikutnya.`;
		}
		const puncak = `${tertinggi.ticker} ${bulatkanSkor(tertinggi.skor)}, ${tierDariSkor(tertinggi.skor).label}`;
		if (perhatian.length === 0) {
			return `Tidak ada emiten berskor Tinggi atau Kritis. Skor tertinggi saat ini ${puncak}.`;
		}
		return `${perhatian.length} dari ${baris.length} emiten butuh perhatian. Skor tertinggi saat ini ${puncak}.`;
	});

	function pilih(ticker: string) {
		pilihanManual = ticker;
		const panel = document.getElementById('sorotan');
		if (panel && matchMedia('(max-width: 1023px)').matches) {
			panel.scrollIntoView({ behavior: gerakDikurangi() ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function judulNotifikasi(jenisInsight?: string, subtype?: string, skor?: number | null) {
		if (jenisInsight === 'red_flag')
			return `Risiko tata kelola ${tierDariSkor(skor).label.toLowerCase()}`;
		if (subtype === 'mining_deep_dive') return 'Analisis tambang diperbarui';
		return 'Perbandingan sektor diperbarui';
	}

	const tglPendek = (iso: string) =>
		new Date(iso).toLocaleDateString('id-ID', {
			day: '2-digit',
			month: 'short',
			timeZone: 'Asia/Jakarta'
		});

	function jarakHari(iso: string) {
		const hari = selisihHari(iso, sekarang);
		if (hari === 0) return 'hari ini';
		return hari > 0 ? `${hari} hari lagi` : `${Math.abs(hari)} hari lalu`;
	}

	const warnaTransaksi = (jenisTransaksi: string) =>
		jenisTransaksi === 'sell'
			? 'bg-tier-high'
			: jenisTransaksi === 'buy'
				? 'bg-tier-low'
				: 'bg-secondary';

	let kabar = $state<RingkasanInsight | null>(null);
	let dikenal: string | null = null;
	let tundaKabar: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		dikenal = presenceStore.insightBaru[0]?.notification_id ?? null;
		presenceStore.sambung();
		return () => {
			presenceStore.putus();
			clearTimeout(tundaKabar);
		};
	});

	$effect(() => {
		const terbaru = presenceStore.insightBaru[0];
		if (!terbaru || terbaru.notification_id === dikenal) return;
		dikenal = terbaru.notification_id;
		kabar = terbaru;
		clearTimeout(tundaKabar);
		tundaKabar = setTimeout(() => (kabar = null), 9000);
		invalidateAll();
	});
</script>

{#snippet panelNotifikasi()}
	<Panel
		judul="Notifikasi"
		keterangan="{belumDibaca.length} belum dibaca"
		ikon={Bell}
		testid="panel-notifikasi"
	>
		{#snippet aksi()}
			<a
				href="/notifications"
				class="text-diamond-300 hover:text-diamond-100 text-[12.5px] font-medium transition"
			>
				Semua
			</a>
		{/snippet}
		{#if notifikasiTerbaru.length === 0}
			<p class="text-muted text-[13px]">
				Belum ada notifikasi. Kabar masuk di sini begitu skor melewati batas.
			</p>
		{:else}
			<ul class="-mx-2 space-y-0.5">
				{#each notifikasiTerbaru as item (item.id)}
					<li>
						<a
							href="/insights/{item.insight_event_id}"
							class="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.035]"
						>
							<span
								class="size-1.5 flex-none rounded-full {item.read_at === null
									? 'bg-diamond-500'
									: 'bg-transparent'}"
								aria-label={item.read_at === null ? 'Belum dibaca' : undefined}
							></span>
							<span class="tw-data text-ink w-11 flex-none text-[12.5px] font-semibold"
								>{item.ticker}</span
							>
							<span class="text-secondary min-w-0 flex-1 truncate text-[13px]">
								{judulNotifikasi(item.insight_type, item.subtype, item.score)}
							</span>
							<span class="tw-data text-muted flex-none text-[11px]"
								>{waktuRelatif(item.sent_at)}</span
							>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Panel>
{/snippet}

<svelte:head>
	<title>Dashboard TripWire</title>
</svelte:head>

<section class="space-y-5">
	<header class="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
		<div class="space-y-2">
			<p class="tw-overline flex items-center gap-2">
				{sapaan}
				<span
					data-testid="status-live"
					data-terhubung={presenceStore.terhubung}
					class="inline-flex items-center gap-1.5 tracking-normal normal-case {presenceStore.terhubung
						? 'text-tier-low'
						: 'text-muted'}"
				>
					<Radio class="size-3.5" aria-hidden="true" />
					{presenceStore.terhubung ? 'Langsung' : 'Menyambungkan'}
				</span>
			</p>
			<h1 data-testid="dashboard-heading" class="tw-title text-ink">{data.user?.full_name}</h1>
			<p
				data-testid="kalimat-ringkas"
				class="text-secondary max-w-2xl text-[14.5px] leading-relaxed"
			>
				{kalimat}
			</p>
		</div>
		<StatusBursa />
	</header>

	{#if baris.length}
		<PitaWatchlist {baris} />
	{/if}

	{#if !emailTerverifikasi}
		<div
			data-testid="email-belum-verifikasi"
			class="rounded-glass border-diamond-700 bg-diamond-900/40 flex items-start gap-3 border px-4 py-3.5"
		>
			<MailWarning class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
			<p class="text-secondary text-[13.5px]">
				Email kamu belum diverifikasi. Cek kotak masuk untuk mengaktifkan notifikasi insight.
			</p>
		</div>
	{/if}

	<dl data-testid="ringkasan" class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
		<div class="kpi">
			<dt class="label-kpi">Emiten dipantau</dt>
			<dd class="nilai-kpi">
				{baris.length}<span class="text-muted ml-1.5 text-[13px]">/ {MAKS_WATCHLIST}</span>
			</dd>
			<dd class="sub-kpi">{data.summary.kondisi_aktif} kondisi pemicu aktif</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">Skor rata rata</dt>
			<dd class="nilai-kpi flex items-baseline gap-2">
				{rataRata === null ? '-' : bulatkanSkor(rataRata)}
				{#if rataRata !== null}
					<span class="text-[12px] font-medium {tierDariSkor(rataRata).text}">
						{tierDariSkor(rataRata).label}
					</span>
				{/if}
			</dd>
			<dd class="skala" aria-hidden="true">
				<span class="bg-tier-low"></span>
				<span class="bg-tier-moderate"></span>
				<span class="bg-tier-high"></span>
				<span class="bg-tier-critical"></span>
				{#if rataRata !== null}
					<span class="jarum" style="left:{rataRata}%"></span>
				{/if}
			</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">Butuh perhatian</dt>
			<dd class="nilai-kpi {kritis ? 'text-tier-critical' : ''}">{perhatian.length}</dd>
			<dd class="sub-kpi">{kritis} kritis, {perhatian.length - kritis} tinggi</dd>
		</div>

		<div class="kpi">
			<dt class="label-kpi">Insight 7 hari</dt>
			<dd class="flex items-end justify-between gap-3">
				<span class="nilai-kpi">{insightMingguIni}</span>
				<span class="batang" aria-hidden="true">
					{#each perHari as jumlah, urutan (urutan)}
						<span
							class={urutan === perHari.length - 1 ? 'bg-diamond-500' : 'bg-secondary/35'}
							style="height:{Math.max(8, (jumlah / puncakHarian) * 100)}%"
						></span>
					{/each}
				</span>
			</dd>
			<dd class="sub-kpi">{perHari.at(-1)} insight hari ini</dd>
		</div>

		<div class="kpi col-span-2 md:col-span-1">
			<dt class="label-kpi">Belum dibaca</dt>
			<dd class="nilai-kpi">{belumDibaca.length}</dd>
			<dd class="sub-kpi">
				<a
					href="/notifications"
					class="text-diamond-300 hover:text-diamond-100 inline-flex items-center gap-1 transition"
				>
					Buka notifikasi
					<ArrowRight class="size-3" aria-hidden="true" />
				</a>
			</dd>
		</div>
	</dl>

	{#if baris.length === 0}
		<section
			data-testid="mulai"
			class="mulai rounded-glass-lg relative isolate overflow-hidden border px-5 py-8 sm:px-8"
		>
			<div class="max-w-2xl space-y-3">
				<h2 class="tw-heading text-ink">Mulai dari satu emiten</h2>
				<p class="text-secondary text-[14.5px] leading-relaxed">
					Cari kode emiten IDX lalu tekan Pantau. Setelah itu atur jadwal pengecekan di halaman
					Watchlist, dan TripWire akan menghitung Red Flag Score serta mengabari kamu begitu skornya
					melewati batas.
				</p>
			</div>
			<div class="mt-5 max-w-xl">
				<TambahEmiten besar />
			</div>
			<ol class="text-secondary mt-6 grid gap-3 text-[13px] sm:grid-cols-3">
				{#each ['Tambahkan emiten ke watchlist', 'Atur kondisi pemicu di Watchlist', 'Terima notifikasi saat skor naik'] as langkah, urutan (langkah)}
					<li class="flex items-center gap-2.5">
						<span class="nomor">{urutan + 1}</span>
						{langkah}
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<div class="grid items-start gap-5 lg:grid-cols-12">
			<div class="contents lg:col-span-8 lg:block lg:min-w-0 lg:space-y-5">
				<Panel
					judul="Watchlist"
					keterangan="{baris.length} emiten, harga penutupan terakhir dari Sectors"
					ikon={ListChecks}
					testid="panel-watchlist"
				>
					{#snippet aksi()}
						<div class="w-full sm:w-auto sm:min-w-72">
							<TambahEmiten />
						</div>
					{/snippet}
					<TabelWatchlist {baris} {pilihan} onpilih={pilih} />
				</Panel>
				<div class="order-2 grid items-start gap-5 md:grid-cols-2 lg:order-none">
					<Panel
						judul="Peta risiko"
						keterangan="Sebaran Red Flag Score di watchlist"
						ikon={ShieldAlert}
					>
						<PetaRisiko {baris} {pilihan} onpilih={pilih} />
					</Panel>
					{@render panelNotifikasi()}
				</div>
			</div>

			<div
				id="sorotan"
				class="order-1 min-w-0 scroll-mt-24 lg:sticky lg:top-20 lg:order-none lg:col-span-4"
			>
				<Panel
					judul="Sorotan emiten"
					keterangan="Pilih baris di watchlist untuk berganti emiten"
					ikon={Radar}
				>
					{#if sorotan}
						{#key sorotan.ticker}
							<SorotanEmiten baris={sorotan} />
						{/key}
					{/if}
				</Panel>
			</div>
		</div>
	{/if}

	<div class="grid items-start gap-5 lg:grid-cols-12">
		<Panel
			judul="Insight terbaru"
			keterangan="Dari seluruh watchlist, bersegel digital"
			ikon={Newspaper}
			class={orangDalam.length || agenda.length || baris.length === 0
				? 'lg:col-span-7'
				: 'lg:col-span-12'}
		>
			{#snippet aksi()}
				<nav class="flex gap-1" aria-label="Saring insight">
					{#each saringan as item (item.nilai)}
						<a
							href={item.nilai ? `/dashboard?type=${item.nilai}` : '/dashboard'}
							data-testid="saring-{item.nilai || 'semua'}"
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							aria-current={jenis === item.nilai ? 'page' : undefined}
							class="rounded-glass-sm px-2.5 py-1.5 text-[12.5px] font-medium transition {jenis ===
							item.nilai
								? 'bg-diamond-500/12 text-diamond-100'
								: 'text-secondary hover:text-ink'}"
						>
							{item.label}
						</a>
					{/each}
				</nav>
			{/snippet}

			{#if feed.length === 0}
				<div
					class="flex items-start gap-3 rounded-xl border border-dashed border-white/10 px-4 py-5"
				>
					<Radar class="text-muted mt-0.5 size-4 flex-none" aria-hidden="true" />
					<p data-testid="feed-kosong" class="tw-caption">
						{#if baris.length === 0}
							Belum ada insight. Tambahkan emiten ke watchlist dulu, lalu kondisi pemicunya.
						{:else}
							Belum ada insight untuk saringan ini. Insight muncul setelah pemindaian terjadwal
							berikutnya.
						{/if}
					</p>
				</div>
			{:else}
				<ul data-testid="feed-insight" class="-mx-3 -my-1 divide-y divide-white/5">
					{#each feedLengkap ? feed : feed.slice(0, 8) as insight (insight.id)}
						<li><InsightCard {insight} /></li>
					{/each}
				</ul>
				{#if feed.length > 8}
					<button
						type="button"
						onclick={() => (feedLengkap = !feedLengkap)}
						class="text-diamond-300 hover:text-diamond-100 mt-3 text-[13px] font-medium transition"
					>
						{feedLengkap ? 'Tampilkan lebih sedikit' : `Tampilkan semua ${feed.length} insight`}
					</button>
				{/if}
			{/if}
		</Panel>

		{#if orangDalam.length || agenda.length || baris.length === 0}
			<div class="min-w-0 space-y-5 lg:col-span-5">
				{#if baris.length === 0}
					{@render panelNotifikasi()}
				{/if}
				{#if orangDalam.length}
					<Panel
						judul="Aktivitas orang dalam"
						keterangan="Transaksi direksi, komisaris, dan pemegang saham besar dari laporan KSEI"
						ikon={UserMinus}
						testid="panel-orang-dalam"
					>
						<ul class="divide-y divide-white/5">
							{#each orangDalam as item, urutan (urutan)}
								<li class="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
									<span class="tw-data text-muted text-[11.5px]">{tglPendek(item.tanggal)}</span>
									<span class="min-w-0">
										<span class="flex items-baseline gap-2">
											<span class="tw-data text-ink text-[12.5px] font-semibold">{item.ticker}</span
											>
											<span class="text-secondary truncate text-[13px]">{item.nama}</span>
										</span>
										<span class="text-muted mt-0.5 flex items-center gap-1.5 text-[11.5px]">
											<span class="size-1.5 rounded-full {warnaTransaksi(item.jenis)}"></span>
											{labelTransaksi(item.jenis)}
											{#if item.sebelum !== undefined && item.sesudah !== undefined}
												<span class="tw-data"
													>{formatAngka(item.sebelum)}% ke {formatAngka(item.sesudah)}%</span
												>
											{/if}
										</span>
									</span>
									<span class="flex items-center gap-2">
										<span class="tw-data text-ink text-[12.5px]">
											{item.nilai > 0 ? `Rp${formatRingkas(item.nilai)}` : '-'}
										</span>
										{#if item.sumber}
											<a
												href={item.sumber}
												target="_blank"
												rel="noopener noreferrer"
												aria-label="Dokumen sumber transaksi {item.nama}"
												class="text-muted hover:text-diamond-300 transition"
											>
												<ExternalLink class="size-3.5" aria-hidden="true" />
											</a>
										{/if}
									</span>
								</li>
							{/each}
						</ul>
					</Panel>
				{/if}
				{#if agenda.length}
					<Panel
						judul="Kalender emiten"
						keterangan="Izin tambang, suspensi, dan perubahan kepemilikan"
						ikon={CalendarClock}
						testid="panel-agenda"
					>
						<ul class="space-y-2.5">
							{#each agenda as item, urutan (urutan)}
								{@const tanggal = new Date(item.tanggal)}
								<li class="flex items-start gap-3">
									<span class="tanggal" class:datang={item.akanDatang}>
										<span class="tw-data text-[15px] leading-none">
											{tanggal.toLocaleDateString('id-ID', {
												day: '2-digit',
												timeZone: 'Asia/Jakarta'
											})}
										</span>
										<span class="text-[10px] uppercase">
											{tanggal.toLocaleDateString('id-ID', {
												month: 'short',
												timeZone: 'Asia/Jakarta'
											})}
										</span>
									</span>
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2">
											{#if item.jenis === 'lisensi'}
												<Gem class="text-tier-moderate size-3.5 flex-none" aria-hidden="true" />
											{:else if item.jenis === 'suspensi'}
												<ShieldAlert class="text-secondary size-3.5 flex-none" aria-hidden="true" />
											{:else}
												<ChartPie class="text-secondary size-3.5 flex-none" aria-hidden="true" />
											{/if}
											<span class="tw-data text-ink text-[12.5px] font-semibold">{item.ticker}</span
											>
											<span class="text-ink truncate text-[13px]">{item.judul}</span>
										</span>
										<span class="text-muted mt-0.5 line-clamp-2 block text-[12px] leading-snug">
											{jarakHari(item.tanggal)}{item.detail ? `, ${item.detail}` : ''}
										</span>
									</span>
								</li>
							{/each}
						</ul>
					</Panel>
				{/if}
			</div>
		{/if}
	</div>

	{#if valuasi.length || komoditas.length || sektorDikenal}
		<div class="grid items-start gap-5 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
			{#if valuasi.length}
				<Panel
					judul="Valuasi dibanding sektor"
					keterangan="Selisih terhadap rata rata subsektor"
					ikon={Scale}
					testid="panel-valuasi"
				>
					<table class="w-full text-left">
						<thead>
							<tr class="tw-overline">
								<th class="pb-2 font-medium">Emiten</th>
								<th class="pb-2 text-right font-medium">PER</th>
								<th class="pb-2 text-right font-medium">PBV</th>
								<th class="pb-2 text-right font-medium">PSR</th>
							</tr>
						</thead>
						<tbody>
							{#each valuasi as item (item.ticker)}
								<tr class="border-t border-white/5">
									<td class="py-2.5">
										<span class="tw-data text-ink block text-[12.5px] font-semibold"
											>{item.ticker}</span
										>
										<span class="text-muted block max-w-32 truncate text-[11px]"
											>{item.subSektor}</span
										>
									</td>
									{#each ['pe', 'pb', 'ps'] as kunci (kunci)}
										{@const metrik = item.metrik[kunci]}
										<td class="py-2.5 text-right">
											{#if metrik}
												<span class="tw-data text-ink block text-[12.5px]"
													>{formatAngka(metrik.value, 1)}x</span
												>
												<span class="tw-data text-muted block text-[11px]">
													{metrik.difference_pct === null
														? `sektor ${formatAngka(metrik.sector_average, 1)}x`
														: `${metrik.difference_pct > 0 ? '▲' : '▼'} ${formatAngka(Math.abs(metrik.difference_pct), 0)}%`}
												</span>
											{:else}
												<span class="text-muted text-[12px]">-</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
					<p class="text-muted mt-3 text-[11.5px] leading-snug">
						Di atas atau di bawah rata rata bukan penilaian baik buruk, hanya konteks.
					</p>
				</Panel>
			{/if}

			{#if komoditas.length}
				<Panel
					judul="Harga komoditas"
					keterangan="Komoditas yang memengaruhi emiten tambangmu"
					ikon={Factory}
					testid="panel-komoditas"
				>
					<ul class="space-y-5">
						{#each komoditas as item (item.commodity)}
							<li>
								<div class="flex items-baseline justify-between gap-3">
									<span class="text-ink text-[14px] font-medium"
										>{labelKomoditas(item.commodity)}</span
									>
									<span class="tw-data text-muted text-[11px]">{item.tickers.join(', ')}</span>
								</div>
								<p class="mt-1 flex flex-wrap items-baseline gap-x-2">
									<span class="tw-data text-ink text-[17px]">{formatAngka(item.latest)}</span>
									<span class="text-muted text-[11.5px]">{satuanAwam(item.unit)}</span>
									{#if item.yoy_pct !== null}
										<span class="tw-data text-secondary text-[12px]">
											{item.yoy_pct >= 0 ? '▲' : '▼'}
											{formatAngka(Math.abs(item.yoy_pct), 1)}% setahun
										</span>
									{/if}
								</p>
								<div class="mt-2">
									<GrafikHarga seri={item.series} />
								</div>
							</li>
						{/each}
					</ul>
				</Panel>
			{/if}

			{#if sektorDikenal}
				<Panel
					judul="Sebaran sektor"
					keterangan="Komposisi watchlist per sektor"
					ikon={ChartPie}
					testid="panel-sektor"
				>
					<ul class="space-y-3">
						{#each sektor as item (item.nama)}
							<li>
								<div class="flex items-baseline justify-between gap-3 text-[13px]">
									<span class="text-secondary truncate">{item.nama}</span>
									<span class="tw-data text-ink">{item.tickers.length}</span>
								</div>
								<div class="mt-1.5 flex items-center gap-2.5">
									<span class="lajur">
										<span class="isi" style="width:{(item.tickers.length / baris.length) * 100}%"
										></span>
									</span>
									<span class="tw-data text-muted w-24 flex-none truncate text-[11px]"
										>{item.tickers.join(', ')}</span
									>
								</div>
							</li>
						{/each}
					</ul>
				</Panel>
			{/if}
		</div>
	{/if}

	<DisclaimerBar />
</section>

{#if kabar}
	<div
		role="status"
		data-testid="kabar-insight"
		class="kabar"
		in:fly={{ y: 24, duration: 320 }}
		out:fly={{ y: 16, duration: 220 }}
	>
		<SkorBadge skor={kabar.score} showLabel={false} />
		<div class="min-w-0 flex-1">
			<p class="text-ink text-[13px] font-semibold">Insight baru, {kabar.ticker}</p>
			<p class="text-secondary truncate text-[12px]">
				{judulNotifikasi(kabar.insight_type, kabar.subtype, kabar.score)}
			</p>
		</div>
		<a
			href="/insights/{kabar.insight_id}"
			class="text-diamond-300 hover:text-diamond-100 text-[12.5px] font-medium">Buka</a
		>
		<button
			type="button"
			onclick={() => (kabar = null)}
			aria-label="Tutup kabar insight"
			class="text-muted hover:text-ink grid size-7 place-items-center rounded-md transition"
		>
			<X class="size-3.5" aria-hidden="true" />
		</button>
	</div>
{/if}

<style>
	.kpi {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		padding: 14px 16px;
	}

	.label-kpi {
		font-size: 12.5px;
		color: var(--color-secondary);
	}

	.nilai-kpi {
		font-family: var(--font-mono);
		font-size: 26px;
		font-weight: 500;
		line-height: 1.1;
		color: var(--color-ink);
	}

	.sub-kpi {
		margin-top: auto;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.skala {
		position: relative;
		display: grid;
		grid-template-columns: 30fr 30fr 25fr 15fr;
		gap: 2px;
		height: 4px;
		margin-top: auto;
	}

	.skala > span:not(.jarum) {
		border-radius: 2px;
		opacity: 0.55;
	}

	.jarum {
		position: absolute;
		top: 50%;
		width: 10px;
		height: 10px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}

	.batang {
		display: flex;
		height: 30px;
		align-items: flex-end;
		gap: 3px;
	}

	.batang span {
		width: 6px;
		border-radius: 2px 2px 0 0;
	}

	.mulai {
		border-color: var(--edge);
		background:
			radial-gradient(640px 260px at 85% 0%, rgba(74, 158, 255, 0.14), transparent 70%),
			var(--color-base);
	}

	.nomor {
		display: inline-grid;
		width: 24px;
		height: 24px;
		flex: none;
		place-items: center;
		border: 1px solid var(--color-diamond-700);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 11.5px;
		color: var(--color-diamond-300);
	}

	.tanggal {
		display: flex;
		width: 44px;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		border: 1px solid var(--edge);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 6px 0 5px;
		color: var(--color-secondary);
	}

	.tanggal.datang {
		border-color: color-mix(in srgb, var(--color-tier-moderate) 40%, transparent);
		color: var(--color-tier-moderate);
	}

	.lajur {
		position: relative;
		height: 6px;
		flex: 1;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.08);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		background: var(--color-diamond-500);
	}

	.kabar {
		position: fixed;
		right: 16px;
		bottom: 84px;
		left: 16px;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid rgba(143, 208, 255, 0.28);
		border-radius: 14px;
		background: rgba(20, 28, 46, 0.97);
		padding: 10px 10px 10px 14px;
		box-shadow: 0 24px 50px -20px rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(12px);
	}

	@media (min-width: 640px) {
		.kabar {
			bottom: 24px;
			left: auto;
			width: 380px;
		}
	}
</style>
