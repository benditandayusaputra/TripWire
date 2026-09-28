<script lang="ts">
	import { Activity, CalendarClock, ChartPie, Radar } from 'lucide-svelte';
	import { tierDariSkor, type Tier } from '$lib/skor';
	import { waktuRelatif } from '$lib/insight';
	import {
		NAMA_KONDISI,
		formatUbah,
		hitungMundur,
		jamCek,
		tanggalPendek,
		type Baris,
		type Jadwal
	} from '$lib/watchlist';

	let { baris, jadwal, sekarang }: { baris: Baris[]; jadwal: Jadwal; sekarang: number } = $props();

	const TIER: Tier[] = ['critical', 'high', 'moderate', 'low'];

	const sebaranRisiko = $derived.by(() => {
		const hitung = TIER.map((tier) => ({
			tier,
			info: tierDariSkor({ critical: 90, high: 70, moderate: 45, low: 10 }[tier]),
			jumlah: baris.filter((b) => b.skor !== null && tierDariSkor(b.skor).tier === tier).length
		}));
		return { hitung, kosong: baris.filter((b) => b.skor === null).length };
	});

	const berskor = $derived(baris.filter((b) => b.skor !== null));
	const tertinggi = $derived(
		berskor.reduce<Baris | null>(
			(maks, b) => (maks && (maks.skor ?? 0) >= (b.skor ?? 0) ? maks : b),
			null
		)
	);
	const rataRata = $derived(
		berskor.length
			? Math.round(berskor.reduce((jumlah, b) => jumlah + (b.skor ?? 0), 0) / berskor.length)
			: null
	);

	const bergerak = $derived(baris.filter((b) => b.ubah !== null));
	const naik = $derived(bergerak.filter((b) => (b.ubah ?? 0) > 0).length);
	const turun = $derived(bergerak.filter((b) => (b.ubah ?? 0) < 0).length);
	const urutUbah = $derived([...bergerak].sort((a, b) => (b.ubah ?? 0) - (a.ubah ?? 0)));
	const tanggalTutup = $derived(
		baris
			.map((b) => b.kutipan?.latest_close_date ?? '')
			.sort()
			.at(-1) ?? ''
	);

	const sektor = $derived.by(() => {
		const peta = new Map<string, number>();
		for (const b of baris) {
			const nama = b.kutipan?.sector || 'Belum ada data';
			peta.set(nama, (peta.get(nama) ?? 0) + 1);
		}
		return [...peta].sort((a, b) => b[1] - a[1]).slice(0, 5);
	});

	const cekBerikut = $derived(
		baris
			.flatMap((b) =>
				b.item.conditions
					.filter((k) => k.is_active && jadwal.conditions[k.id])
					.map((k) => ({
						ticker: b.item.ticker,
						nama: NAMA_KONDISI[k.condition_type],
						waktu: jadwal.conditions[k.id]
					}))
			)
			.sort((a, b) => (a.waktu < b.waktu ? -1 : 1))
			.slice(0, 3)
	);
</script>

