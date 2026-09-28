<script lang="ts">
	import { arahHarga, formatHarga, type Baris } from '$lib/dashboard';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let { baris }: { baris: Baris[] } = $props();

	const ulang = $derived(
		Array.from({ length: Math.ceil(10 / Math.max(1, baris.length)) }, () => baris).flat()
	);
</script>

<div class="pita border-line bg-base/70 rounded-2xl border" aria-hidden="true">
	<p class="label-pita text-secondary text-[12px]">
		<span class="denyut"></span>
		Watchlist
	</p>
	<div class="jendela">
		<div class="jalan" style="animation-duration:{ulang.length * 4.5}s">
			{#each [...ulang, ...ulang] as satu, urutan (urutan)}
				{@const ubah = arahHarga(satu.kutipan?.daily_close_change)}
				<span class="item">
					<span class="tw-data text-ink text-[12.5px] font-semibold">{satu.ticker}</span>
					{#if satu.kutipan}
						<span class="tw-data text-secondary text-[12.5px]"
							>{formatHarga(satu.kutipan.last_close_price)}</span
						>
					{/if}
					{#if ubah}
						<span class="tw-data text-[12px] {ubah.kelas}">{ubah.teks}</span>
					{/if}
					{#if satu.skor !== null}
						<span class="skor">
							<span class="size-1.5 rounded-full" style="background:{tierDariSkor(satu.skor).color}"
							></span>
							<span class="tw-data text-secondary">{bulatkanSkor(satu.skor)}</span>
						</span>
					{/if}
				</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.pita {
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.label-pita {
		z-index: 1;
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-right: 1px solid var(--edge-soft);
		white-space: nowrap;
	}

	.denyut {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-naik);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		0% {
			box-shadow: 0 0 0 0 rgba(31, 175, 122, 0.6);
		}
		70%,
		100% {
			box-shadow: 0 0 0 7px rgba(31, 175, 122, 0);
		}
	}

	.jendela {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
	}

	.jalan {
		display: flex;
		width: max-content;
		animation: jalan linear infinite;
	}

	@media (hover: hover) {
		.pita:hover .jalan {
			animation-play-state: paused;
		}
	}

	@keyframes jalan {
		to {
			transform: translateX(-50%);
		}
	}

	.item {
		display: inline-flex;
		align-items: baseline;
		gap: 8px;
		padding: 10px 18px;
		border-right: 1px solid rgba(180, 205, 255, 0.07);
	}

	.skor {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11.5px;
	}
</style>
