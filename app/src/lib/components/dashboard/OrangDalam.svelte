<script lang="ts">
	import { ExternalLink, UserMinus } from 'lucide-svelte';
	import { lokal, t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import type { AktivitasOrangDalam } from '$lib/dashboard';
	import { formatAngka, formatRingkas } from '$lib/insight';

	let { aktivitas }: { aktivitas: AktivitasOrangDalam[] } = $props();

	const tanggal = (iso: string) =>
		new Date(iso).toLocaleDateString(lokal(), {
			day: '2-digit',
			month: 'short',
			timeZone: 'Asia/Jakarta'
		});

	const jenis = (kode: string) =>
		kode === 'sell'
			? t('melepas', 'sold')
			: kode === 'buy'
				? t('menambah', 'bought')
				: t('transaksi lain', 'other transaction');

	const warna = (kode: string) =>
		kode === 'sell' ? 'bg-turun' : kode === 'buy' ? 'bg-naik' : 'bg-secondary';
</script>

<Panel
	judul={t('Aktivitas orang dalam', 'Insider activity')}
	keterangan={t(
		'Transaksi direksi, komisaris, dan pemegang saham besar dari laporan KSEI',
		'Directors, commissioners, and major holders from KSEI filings'
	)}
	ikon={UserMinus}
	testid="panel-orang-dalam"
>
	<ul class="divide-line/60 divide-y">
		{#each aktivitas as item, urutan (urutan)}
			<li class="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
				<span class="tw-data text-muted text-[11.5px]">{tanggal(item.tanggal)}</span>
				<span class="min-w-0">
					<span class="flex items-baseline gap-2">
						<span class="tw-data text-ink text-[12.5px] font-semibold">{item.ticker}</span>
						<span class="text-secondary truncate text-[13px]">{item.nama}</span>
					</span>
					<span class="text-muted mt-0.5 flex items-center gap-1.5 text-[11.5px]">
						<span class="size-1.5 rounded-full {warna(item.jenis)}"></span>
						{item.jenis === 'sell' ? '▼' : item.jenis === 'buy' ? '▲' : '■'}
						{jenis(item.jenis)}
						{#if item.sebelum !== undefined && item.sesudah !== undefined}
							<span class="tw-data"
								>{formatAngka(item.sebelum)}% {t('ke', 'to')} {formatAngka(item.sesudah)}%</span
							>
						{/if}
					</span>
				</span>
				<span class="flex items-center gap-2">
					<span class="tw-data text-ink text-[12.5px]"
						>{item.nilai > 0 ? `Rp${formatRingkas(item.nilai)}` : '-'}</span
					>
					{#if item.sumber}
						<a
							href={item.sumber}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={t(
								`Dokumen sumber transaksi ${item.nama}`,
								`Source filing for ${item.nama}`
							)}
							class="text-muted hover:text-diamond-300 transition"
						>
							<ExternalLink class="size-3.5" aria-hidden="true" />
						</a>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
</Panel>
