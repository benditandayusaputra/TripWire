<script lang="ts">
	import { slide } from 'svelte/transition';
	import { ChevronRight, Mail, MailOpen, Trash2 } from 'lucide-svelte';
	import type { Notifikasi } from '$lib/api/notifications';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import { t } from '$lib/bahasa.svelte';
	import { waktuRelatif } from '$lib/insight';
	import { jamWib, judulNotifikasi, penjelasanNotifikasi, selisihSkor } from '$lib/notifikasi';
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let {
		item,
		sibuk = false,
		onbuka,
		ontandai,
		onhapus
	}: {
		item: Notifikasi;
		sibuk?: boolean;
		onbuka: (event: MouseEvent, item: Notifikasi) => void;
		ontandai: (item: Notifikasi) => void;
		onhapus: (item: Notifikasi) => void;
	} = $props();

	const SINYAL = [
		['suspension', 'Suspensi', 'Suspension'],
		['insider_clustering', 'Orang dalam', 'Insiders'],
		['ownership_change', 'Kepemilikan', 'Ownership']
	] as const;

	const risiko = $derived(item.insight_type === 'red_flag');
	const dibaca = $derived(item.read_at !== null);
	const info = $derived(tierDariSkor(item.score));
	const skorAda = $derived(item.score !== null && item.score !== undefined);
	const selisih = $derived(risiko ? selisihSkor(item.score, item.prev_score) : null);
</script>

<li
	data-testid="notifikasi-item"
	data-id={item.id}
	data-ticker={item.ticker}
	data-dibaca={dibaca}
	data-tier={risiko ? info.tier : 'intel'}
	class="baris"
	class:baru={!dibaca}
	transition:slide={{ duration: 220 }}
