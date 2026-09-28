<script lang="ts">
	import { arahHarga, type Baris } from '$lib/dashboard';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let {
		baris,
		pilihan,
		onpilih
	}: { baris: Baris[]; pilihan: string | null; onpilih: (ticker: string) => void } = $props();

	const TINGKAT = [
		{ tier: 'critical', label: 'Kritis', warna: 'var(--color-tier-critical)' },
		{ tier: 'high', label: 'Tinggi', warna: 'var(--color-tier-high)' },
		{ tier: 'moderate', label: 'Sedang', warna: 'var(--color-tier-moderate)' },
		{ tier: 'low', label: 'Rendah', warna: 'var(--color-tier-low)' },
		{ tier: 'none', label: 'Belum dinilai', warna: 'rgba(180, 205, 255, 0.22)' }
	];

	const sebaran = $derived(
		TINGKAT.map((tingkat) => ({
			...tingkat,
			jumlah: baris.filter((satu) =>
				tingkat.tier === 'none'
					? satu.skor === null
					: satu.skor !== null && tierDariSkor(satu.skor).tier === tingkat.tier
			).length
		}))
	);

	const petak = $derived(
		[...baris].sort((a, b) => (b.skor ?? -1) - (a.skor ?? -1) || a.ticker.localeCompare(b.ticker))
	);
</script>

<div class="space-y-4">
	<div
		data-testid="sebaran-risiko"
		class="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
		role="img"
		aria-label={sebaran
			.filter((s) => s.jumlah)
			.map((s) => `${s.label} ${s.jumlah}`)
			.join(', ')}
	>
		{#each sebaran.filter((s) => s.jumlah) as satu (satu.tier)}
			<span
				class="h-full first:rounded-l-full last:rounded-r-full"
				style="flex:{satu.jumlah}; background:{satu.warna}"
			></span>
		{/each}
	</div>

	<ul class="flex flex-wrap gap-x-4 gap-y-1.5">
		{#each sebaran as satu (satu.tier)}
			<li
				class="flex items-center gap-1.5 text-[12px] {satu.jumlah
					? 'text-secondary'
					: 'text-muted'}"
			>
				<span class="size-2 rounded-[3px]" style="background:{satu.warna}"></span>
				{satu.label}
				<span class="tw-data text-ink">{satu.jumlah}</span>
			</li>
		{/each}
	</ul>

	<ul class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
		{#each petak as satu (satu.ticker)}
			{@const info = tierDariSkor(satu.skor)}
			{@const ubah = arahHarga(satu.kutipan?.daily_close_change)}
			<li>
				<button
					type="button"
					data-testid="petak-risiko"
					data-ticker={satu.ticker}
					aria-pressed={pilihan === satu.ticker}
					onclick={() => onpilih(satu.ticker)}
					class="petak {satu.skor === null ? 'kosong' : `${info.background} ${info.border}`}"
				>
					<span class="flex flex-wrap items-center justify-between gap-x-2">
						<span class="tw-data text-ink text-[13px] font-semibold">{satu.ticker}</span>
						{#if ubah}
							<span class="tw-data text-[10.5px] whitespace-nowrap {ubah.kelas}">{ubah.teks}</span>
						{/if}
					</span>
					<span class="mt-2 flex items-baseline gap-1.5">
						<span class="tw-data text-ink text-[20px] leading-none font-medium">
							{satu.skor === null ? '-' : bulatkanSkor(satu.skor)}
						</span>
						<span class="text-secondary text-[11px]"
							>{satu.skor === null ? 'belum dinilai' : info.label}</span
						>
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.petak {
		display: flex;
		width: 100%;
		flex-direction: column;
		border: 1px solid;
		border-radius: 12px;
		padding: 10px 11px;
		text-align: left;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.petak.kosong {
		border-color: var(--edge);
		background: rgba(255, 255, 255, 0.02);
	}

	.petak[aria-pressed='true'] {
		box-shadow: 0 0 0 2px var(--color-diamond-500);
	}

	@media (hover: hover) {
		.petak:hover {
			transform: translateY(-2px);
		}
	}
</style>
