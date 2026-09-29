<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import type { Notifikasi } from '$lib/api/notifications';
	import { waktuRelatif } from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';

	let { notifikasi, belum }: { notifikasi: Notifikasi[]; belum: number } = $props();

	const terbaru = $derived(
		notifikasi.toSorted((a, b) => b.sent_at.localeCompare(a.sent_at)).slice(0, 5)
	);

	function judul(item: Notifikasi) {
		if (item.insight_type === 'red_flag') {
			const tingkat = tierDariSkor(item.score).tier;
			const nama = {
				low: t('rendah', 'low'),
				moderate: t('sedang', 'moderate'),
				high: t('tinggi', 'high'),
				critical: t('kritis', 'critical')
			}[tingkat];
			return t(`Risiko tata kelola ${nama}`, `Governance risk ${nama}`);
		}
		if (item.subtype === 'mining_deep_dive')
			return t('Analisis tambang diperbarui', 'Mining analysis updated');
		return t('Perbandingan sektor diperbarui', 'Sector comparison updated');
	}
</script>

<Panel
	judul={t('Notifikasi', 'Alerts')}
	keterangan={t(`${belum} belum dibaca`, `${belum} unread`)}
	ikon={Bell}
	testid="panel-notifikasi"
>
	{#snippet aksi()}
		<a
			href="/notifications"
			class="text-diamond-300 hover:text-diamond-100 text-[12.5px] font-medium transition"
		>
			{t('Semua', 'View all')}
		</a>
	{/snippet}
	{#if terbaru.length === 0}
		<p class="text-muted text-[13px]">
			{t(
				'Belum ada notifikasi. Kabar masuk di sini begitu skor melewati batas.',
				'No alerts yet. They arrive here once a score crosses your threshold.'
			)}
		</p>
	{:else}
		<ul class="-mx-2 space-y-0.5">
			{#each terbaru as item (item.id)}
				<li>
					<a
						href="/insights/{item.insight_event_id}"
						class="hover:bg-ink/5 flex items-center gap-3 rounded-lg px-2 py-2 transition"
					>
						<span
							class="size-1.5 flex-none rounded-full {item.read_at === null
								? 'bg-diamond-500'
								: 'bg-transparent'}"
							aria-label={item.read_at === null ? t('Belum dibaca', 'Unread') : undefined}
						></span>
						<span class="tw-data text-ink w-11 flex-none text-[12.5px] font-semibold"
							>{item.ticker}</span
						>
						<span class="text-secondary min-w-0 flex-1 truncate text-[13px]">{judul(item)}</span>
						<span class="tw-data text-muted flex-none text-[11px]"
							>{waktuRelatif(item.sent_at)}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</Panel>