>
	<a href="/insights/{item.insight_event_id}" class="isi" onclick={(event) => onbuka(event, item)}>
		{#if item.ticker}
			<span class="logo-baris"><LogoEmiten kode={item.ticker} ukuran={42} /></span>
		{/if}

		<span class="min-w-0 flex-1">
			<span class="flex min-w-0 items-center gap-2">
				<span class="tw-data text-ink flex-none text-[12.5px] font-semibold">{item.ticker}</span>
				{#if item.company_name}
					<span class="text-secondary truncate text-[12.5px]">{item.company_name}</span>
				{/if}
				<span class="jenis tw-data" class:intel={!risiko}
					>{risiko ? 'RED FLAG' : t('INTELIJEN', 'INTEL')}</span
				>
			</span>

			<span class="judul block text-[14.5px] leading-snug" class:tebal={!dibaca}>
				{judulNotifikasi(item)}
			</span>

			<span class="text-secondary mt-0.5 block text-[12.5px] leading-relaxed">
				{penjelasanNotifikasi(item)}
			</span>

			{#if risiko && item.sub_scores}
				<span class="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
					{#each SINYAL as [kunci, label, labelEn] (kunci)}
						{@const nilai = Math.round(item.sub_scores[kunci] ?? 0)}
						<span class="flex items-center gap-1.5 text-[11.5px]">
							<span class="text-muted">{t(label, labelEn)}</span>
							<span class="meter" aria-hidden="true">
								<span style="width:{Math.max(nilai, 4)}%; background:{tierDariSkor(nilai).color}"
								></span>
							</span>
							<span class="tw-data text-ink">{nilai}</span>
						</span>
					{/each}
				</span>
			{/if}

			<span class="tw-data text-muted mt-2 block text-[11.5px]">
				<time datetime={item.sent_at}>{jamWib(item.sent_at)} WIB</time> · {waktuRelatif(
					item.sent_at
				)}
			</span>
		</span>

		<span class="skor">
			{#if risiko && skorAda}
				<span class="tw-data text-ink block text-[20px] leading-none font-medium"
					>{bulatkanSkor(item.score)}</span
				>
				<span class="text-secondary mt-1.5 flex items-center justify-end gap-1.5 text-[11.5px]">
					<span class="kotak" style="background:{info.color}"></span>{info.label}
				</span>
				{#if selisih}
					<span
						data-testid="selisih-skor"
						class="tw-data text-secondary mt-1 block text-[11.5px]"
						title={t(`Skor ${selisih.label}`, `Score ${selisih.label}`)}
					>
						<span aria-hidden="true">{selisih.teks}</span>
						<span class="sr-only">{t('skor', 'score')} {selisih.label}</span>
					</span>
				{/if}
			{:else if skorAda}
				<span class="tw-data text-ink block text-[18px] leading-none"
					>{bulatkanSkor(item.score)}</span
				>
				<span class="text-muted mt-1.5 block text-[11px]">{t('eksposur', 'exposure')}</span>
			{:else}
				<ChevronRight class="text-muted size-4" aria-hidden="true" />
			{/if}
		</span>
	</a>

	<div class="aksi">
		<button
			type="button"
			class="tombol"
			data-testid={dibaca ? 'tandai-belum' : 'tandai-dibaca'}
			aria-label={dibaca
				? t(`Tandai ${item.ticker} belum dibaca`, `Mark ${item.ticker} as unread`)
				: t(`Tandai ${item.ticker} sudah dibaca`, `Mark ${item.ticker} as read`)}
			title={dibaca
				? t('Tandai belum dibaca', 'Mark as unread')
				: t('Tandai sudah dibaca', 'Mark as read')}
			disabled={sibuk}
			onclick={() => ontandai(item)}
		>
			{#if dibaca}
				<Mail class="size-4" aria-hidden="true" />
			{:else}
				<MailOpen class="size-4" aria-hidden="true" />
			{/if}
		</button>
		<button
			type="button"
			class="tombol"
			data-testid="hapus-notifikasi"
			aria-label={t(`Hapus notifikasi ${item.ticker}`, `Delete ${item.ticker} alert`)}
			title={t('Hapus notifikasi', 'Delete alert')}
			disabled={sibuk}
			onclick={() => onhapus(item)}
		>
			<Trash2 class="size-4" aria-hidden="true" />
		</button>
	</div>
</li>

<style>
	.baris {
		position: relative;
		display: flex;
		align-items: stretch;
		border-radius: 14px;
		transition: background 0.2s ease;
	}

	.baris.baru::before {
		content: '';
		position: absolute;
		top: 14px;
		bottom: 14px;
		left: 0;
		width: 2px;
		border-radius: 2px;
		background: var(--color-diamond-500);
		box-shadow: 0 0 12px rgba(74, 158, 255, 0.6);
	}

	@media (hover: hover) {
		.baris:hover {
			background: color-mix(in srgb, var(--cahaya) 3%, transparent);
		}
	}

	.isi {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: flex-start;
		gap: 14px;
		padding: 14px 6px 14px 14px;
	}

	.logo-baris {
		padding-top: 2px;
	}

	.jenis {
		flex: none;
		border: 1px solid var(--edge);
		border-radius: 6px;
		padding: 0 5px;
		font-size: 9.5px;
		letter-spacing: 0.1em;
		color: var(--color-muted);
	}

	.judul {
		margin-top: 2px;
		color: var(--color-secondary);
	}

	.judul.tebal {
		color: var(--color-ink);
		font-weight: 600;
	}

	.meter {
		position: relative;
		width: 32px;
		height: 4px;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 10%, transparent);
	}

	.meter span {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
	}

	.skor {
		width: 64px;
		flex: none;
		text-align: right;
	}

	.kotak {
		width: 7px;
		height: 7px;
		border-radius: 2px;
	}

	.aksi {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 4px;
		padding: 8px 8px 8px 0;
	}

	.tombol {
		display: grid;
		width: 32px;
		height: 32px;
		place-items: center;
		border-radius: 9px;
		color: var(--color-muted);
		transition:
			background 0.2s ease,
			color 0.2s ease,
			opacity 0.2s ease;
	}

	@media (hover: hover) {
		.baris .tombol {
			opacity: 0.35;
		}

		.baris:hover .tombol,
		.tombol:focus-visible {
			opacity: 1;
		}

		.tombol:not(:disabled):hover {
			background: color-mix(in srgb, var(--cahaya) 6%, transparent);
			color: var(--color-ink);
		}
	}

	@media (max-width: 480px) {
		.isi {
			gap: 10px;
			padding-left: 10px;
		}

		.skor {
			width: 48px;
		}
	}
</style>
