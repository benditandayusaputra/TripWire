<script lang="ts">
	import { t } from '$lib/bahasa.svelte';
	import { formatPersen, kelasArah, type BarisDashboard } from '$lib/dashboard';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let {
		baris,
		pilihan,
		onpilih
	}: { baris: BarisDashboard[]; pilihan: string | null; onpilih: (ticker: string) => void } =
		$props();

	const TINGKAT = $derived([
		{ tier: 'critical', label: t('Kritis', 'Critical'), warna: 'var(--color-tier-critical)' },
		{ tier: 'high', label: t('Tinggi', 'High'), warna: 'var(--color-tier-high)' },
		{ tier: 'moderate', label: t('Sedang', 'Moderate'), warna: 'var(--color-tier-moderate)' },
		{ tier: 'low', label: t('Rendah', 'Low'), warna: 'var(--color-tier-low)' },
		{
			tier: 'none',
			label: t('Belum dinilai', 'Not scored'),
			warna: 'color-mix(in srgb, var(--kilau) 22%, transparent)'
		}
	]);

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

	const labelTier = (skor: number | null) =>
		skor === null
			? t('belum dinilai', 'not scored')
			: TINGKAT.find((tingkat) => tingkat.tier === tierDariSkor(skor).tier)?.label;
</script>

<div class="space-y-4">
	<div
		data-testid="sebaran-risiko"
		class="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
		role="img"
		aria-label={sebaran
			.filter((satu) => satu.jumlah)
			.map((satu) => `${satu.label} ${satu.jumlah}`)
			.join(', ')}
	>
		{#each sebaran.filter((satu) => satu.jumlah) as satu (satu.tier)}
			<span class="h-full" style="flex:{satu.jumlah}; background:{satu.warna}"></span>
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
			{@const ubah = formatPersen(satu.penutupan?.ubah)}
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
						{#if satu.penutupan}
							<span class="tw-data text-[10.5px] whitespace-nowrap {kelasArah(ubah.arah)}"
								>{ubah.teks}</span
							>
						{/if}
					</span>
					<span class="mt-2 flex items-baseline gap-1.5">
						<span class="tw-data text-ink text-[20px] leading-none font-medium">
							{satu.skor === null ? '-' : bulatkanSkor(satu.skor)}
						</span>
						<span class="text-secondary text-[11px]">{labelTier(satu.skor)}</span>
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
		background: color-mix(in srgb, var(--kilau) 3%, transparent);
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
