<script lang="ts">
	import { Ban, ChartPie, ExternalLink, UserMinus } from 'lucide-svelte';
	import {
		formatAngka,
		formatPoin,
		formatRingkas,
		formatTanggalSaja,
		labelKeparahan,
		labelTransaksi,
		selisihHari,
		type Insight
	} from '$lib/insight';
	import { t } from '$lib/bahasa.svelte';

	let { insight }: { insight: Insight } = $props();

	const payload = $derived(insight.payload ?? {});
	const pendukung = $derived(payload.supporting_data ?? {});
	const jendela = $derived(payload.cross_pattern?.window_days ?? 30);
	const suspensi = $derived(pendukung.suspensions ?? []);
	const insider = $derived(pendukung.insider_transactions ?? []);
	const perubahan = $derived(pendukung.ownership_changes ?? []);
	const pemegang = $derived(pendukung.major_shareholders ?? []);

	const WARNA_KEPARAHAN: Record<number, string> = {
		1: 'bg-tier-moderate',
		2: 'bg-tier-high',
		3: 'bg-tier-critical'
	};

	function dalamJendela(tanggal: string) {
		const hari = -selisihHari(tanggal, insight.generated_at);
		return hari >= 0 && hari <= jendela;
	}

	function warnaTransaksi(jenis: string) {
		if (jenis === 'sell') return 'bg-tier-high';
		if (jenis === 'buy') return 'bg-tier-low';
		return 'bg-secondary';
	}
</script>