<div data-testid="ringkasan-watchlist" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
	<section class="widget" aria-labelledby="w-risiko">
		<h2 id="w-risiko" class="judul-widget">
			<Radar class="size-3.5" aria-hidden="true" />Radar risiko
		</h2>
		{#if tertinggi && tertinggi.skor !== null}
			{@const info = tierDariSkor(tertinggi.skor)}
			<a
				href="?emiten={tertinggi.item.ticker}"
				data-sveltekit-noscroll
				class="mt-3 flex items-baseline gap-2"
			>
				<span class="tw-data text-[26px] leading-none font-semibold {info.text}"
					>{Math.round(tertinggi.skor)}</span
				>
				<span class="text-secondary text-[12.5px]">
					tertinggi, <span class="tw-data text-ink font-semibold">{tertinggi.item.ticker}</span>
					{info.label}
				</span>
			</a>
		{:else}
			<p class="text-secondary mt-3 text-[13px]">Belum ada emiten yang selesai dipindai.</p>
		{/if}
		<div class="bar-tumpuk mt-3" role="img" aria-label="Sebaran tingkat risiko watchlist">
			{#each sebaranRisiko.hitung as satu (satu.tier)}
				{#if satu.jumlah}
					<span style="flex:{satu.jumlah}; background:{satu.info.color}"></span>
				{/if}
			{/each}
			{#if sebaranRisiko.kosong}
				<span style="flex:{sebaranRisiko.kosong}" class="bg-line"></span>
			{/if}
		</div>
		<ul class="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
			{#each sebaranRisiko.hitung as satu (satu.tier)}
				<li class="flex items-center gap-1.5">
					<span class="size-2 rounded-full" style="background:{satu.info.color}"></span>
					<span class="text-secondary">{satu.info.label}</span>
					<span class="tw-data text-ink">{satu.jumlah}</span>
				</li>
			{/each}
			{#if sebaranRisiko.kosong}
				<li class="flex items-center gap-1.5">
					<span class="bg-line size-2 rounded-full"></span>
					<span class="text-secondary">Belum dipindai</span>
					<span class="tw-data text-ink">{sebaranRisiko.kosong}</span>
				</li>
			{/if}
		</ul>
		{#if rataRata !== null}
			<p class="text-muted mt-2 text-[11.5px]">
				Rata rata skor watchlist <span class="tw-data text-secondary">{rataRata}</span>
			</p>
		{/if}
	</section>

	<section class="widget" aria-labelledby="w-gerak">
		<h2 id="w-gerak" class="judul-widget">
			<Activity class="size-3.5" aria-hidden="true" />Pergerakan harga
		</h2>
		{#if bergerak.length}
			<div
				class="bar-tumpuk mt-3"
				role="img"
				aria-label="{naik} naik, {turun} turun, {bergerak.length - naik - turun} tetap"
			>
				{#if naik}<span style="flex:{naik}" class="bg-naik"></span>{/if}
				{#if bergerak.length - naik - turun}<span
						style="flex:{bergerak.length - naik - turun}"
						class="bg-line"
					></span>{/if}
				{#if turun}<span style="flex:{turun}" class="bg-turun"></span>{/if}
			</div>
			<p class="tw-data mt-2 flex gap-3 text-[12px]">
				<span class="text-naik">▲ {naik} naik</span>
				<span class="text-turun">▼ {turun} turun</span>
				<span class="text-muted">■ {bergerak.length - naik - turun} tetap</span>
			</p>
			<ul class="mt-2.5 space-y-1.5">
				{#each [urutUbah[0], urutUbah.length > 1 ? urutUbah.at(-1) : null] as b, urutan (urutan)}
					{#if b}
						{@const ubah = formatUbah(b.ubah)}
						<li>
							<a href="?emiten={b.item.ticker}" data-sveltekit-noscroll class="baris-mini">
								<span class="text-muted w-20 text-[11.5px]"
									>{urutan === 0 ? 'Terkuat' : 'Terlemah'}</span
								>
								<span class="tw-data text-ink flex-1 text-[13px] font-semibold"
									>{b.item.ticker}</span
								>
								<span
									class="tw-data text-[12.5px] {ubah.arah > 0
										? 'text-naik'
										: ubah.arah < 0
											? 'text-turun'
											: 'text-muted'}">{ubah.teks}</span
								>
							</a>
						</li>
					{/if}
				{/each}
			</ul>
			{#if tanggalTutup}
				<p class="text-muted mt-2 text-[11.5px]">
					Penutupan {tanggalPendek(tanggalTutup)}, data Sectors
				</p>
			{/if}
		{:else}
			<p class="text-secondary mt-3 text-[13px]">
				Harga muncul setelah laporan emiten pertama diambil saat pemindaian.
			</p>
		{/if}
	</section>

	<section class="widget" aria-labelledby="w-sektor">
		<h2 id="w-sektor" class="judul-widget">
			<ChartPie class="size-3.5" aria-hidden="true" />Sebaran sektor
		</h2>
		<ul class="mt-3 space-y-2">
			{#each sektor as [nama, jumlah] (nama)}
				<li class="space-y-1">
					<div class="flex items-baseline justify-between gap-2 text-[12px]">
						<span class="text-secondary truncate">{nama}</span>
						<span class="tw-data text-ink">{jumlah}</span>
					</div>
					<span class="lajur"
						><span class="isi bg-diamond-500" style="width:{(jumlah / baris.length) * 100}%"
						></span></span
					>
				</li>
			{/each}
		</ul>
	</section>

	<section class="widget" aria-labelledby="w-jadwal">
		<h2 id="w-jadwal" class="judul-widget">
			<CalendarClock class="size-3.5" aria-hidden="true" />Jadwal jaga
		</h2>
		{#if jadwal.next_scan_at}
			<p class="mt-3 flex items-baseline gap-2">
				<span class="denyut" aria-hidden="true"></span>
				<span data-testid="scan-berikutnya" class="tw-data text-ink text-[17px] font-medium"
					>{jamCek(jadwal.next_scan_at)}</span
				>
				<span class="text-muted text-[12px]">WIB</span>
			</p>
			<p class="text-secondary mt-0.5 text-[12px]">
				Pemindaian berikutnya, {hitungMundur(jadwal.next_scan_at, sekarang)}
			</p>
		{/if}
		<p class="text-muted mt-1 text-[11.5px]">
			Terakhir {jadwal.last_scan_at ? waktuRelatif(jadwal.last_scan_at) : 'belum pernah'}
		</p>
		{#if cekBerikut.length}
			<ul class="border-line mt-2.5 space-y-1 border-t pt-2.5">
				{#each cekBerikut as satu, urutan (urutan)}
					<li class="flex items-baseline gap-2 text-[12px]">
						<span class="tw-data text-ink w-11 font-semibold">{satu.ticker}</span>
						<span class="text-muted min-w-0 flex-1 truncate">{satu.nama}</span>
						<span class="tw-data text-secondary">{jamCek(satu.waktu)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.widget {
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		padding: 16px 18px;
		transition:
			border-color 0.25s ease,
			transform 0.25s ease;
	}

	@media (hover: hover) {
		.widget:hover {
			border-color: rgba(180, 205, 255, 0.24);
			transform: translateY(-2px);
		}
	}

	.judul-widget {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #7b8ca8;
	}

	.bar-tumpuk {
		display: flex;
		height: 8px;
		gap: 2px;
		overflow: hidden;
		border-radius: 999px;
	}

	.bar-tumpuk span {
		min-width: 6px;
	}

	.baris-mini {
		display: flex;
		align-items: baseline;
		gap: 8px;
		border-radius: 8px;
		margin: 0 -6px;
		padding: 3px 6px;
		transition: background 0.2s ease;
	}

	@media (hover: hover) {
		.baris-mini:hover {
			background: rgba(74, 158, 255, 0.07);
		}
	}

	.lajur {
		position: relative;
		display: block;
		height: 5px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.08);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		opacity: 0.8;
	}

	.denyut {
		width: 7px;
		height: 7px;
		align-self: center;
		border-radius: 999px;
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
</style>
