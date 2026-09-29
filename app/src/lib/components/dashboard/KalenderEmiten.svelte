<script lang="ts">
	import { CalendarClock, ChartPie, Gem, ShieldAlert } from 'lucide-svelte';
	import { lokal, t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import type { Agenda } from '$lib/dashboard';
	import { selisihHari } from '$lib/insight';

	let { agenda, sekarang }: { agenda: Agenda[]; sekarang: Date } = $props();

	function jarak(iso: string) {
		const hari = selisihHari(iso, sekarang);
		if (hari === 0) return t('hari ini', 'today');
		return hari > 0
			? t(`${hari} hari lagi`, `in ${hari} days`)
			: t(`${Math.abs(hari)} hari lalu`, `${Math.abs(hari)} days ago`);
	}

	const bagian = (iso: string, opsi: Intl.DateTimeFormatOptions) =>
		new Date(iso).toLocaleDateString(lokal(), { ...opsi, timeZone: 'Asia/Jakarta' });
</script>

<Panel
	judul={t('Kalender emiten', 'Company calendar')}
	keterangan={t(
		'Izin tambang, suspensi, dan perubahan kepemilikan',
		'Mining permits, suspensions, and ownership changes'
	)}
	ikon={CalendarClock}
	testid="panel-agenda"
>
	<ul class="space-y-2.5">
		{#each agenda as item, urutan (urutan)}
			<li class="flex items-start gap-3">
				<span class="tanggal" class:datang={item.akanDatang}>
					<span class="tw-data text-[15px] leading-none"
						>{bagian(item.tanggal, { day: '2-digit' })}</span
					>
					<span class="text-[10px] uppercase">{bagian(item.tanggal, { month: 'short' })}</span>
				</span>
				<span class="min-w-0 flex-1">
					<span class="flex items-center gap-2">
						{#if item.jenis === 'lisensi'}
							<Gem class="text-tier-moderate size-3.5 flex-none" aria-hidden="true" />
						{:else if item.jenis === 'suspensi'}
							<ShieldAlert class="text-secondary size-3.5 flex-none" aria-hidden="true" />
						{:else}
							<ChartPie class="text-secondary size-3.5 flex-none" aria-hidden="true" />
						{/if}
						<span class="tw-data text-ink text-[12.5px] font-semibold">{item.ticker}</span>
						<span class="text-ink truncate text-[13px]">{item.judul}</span>
					</span>
					<span class="text-muted mt-0.5 line-clamp-2 block text-[12px] leading-snug">
						{jarak(item.tanggal)}{item.detail ? `, ${item.detail}` : ''}
					</span>
				</span>
			</li>
		{/each}
	</ul>
</Panel>

<style>
	.tanggal {
		display: flex;
		width: 44px;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		border: 1px solid var(--edge);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 6px 0 5px;
		color: var(--color-secondary);
	}

	.tanggal.datang {
		border-color: color-mix(in srgb, var(--color-tier-moderate) 40%, transparent);
		color: var(--color-tier-moderate);
	}
</style>
