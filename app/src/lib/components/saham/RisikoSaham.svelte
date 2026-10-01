<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		ArrowUpRight,
		Ban,
		ChartPie,
		LoaderCircle,
		ScanSearch,
		ShieldAlert,
		UserMinus,
		UserPlus
	} from 'lucide-svelte';
	import { judulInsight, waktuRelatif, type Insight } from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';
	import { lokal, t } from '$lib/bahasa.svelte';
	import { NAMA_SINYAL, tanggalPendek, type Peristiwa, type Risiko } from '$lib/watchlist';

	let {
		kode,
		redFlag,
		risiko,
		dipantau,
		menunggu,
		peristiwa,
		pantau
	}: {
		kode: string;
		redFlag: Insight | null;
		risiko: Risiko | null;
		dipantau: boolean;
		menunggu: boolean;
		peristiwa: Peristiwa[];
		pantau: Snippet;
	} = $props();

	const IKON = { jual: UserMinus, beli: UserPlus, kepemilikan: ChartPie, suspensi: Ban };

	const skor = $derived(redFlag?.score ?? null);
	const tier = $derived(tierDariSkor(skor));
	const subSkor = $derived(Object.entries(redFlag?.payload?.sub_scores ?? {}));
	const pengali = $derived(redFlag?.payload?.cross_pattern?.multiplier_applied ?? 1);
	const selisih = $derived(
		skor !== null && risiko?.previous_score !== null && risiko?.previous_score !== undefined
			? Math.round(skor - risiko.previous_score)
			: null
	);
</script>

<section
	class="panel flex h-full flex-col"
	aria-labelledby="judul-risiko"
	data-testid="risiko-saham"
	data-status={redFlag && !menunggu
		? 'skor'
		: menunggu
			? 'memindai'
			: dipantau
				? 'menunggu'
				: 'belum'}
