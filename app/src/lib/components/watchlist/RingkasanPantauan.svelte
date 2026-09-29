<script lang="ts">
	import { tierDariSkor, type Tier } from '$lib/skor';
	import { waktuRelatif } from '$lib/insight';
	import { hitungMundur, jamCek, type Baris, type Jadwal } from '$lib/watchlist';

	let { baris, jadwal, sekarang }: { baris: Baris[]; jadwal: Jadwal; sekarang: number } = $props();

	const TIER: Tier[] = ['critical', 'high', 'moderate', 'low'];

	const bergerak = $derived(baris.filter((b) => b.ubah !== null));
	const naik = $derived(bergerak.filter((b) => (b.ubah ?? 0) > 0).length);
	const turun = $derived(bergerak.filter((b) => (b.ubah ?? 0) < 0).length);
	const tetap = $derived(bergerak.length - naik - turun);

	const sebaran = $derived(
		TIER.map((tier) => ({
			tier,
			info: tierDariSkor({ critical: 90, high: 70, moderate: 45, low: 10 }[tier]),
			jumlah: baris.filter((b) => b.skor !== null && tierDariSkor(b.skor).tier === tier).length
		}))
	);
	const belumDipindai = $derived(baris.filter((b) => b.skor === null).length);
	const tertinggi = $derived(
		baris.reduce<Baris | null>(
			(maks, b) => (b.skor !== null && (maks === null || b.skor > (maks.skor ?? 0)) ? b : maks),
			null
		)
	);
</script>

<section data-testid="ringkasan-watchlist" class="strip" aria-label="Ringkasan watchlist">
	<div class="sel">
		<h2 class="label">Pergerakan terakhir</h2>
		{#if bergerak.length}
			<p class="tw-data mt-1.5 flex flex-wrap gap-x-3 text-[14px]">
				<span class="text-naik">▲ {naik} naik</span>
				<span class="text-turun">▼ {turun} turun</span>
				{#if tetap}<span class="text-muted">■ {tetap} tetap</span>{/if}
			</p>
			<div
				class="bar-tumpuk mt-2.5"
				role="img"
				aria-label="{naik} saham naik, {turun} turun, {tetap} tetap"
			>
				{#if naik}<span style="flex:{naik}" class="bg-naik"></span>{/if}
				{#if tetap}<span style="flex:{tetap}" class="bg-line"></span>{/if}
				{#if turun}<span style="flex:{turun}" class="bg-turun"></span>{/if}
			</div>
		{:else}
			<p class="text-secondary mt-1.5 text-[13px]">Menunggu harga penutupan dari Sectors.</p>
		{/if}
	</div>

	<div class="sel">
		<h2 class="label">Risiko tertinggi</h2>
		{#if tertinggi && tertinggi.skor !== null}
			{@const info = tierDariSkor(tertinggi.skor)}
			<a
				href="?emiten={tertinggi.item.ticker}"
				data-sveltekit-noscroll
				class="mt-1 flex items-baseline gap-2"
			>
				<span class="tw-data text-[22px] leading-tight font-semibold {info.text}"
					>{Math.round(tertinggi.skor)}</span
				>
				<span class="tw-data text-ink text-[14px] font-semibold">{tertinggi.item.ticker}</span>
				<span class="text-[12.5px] {info.text}">{info.label}</span>
			</a>
		{:else}
			<p class="text-secondary mt-1.5 text-[13px]">Belum ada saham yang selesai dipindai.</p>
		{/if}
		<div class="bar-tumpuk mt-2" role="img" aria-label="Sebaran tingkat risiko watchlist">
			{#each sebaran as satu (satu.tier)}
				{#if satu.jumlah}
					<span style="flex:{satu.jumlah}; background:{satu.info.color}"></span>
				{/if}
			{/each}
			{#if belumDipindai}
				<span style="flex:{belumDipindai}" class="bg-line"></span>
			{/if}
		</div>
		<p class="catatan">
			{sebaran
				.filter((satu) => satu.jumlah)
				.map((satu) => `${satu.jumlah} ${satu.info.label.toLowerCase()}`)
				.join(', ')}{belumDipindai
				? `${sebaran.some((satu) => satu.jumlah) ? ', ' : ''}${belumDipindai} belum dipindai`
				: ''}
		</p>
	</div>

	<div class="sel">
		<h2 class="label">Pemindaian berikutnya</h2>
		{#if jadwal.next_scan_at}
			<p class="mt-1 flex items-baseline gap-2">
				<span class="denyut" aria-hidden="true"></span>
				<span data-testid="scan-berikutnya" class="tw-data text-ink text-[18px] font-medium"
					>{jamCek(jadwal.next_scan_at)}</span
				>
				<span class="text-muted text-[12px]">WIB</span>
			</p>
			<p class="catatan">
				{hitungMundur(jadwal.next_scan_at, sekarang)}, terakhir {jadwal.last_scan_at
					? waktuRelatif(jadwal.last_scan_at)
					: 'belum pernah'}
			</p>
		{:else}
			<p class="text-secondary mt-1.5 text-[13px]">Jadwal pemindaian belum tersedia.</p>
		{/if}
	</div>
</section>

<style>
	.strip {
		display: flex;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
	}

	.sel {
		flex: 0 0 80%;
		scroll-snap-align: start;
		padding: 14px 18px;
	}

	.sel + .sel {
		border-left: 1px solid var(--edge-soft);
	}

	@media (min-width: 640px) {
		.strip {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			overflow: visible;
		}
	}

	@media (min-width: 1024px) {
		.strip {
			grid-template-columns: minmax(0, 1fr);
		}

		.sel + .sel {
			border-top: 1px solid var(--edge-soft);
			border-left: 0;
		}
	}

	.label {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-muted);
	}

	.catatan {
		margin-top: 6px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.bar-tumpuk {
		display: flex;
		height: 6px;
		gap: 2px;
		overflow: hidden;
		border-radius: 999px;
	}

	.bar-tumpuk span {
		min-width: 6px;
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
