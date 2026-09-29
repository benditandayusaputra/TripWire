<script lang="ts">
	import { t } from '$lib/bahasa.svelte';
	import { NAMA_HARI, NAMA_KONDISI } from '$lib/watchlist';

	let { type, config } = $props();

	const detail = $derived.by(() => {
		if (type === 'periodic_custom' && config?.interval_hours) {
			const jam = config.interval_hours;
			return t(`tiap ${jam} jam`, `every ${jam} ${jam === 1 ? 'hour' : 'hours'}`);
		}
		if (type === 'weekly' && config?.weekday) {
			const hari = NAMA_HARI[config.weekday] ?? '';
			return t(`tiap ${hari}`, `every ${hari}`).trim();
		}
		if (config?.min_score) {
			return t(`skor minimal ${config.min_score}`, `minimum score ${config.min_score}`);
		}
		return '';
	});
</script>

<span class="text-ink font-medium">{NAMA_KONDISI[type] ?? type}</span>
{#if detail}
	<span class="text-muted">{detail}</span>
{/if}
