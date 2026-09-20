<script lang="ts">
	import { bulatkanSkor, tierDariSkor } from '$lib/skor';

	let { skor, size = 'md', showLabel = true } = $props();

	const info = $derived(tierDariSkor(skor));
	const angka = $derived(bulatkanSkor(skor));
</script>

{#if size === 'lg'}
	<div
		data-testid="skor-badge"
		data-tier={info.tier}
		class="rounded-glass-lg flex flex-col items-center justify-center border {info.border} {info.background} px-4 py-3"
	>
		<span class="font-display text-3xl leading-none font-semibold {info.text}">{angka}</span>
		<span class="tw-overline mt-1.5">Score</span>
	</div>
{:else}
	<span
		data-testid="skor-badge"
		data-tier={info.tier}
		class="inline-flex items-center gap-2 rounded-full border {info.border} {info.background} px-2.5 py-1"
	>
		<span class="tw-data text-[13px] font-semibold {info.text}">{angka}</span>
		{#if showLabel}
			<span class="text-[12px] font-medium {info.text}">{info.label}</span>
		{/if}
	</span>
{/if}