>
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 id="judul-risiko" class="tw-overline flex items-center gap-2">
			<ShieldAlert class="size-3.5" aria-hidden="true" />
			Red Flag Score
		</h2>
		{#if redFlag}
			<span class="text-muted text-[12px]">
				{t('dihitung', 'calculated')}
				{waktuRelatif(redFlag.generated_at)}
			</span>
		{/if}
	</div>

	{#if redFlag && skor !== null}
		<div class="flex items-end gap-3">
			<span
				data-testid="skor-saham"
				class="tw-data text-[44px] leading-none font-semibold {tier.text}">{Math.round(skor)}</span
			>
			<span class="pb-1">
				<span class="block text-[14px] font-semibold {tier.text}">{tier.label}</span>
				<span class="text-muted block text-[12px]">{t('dari 100', 'out of 100')}</span>
			</span>
			{#if selisih !== null && selisih !== 0}
				<span class="tw-data text-secondary ml-auto pb-1 text-[12px]">
					{selisih > 0 ? t('naik', 'up') : t('turun', 'down')}
					{Math.abs(selisih)}
				</span>
			{/if}
		</div>

		<p class="text-secondary mt-3 text-[13px] leading-snug">{judulInsight(redFlag)}</p>

		<ul class="mt-4 space-y-2.5">
			{#each subSkor as [kunci, nilai] (kunci)}
				<li class="grid grid-cols-[minmax(0,8.5rem)_1fr_2rem] items-center gap-3 text-[12.5px]">
					<span class="text-secondary truncate">{NAMA_SINYAL[kunci] ?? kunci}</span>
					<span class="lajur">
						<span
							class="isi"
							style="width:{Math.max(nilai, 3)}%; background:{tierDariSkor(nilai).color}"
						></span>
					</span>
					<span class="tw-data text-ink text-right">{Math.round(nilai)}</span>
				</li>
			{/each}
		</ul>

		{#if pengali > 1}
			<p class="pola">
				{t(
					`Sinyal muncul berdekatan, skor dikali ${pengali.toLocaleString(lokal())}`,
					`Signals appeared close together, score multiplied by ${pengali.toLocaleString(lokal())}`
				)}
			</p>
		{/if}

		<div class="pemicu">
			<h3 class="tw-overline">{t('Pemicu terakhir', 'Latest triggers')}</h3>
			{#if peristiwa.length}
				<ol class="mt-2.5 space-y-2">
					{#each peristiwa.slice(0, 4) as satu, urutan (urutan)}
						{@const Ikon = IKON[satu.jenis]}
						<li
							class="flex items-start gap-2 text-[12.5px] leading-snug"
							data-testid="pemicu-saham"
						>
							<span class="ikon"><Ikon class="size-3" aria-hidden="true" /></span>
							<span class="tw-data text-diamond-300 w-12 flex-none pt-0.5 text-[11px]">
								{tanggalPendek(satu.tanggal)}
							</span>
							<span class="text-secondary min-w-0 flex-1">{satu.teks}</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-muted mt-2 text-[12.5px]">
					{t(
						'Tidak ada suspensi, transaksi orang dalam, atau perubahan pemegang besar yang tercatat dalam jendela pemantauan.',
						'No suspension, insider trade, or major holder change recorded in the monitoring window.'
					)}
				</p>
			{/if}
		</div>

		<a href="/insights/{redFlag.id}" class="tautan mt-auto pt-4" data-testid="rincian-skor">
			{t('Kenapa skornya segini', 'Why this score')}
			<ArrowUpRight class="size-3.5" aria-hidden="true" />
		</a>
	{:else if menunggu}
		<div class="kosong" aria-live="polite">
			<LoaderCircle class="text-diamond-300 size-5 animate-spin" aria-hidden="true" />
			<p class="text-ink text-[13.5px] font-medium">
				{t(`TripWire sedang memindai ${kode}`, `TripWire is scanning ${kode}`)}
			</p>
			<p class="text-secondary text-[12.5px]">
				{t(
					'Riwayat suspensi, transaksi orang dalam, dan pemegang saham sedang diambil dari Sectors. Skor muncul di sini dalam beberapa detik.',
					'Suspension history, insider trades, and shareholders are being pulled from Sectors. The score shows up here in a few seconds.'
				)}
			</p>
		</div>
	{:else if dipantau}
		<div class="kosong">
			<ScanSearch class="text-muted size-5" aria-hidden="true" />
			<p class="text-secondary text-[13px]">
				{t(
					`Skor ${kode} belum tersedia. Skor dihitung pada pemindaian berikutnya, lalu muncul di sini dan di watchlist.`,
					`The ${kode} score is not available yet. It is calculated on the next scan, then shows up here and in your watchlist.`
				)}
			</p>
		</div>
	{:else}
		<div class="kosong">
			<ScanSearch class="text-diamond-300 size-5" aria-hidden="true" />
			<p class="text-ink text-[13.5px] font-medium">
				{t(`Cek tanda bahaya di ${kode}`, `Check ${kode} for red flags`)}
			</p>
			<p class="text-secondary text-[12.5px]">
				{t(
					'Pantau saham ini dan TripWire langsung menghitung Red Flag Score dari riwayat suspensi, transaksi orang dalam, dan perubahan pemegang saham, lalu mengabari kamu kalau ada yang berubah.',
					'Watch this stock and TripWire calculates its Red Flag Score right away from suspension history, insider trades, and shareholder changes, then tells you when something changes.'
				)}
			</p>
			{@render pantau()}
		</div>
	{/if}
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

	.kosong {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border: 1px dashed var(--edge);
		border-radius: 14px;
		padding: 20px 16px;
		text-align: center;
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

	.pola {
		margin-top: 14px;
		border: 1px solid color-mix(in srgb, var(--color-tier-high) 35%, transparent);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-tier-high) 8%, transparent);
		padding: 8px 10px;
		font-size: 12.5px;
		color: var(--color-ink);
	}

	.pemicu {
		margin-top: 18px;
		border-top: 1px solid var(--edge-soft);
		padding-top: 14px;
	}

	.ikon {
		display: grid;
		width: 20px;
		height: 20px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 999px;
		background: var(--color-raised);
		color: var(--color-secondary);
	}

	.tautan {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-diamond-300);
		transition: color 0.2s ease;
	}

	@media (hover: hover) {
		.tautan:hover {
			color: var(--color-diamond-100);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.isi {
			animation: none;
		}
	}
</style>