<section class="space-y-3" aria-labelledby="judul-bukti">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h2 id="judul-bukti" class="tw-heading text-ink">
			{t('Bukti dari data Sectors', 'Evidence from Sectors data')}
		</h2>
		<p class="text-muted flex items-center gap-2 text-[12px]">
			<span class="tanda-jendela" aria-hidden="true"></span>
			{t(
				`Kejadian dalam ${jendela} hari sebelum skor dihitung`,
				`Events within ${jendela} days before the score was calculated`
			)}
		</p>
	</div>

	<div class="grid items-start gap-4 lg:grid-cols-3">
		<details class="kolom" data-testid="bagian-suspensi" open>
			<summary>
				<Ban class="size-3.5" aria-hidden="true" />
				<span class="flex-1">{t('Suspensi saham', 'Trading suspensions')}</span>
				<span class="tw-data text-muted text-[12px]">{suspensi.length}</span>
			</summary>
			{#if suspensi.length}
				<ul class="daftar">
					{#each suspensi as item (item.date + item.reason)}
						<li class:jendela={dalamJendela(item.date)}>
							<span
								class="penanda {WARNA_KEPARAHAN[item.severity_tier] ?? 'bg-tier-high'}"
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1 space-y-1">
								<p class="text-ink text-[13px] leading-snug">
									{item.reason || t('Alasan tidak dicantumkan', 'No reason given')}
								</p>
								<p class="meta">
									<span class="tw-data">{formatTanggalSaja(item.date)}</span>
									<span>{labelKeparahan(item.severity_tier)}</span>
									{#if item.pdf_url}
										<a href={item.pdf_url} target="_blank" rel="noopener noreferrer" class="tautan">
											{t('Pengumuman resmi', 'Official announcement')}
											<ExternalLink class="size-3" aria-hidden="true" />
										</a>
									{/if}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="kosong">
					{t(
						'Tidak ada suspensi dalam tiga tahun terakhir.',
						'No suspensions in the last three years.'
					)}
				</p>
			{/if}
		</details>

		<details class="kolom" data-testid="bagian-insider" open>
			<summary>
				<UserMinus class="size-3.5" aria-hidden="true" />
				<span class="flex-1">{t('Transaksi orang dalam', 'Insider transactions')}</span>
				<span class="tw-data text-muted text-[12px]">{insider.length}</span>
			</summary>
			{#if insider.length}
				<ul class="daftar">
					{#each insider as item, urutan (urutan)}
						<li class:jendela={dalamJendela(item.date)}>
							<span class="penanda {warnaTransaksi(item.transaction_type)}" aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1 space-y-1">
								<p class="text-ink text-[13px] leading-snug">
									{item.holder_name}
									<span class="text-muted">{labelTransaksi(item.transaction_type)}</span>
									{#if item.transaction_value > 0}
										<span class="tw-data text-secondary"
											>Rp {formatRingkas(item.transaction_value)}</span
										>
									{/if}
								</p>
								<p class="meta">
									<span class="tw-data">{formatTanggalSaja(item.date)}</span>
									{#if item.share_pct_before !== undefined && item.share_pct_after !== undefined}
										<span class="tw-data">
											{formatAngka(item.share_pct_before, 3)}% {t('ke', 'to')}
											{formatAngka(item.share_pct_after, 3)}%
										</span>
									{/if}
									{#if item.source_url}
										<a
											href={item.source_url}
											target="_blank"
											rel="noopener noreferrer"
											class="tautan"
										>
											{t('Dokumen', 'Document')}
											<ExternalLink class="size-3" aria-hidden="true" />
										</a>
									{/if}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="kosong">
					{t(
						'Tidak ada laporan transaksi orang dalam di KSEI dalam 90 hari terakhir.',
						'No insider transaction filings at KSEI in the last 90 days.'
					)}
				</p>
			{/if}
		</details>

		<details class="kolom" data-testid="bagian-kepemilikan" open>
			<summary>
				<ChartPie class="size-3.5" aria-hidden="true" />
				<span class="flex-1">{t('Perubahan pemegang saham', 'Shareholder changes')}</span>
				<span class="tw-data text-muted text-[12px]">{perubahan.length}</span>
			</summary>
			{#if perubahan.length}
				<ul class="daftar">
					{#each perubahan as item (item.holder_name)}
						<li class:jendela={dalamJendela(item.last_date)}>
							<span
								class="penanda {Math.abs(item.delta_pp) > 3 ? 'bg-tier-high' : 'bg-secondary'}"
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1 space-y-1">
								<p class="text-ink text-[13px] leading-snug">{item.holder_name}</p>
								<p class="meta">
									<span class="tw-data">
										{formatAngka(item.share_pct_before)}% {t('ke', 'to')}
										{formatAngka(item.share_pct_after)}%
									</span>
									<span class={Math.abs(item.delta_pp) > 3 ? 'text-tier-high' : ''}>
										{formatPoin(item.delta_pp)}
									</span>
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="kosong">
					{t(
						'Tidak ada perubahan porsi pemegang saham dalam 90 hari terakhir.',
						'No change in shareholder stakes in the last 90 days.'
					)}
				</p>
			{/if}

			{#if pemegang.length}
				<p class="tw-overline mt-4 mb-2">
					{t('Pemegang saham utama saat ini', 'Current major shareholders')}
				</p>
				<ul class="space-y-2">
					{#each pemegang as item (item.name)}
						<li class="space-y-1">
							<div class="flex items-baseline justify-between gap-3 text-[12.5px]">
								<span class="text-secondary truncate"
									>{item.name === 'Public' ? t('Masyarakat umum', 'Public') : item.name}</span
								>
								<span class="tw-data text-ink">{formatAngka(item.percentage)}%</span>
							</div>
							<div class="pita" aria-hidden="true">
								<span style="width:{Math.min(100, item.percentage)}%"></span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	</div>
</section>

<style>
	.kolom {
		border: 1px solid var(--edge);
		border-radius: 18px;
		background: var(--color-base);
		padding: 14px 16px;
	}

	summary {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		list-style: none;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--color-ink);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary::after {
		content: '';
		width: 7px;
		height: 7px;
		border-right: 1.5px solid var(--color-muted);
		border-bottom: 1.5px solid var(--color-muted);
		transform: rotate(45deg) translateY(-2px);
		transition: transform 0.2s ease;
	}

	.kolom:not([open]) summary::after {
		transform: rotate(-45deg);
	}

	.daftar {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}

	.daftar li {
		display: flex;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		padding: 9px 10px;
	}

	.daftar li.jendela {
		border-color: color-mix(in srgb, var(--color-tier-high) 40%, transparent);
		background: color-mix(in srgb, var(--color-tier-high) 6%, transparent);
	}

	.penanda {
		width: 9px;
		height: 9px;
		flex: none;
		margin-top: 5px;
		border-radius: 2px;
		transform: rotate(45deg);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.tautan {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-diamond-300);
	}

	.tautan:hover {
		color: var(--color-diamond-100);
	}

	.kosong {
		margin-top: 12px;
		border: 1px dashed var(--edge);
		border-radius: 12px;
		padding: 12px;
		font-size: 12.5px;
		color: var(--color-secondary);
	}

	.tanda-jendela {
		width: 12px;
		height: 12px;
		border: 1px solid color-mix(in srgb, var(--color-tier-high) 50%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-tier-high) 10%, transparent);
	}

	.pita {
		height: 5px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.pita span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: var(--color-secondary);
	}
</style>
