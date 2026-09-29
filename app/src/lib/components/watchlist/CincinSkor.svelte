<script lang="ts">
	import { Hourglass } from 'lucide-svelte';
	import { tierDariSkor } from '$lib/skor';
	import { t } from '$lib/bahasa.svelte';

	let { skor }: { skor: number | null } = $props();

	const JARI = 15.5;
	const KELILING = 2 * Math.PI * JARI;
	const info = $derived(tierDariSkor(skor));
</script>

<span
	class="cincin"
	data-testid="cincin-skor"
	data-tier={skor === null ? 'none' : info.tier}
	style="--warna:{skor === null ? 'var(--color-muted)' : info.color}"
	title={skor === null
		? t(
				'Belum dipindai, skor muncul setelah pemindaian berikutnya',
				'Not scanned yet. The score appears after the next scan'
			)
		: t(
				`Red Flag Score ${Math.round(skor)} dari 100, ${info.label}`,
				`Red Flag Score ${Math.round(skor)} out of 100, ${info.label}`
			)}
>
	<svg viewBox="0 0 36 36" aria-hidden="true">
		<circle cx="18" cy="18" r={JARI} class="jalur" class:putus={skor === null} />
		{#if skor !== null}
			<circle
				cx="18"
				cy="18"
				r={JARI}
				class="isi"
				stroke-dasharray="{(Math.max(skor, 3) / 100) * KELILING} {KELILING}"
			/>
		{/if}
	</svg>
	{#if skor === null}
		<Hourglass class="text-muted size-3.5" aria-hidden="true" />
		<span class="sr-only">{t('Belum dipindai', 'Not scanned yet')}</span>
	{:else}
		<span class="angka" aria-hidden="true">{Math.round(skor)}</span>
		<span class="sr-only">Red Flag Score {Math.round(skor)}, {info.label}</span>
	{/if}
</span>

<style>
	.cincin {
		position: relative;
		display: grid;
		width: 36px;
		height: 36px;
		flex: none;
		place-items: center;
	}

	.cincin svg {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
	}

	.jalur {
		fill: color-mix(in srgb, var(--warna) 9%, transparent);
		stroke: color-mix(in srgb, var(--warna) 22%, transparent);
		stroke-width: 3;
	}

	.jalur.putus {
		fill: none;
		stroke: var(--edge-strong);
		stroke-dasharray: 3 3.2;
	}

	.isi {
		fill: none;
		stroke: var(--warna);
		stroke-width: 3;
		stroke-linecap: round;
	}

	.angka {
		position: relative;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--warna);
	}
</style>
