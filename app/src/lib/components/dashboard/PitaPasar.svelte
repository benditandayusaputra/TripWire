<script lang="ts">
	import { t } from '$lib/bahasa.svelte';
	import { formatDesimal, formatPersen, kelasArah, type BarisDashboard } from '$lib/dashboard';
	import type { SeriIndeks } from '$lib/pasar';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';
	import { formatHarga } from '$lib/watchlist';

	let { ihsg, baris }: { ihsg: SeriIndeks | null; baris: BarisDashboard[] } = $props();

	const item = $derived.by(() => {
		const hasil: { kode: string; harga: string; ubah: number | null; skor: number | null }[] = [];
		const [kemarin, terakhir] = ihsg?.series.slice(-2) ?? [];
		if (terakhir) {
			hasil.push({
				kode: 'IHSG',
				harga: formatDesimal(terakhir.price),
				ubah: kemarin ? terakhir.price / kemarin.price - 1 : null,
				skor: null
			});
		}
		for (const satu of baris) {
			if (!satu.penutupan) continue;
			hasil.push({
				kode: satu.ticker,
				harga: formatHarga(satu.penutupan.harga),
				ubah: satu.penutupan.ubah,
				skor: satu.skor
			});
		}
		return hasil;
	});

	const ulang = $derived(
		Array.from({ length: Math.ceil(10 / Math.max(1, item.length)) }, () => item).flat()
	);
</script>

{#if item.length}
	<div class="pita" aria-hidden="true">
		<p class="label-pita">
			<span class="denyut"></span>
			{t('Pasar', 'Market')}
		</p>
		<div class="jendela">
			<div class="jalan" style="animation-duration:{ulang.length * 4.5}s">
				{#each [...ulang, ...ulang] as satu, urutan (urutan)}
					{@const ubah = formatPersen(satu.ubah)}
					<span class="item">
						<span class="tw-data text-ink text-[12.5px] font-semibold">{satu.kode}</span>
						<span class="tw-data text-secondary text-[12.5px]">{satu.harga}</span>
						{#if satu.ubah !== null}
							<span class="tw-data text-[12px] {kelasArah(ubah.arah)}">{ubah.teks}</span>
						{/if}
						{#if satu.skor !== null}
							<span class="skor">
								<span
									class="size-1.5 rounded-full"
									style="background:{tierDariSkor(satu.skor).color}"
								></span>
								<span class="tw-data text-secondary">{bulatkanSkor(satu.skor)}</span>
							</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.pita {
		display: flex;
		align-items: center;
		overflow: hidden;
		border: 1px solid var(--edge);
		border-radius: 16px;
		background: var(--color-base);
	}

	.label-pita {
		z-index: 1;
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		border-right: 1px solid var(--edge-soft);
		padding: 10px 16px;
		font-size: 12px;
		white-space: nowrap;
		color: var(--color-secondary);
	}

	.denyut {
		width: 7px;
		height: 7px;
		border-radius: 999px;
		background: var(--color-diamond-300);
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-diamond-300) 60%, transparent);
		}
		70%,
		100% {
			box-shadow: 0 0 0 7px color-mix(in srgb, var(--color-diamond-300) 0%, transparent);
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
		border-right: 1px solid var(--edge-soft);
		padding: 10px 18px;
	}

	.skor {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11.5px;
	}
</style>
