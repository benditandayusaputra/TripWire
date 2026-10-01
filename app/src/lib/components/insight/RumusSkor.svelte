<script lang="ts">
	import { Calculator } from 'lucide-svelte';
	import { formatAngka, labelSinyal, type Insight } from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';
	import { bahasa, t } from '$lib/bahasa.svelte';

	let { insight }: { insight: Insight } = $props();

	const BOBOT: Record<string, number> = {
		suspension: 0.3,
		insider_clustering: 0.4,
		ownership_change: 0.3
	};

	const payload = $derived(insight.payload ?? {});
	const baris = $derived(
		Object.keys(BOBOT)
			.filter((kunci) => payload.sub_scores?.[kunci] !== undefined)
			.map((kunci) => {
				const nilai = payload.sub_scores?.[kunci] ?? 0;
				return { kunci, nilai, bobot: BOBOT[kunci], sumbangan: nilai * BOBOT[kunci] };
			})
	);
	const dasar = $derived(
		payload.base_score ?? baris.reduce((jumlah, satu) => jumlah + satu.sumbangan, 0)
	);
	const pola = $derived(payload.cross_pattern);
	const pengali = $derived(pola?.multiplier_applied ?? 1);
	const akhir = $derived(insight.score ?? 0);
	const tier = $derived(tierDariSkor(akhir));
	const terpotong = $derived(dasar * pengali > 100);
	const sinyal = $derived(
		(pola?.active_signals ?? []).map((kunci) => labelSinyal(kunci).toLowerCase()).join(', ')
	);
</script>

<section class="panel" aria-labelledby="judul-rumus" data-testid="rumus-skor">
	<h2 id="judul-rumus" class="tw-overline flex items-center gap-2">
		<Calculator class="size-3.5" aria-hidden="true" />
		{t(`Kenapa skornya ${Math.round(akhir)}`, `Why the score is ${Math.round(akhir)}`)}
	</h2>
	<p class="text-secondary mt-2 text-[13px] leading-relaxed">
		{t(
			'Tiga sinyal tata kelola dihitung terpisah dari data Sectors, dijumlah sesuai bobotnya, lalu dikalikan kalau tanda bahayanya muncul berdekatan.',
			'Three governance signals are scored separately from Sectors data, added up by weight, then multiplied when the red flags appear close together.'
		)}
	</p>

	<ol class="mt-4 space-y-3">
		{#each baris as satu (satu.kunci)}
			{@const sub = tierDariSkor(satu.nilai)}
			<li class="baris" data-testid="sub-skor" data-nama={satu.kunci}>
				<span class="text-ink min-w-0 truncate text-[13px]">{labelSinyal(satu.kunci)}</span>
				<span class="lajur" aria-hidden="true">
					<span class="isi" style="width:{Math.max(satu.nilai, 2)}%; background:{sub.color}"></span>
				</span>
				<span class="tw-data text-right text-[14px] font-semibold {sub.text}">
					{Math.round(satu.nilai)}
				</span>
				<span class="tw-data text-muted text-right text-[12px]">× {formatAngka(satu.bobot, 1)}</span
				>
				<span class="tw-data text-ink text-right text-[13px]">{formatAngka(satu.sumbangan, 1)}</span
				>
			</li>
		{/each}
	</ol>

	<div class="jumlah">
		<span class="text-secondary text-[13px]">{t('Skor dasar', 'Base score')}</span>
		<span class="tw-data text-ink text-[15px]">{formatAngka(dasar, 1)}</span>
	</div>

	{#if pola}
		<p data-testid="pola-silang" class="pola" class:aktif={pengali > 1}>
			{#if bahasa() === 'en'}
				{#if pengali > 1}
					Score raised
					<span class="tw-data text-ink">{formatAngka(pengali, 1)}x</span>
					because {pola.signals_active_in_window} red {pola.signals_active_in_window === 1
						? 'flag'
						: 'flags'} appeared within {pola.window_days}
					{pola.window_days === 1 ? 'day' : 'days'} of each other: {sinyal}.
				{:else}
					No red flags appeared close together in the last {pola.window_days}
					{pola.window_days === 1 ? 'day' : 'days'}, so the base score is not multiplied.
				{/if}
			{:else if pengali > 1}
				Skor dinaikkan
				<span class="tw-data text-ink">{formatAngka(pengali, 1)} kali</span>
				karena {pola.signals_active_in_window} tanda bahaya muncul berdekatan dalam {pola.window_days}
				hari: {sinyal}.
			{:else}
				Tidak ada tanda bahaya yang muncul berdekatan dalam {pola.window_days} hari terakhir, jadi skor
				dasar tidak dikalikan.
			{/if}
		</p>
	{/if}

	<div class="hasil">
		<span class="tw-data text-secondary text-[13px]">
			{formatAngka(dasar, 1)} × {formatAngka(pengali, 1)}{terpotong
				? t(', dibatasi 100', ', capped at 100')
				: ''}
		</span>
		<span class="tw-data text-[26px] leading-none font-semibold {tier.text}">
			{Math.round(akhir)}
		</span>
	</div>
</section>

<style>
	.panel {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 20px;
		}
	}

	.baris {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 2rem 2.6rem 2.6rem;
		align-items: center;
		gap: 6px 10px;
	}

	.baris > :first-child {
		grid-column: 1 / -1;
	}

	@media (min-width: 640px) {
		.baris {
			grid-template-columns: minmax(0, 1fr) minmax(3rem, 5.5rem) 2rem 2.6rem 2.6rem;
		}

		.baris > :first-child {
			grid-column: auto;
		}
	}

	.lajur {
		position: relative;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transform-origin: left;
		animation: isi 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.2s backwards;
	}

	@keyframes isi {
		from {
			transform: scaleX(0);
		}
	}

	.jumlah {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: 14px;
		border-top: 1px dashed var(--edge);
		padding-top: 10px;
	}

	.pola {
		margin-top: 12px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 9px 11px;
		font-size: 12.5px;
		line-height: 1.5;
		color: var(--color-secondary);
	}

	.pola.aktif {
		border-color: color-mix(in srgb, var(--color-tier-high) 35%, transparent);
		background: color-mix(in srgb, var(--color-tier-high) 8%, transparent);
	}

	.hasil {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 12px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--kilau) 5%, transparent);
		padding: 12px 14px;
	}

	@media (prefers-reduced-motion: reduce) {
		.isi {
			animation: none;
		}
	}
</style>
