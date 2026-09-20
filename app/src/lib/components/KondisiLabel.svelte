<script lang="ts">
	let { type, config } = $props();

	const nama: Record<string, string> = {
		recent_event: 'Event terbaru',
		geopolitical: 'Geopolitik',
		daily: 'Harian',
		weekly: 'Mingguan',
		periodic_custom: 'Periodik custom'
	};

	const hari = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

	const detail = $derived.by(() => {
		if (type === 'periodic_custom' && config?.interval_hours) {
			return `tiap ${config.interval_hours} jam`;
		}
		if (type === 'weekly' && config?.weekday) {
			return `tiap ${hari[config.weekday] ?? ''}`.trim();
		}
		if (config?.min_score) {
			return `skor minimal ${config.min_score}`;
		}
		return '';
	});
</script>

<span class="text-ink font-medium">{nama[type] ?? type}</span>
{#if detail}
	<span class="text-muted">{detail}</span>
{/if}
