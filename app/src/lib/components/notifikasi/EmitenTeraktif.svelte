<script lang="ts">
	import type { EmitenNotifikasi } from '$lib/api/notifications';
	import { t } from '$lib/bahasa.svelte';
	import { waktuRelatif } from '$lib/insight';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let {
		emiten,
		tautan,
		aktif = ''
	}: {
		emiten: EmitenNotifikasi[];
		tautan: (ticker: string | null) => string;
		aktif?: string;
	} = $props();

	const W = 64;
	const H = 24;

	function garis(skor: number[]) {
		const urut = [...skor].reverse();
		if (urut.length < 2) return null;
		const titik = urut.map((nilai, i) => [
			(i / (urut.length - 1)) * (W - 6) + 3,
			H - 3 - (Math.min(Math.max(nilai, 0), 100) / 100) * (H - 6)
		]);
		return { jalur: titik.map(([x, y]) => `${x},${y}`).join(' '), akhir: titik.at(-1) as number[] };
	}
</script>

<ul class="-mx-2 space-y-0.5" data-testid="emiten-teraktif">
	{#each emiten as satu (satu.ticker)}
		{@const info = tierDariSkor(satu.latest_score)}
		{@const tren = garis(satu.scores)}
		<li>
			<a
				href={tautan(aktif === satu.ticker ? null : satu.ticker)}
				data-sveltekit-noscroll
				data-ticker={satu.ticker}
				aria-current={aktif === satu.ticker ? 'true' : undefined}
				class="baris"
				class:aktif={aktif === satu.ticker}
			>
				<span class="min-w-0 flex-1">
					<span class="flex items-center gap-2">
						<span class="tw-data text-ink text-[13px] font-semibold">{satu.ticker}</span>
						{#if satu.unread > 0}
							<span
								class="titik-baru"
								aria-label={t(`${satu.unread} belum dibaca`, `${satu.unread} unread`)}
							></span>
						{/if}
					</span>
					<span class="text-muted block truncate text-[11.5px]">
						{satu.company_name || t('Emiten IDX', 'IDX company')} · {waktuRelatif(satu.latest_at)}
					</span>
				</span>

				{#if tren}
					<svg width={W} height={H} class="flex-none" aria-hidden="true">
						<polyline points={tren.jalur} class="tren" />
						<circle
							cx={tren.akhir[0]}
							cy={tren.akhir[1]}
							r="3"
							style="fill:{info.color}"
							class="ujung"
						/>
					</svg>
				{/if}

				<span class="w-14 flex-none text-right">
					{#if satu.latest_score !== null}
						<span class="tw-data text-ink block text-[13px]">{bulatkanSkor(satu.latest_score)}</span
						>
						<span class="text-secondary flex items-center justify-end gap-1 text-[10.5px]">
							<span class="kotak" style="background:{info.color}"></span>{info.label}
						</span>
					{:else}
						<span class="text-muted text-[11px]">{t('Intelijen', 'Intel')}</span>
					{/if}
				</span>

				<span
					class="tw-data text-secondary w-8 flex-none text-right text-[12px]"
					title={t('Notifikasi 30 hari', 'Alerts in 30 days')}
				>
					{satu.recent_30_days}×
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.baris {
		display: flex;
		align-items: center;
		gap: 12px;
		border-radius: 12px;
		padding: 8px;
		transition: background 0.2s ease;
	}

	.baris.aktif {
		background: rgba(74, 158, 255, 0.1);
	}

	@media (hover: hover) {
		.baris:hover {
			background: color-mix(in srgb, var(--cahaya) 4%, transparent);
		}
	}

	.titik-baru {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--color-diamond-500);
	}

	.tren {
		fill: none;
		stroke: var(--color-muted);
		stroke-width: 1.5;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.ujung {
		stroke: var(--color-base);
		stroke-width: 2;
	}

	.kotak {
		width: 6px;
		height: 6px;
		border-radius: 2px;
	}
</style>
