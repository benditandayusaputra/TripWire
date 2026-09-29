<script lang="ts">
	import { TICKER } from '$lib/components/beranda/simulasi';
	import { ronaEmiten } from '$lib/watchlist';

	let { kode, ukuran }: { kode: string; ukuran?: number } = $props();
</script>

<span
	class="logo"
	style="--rona:{ronaEmiten(kode)};{ukuran ? ` --ukuran:${ukuran}px;` : ''}"
	aria-hidden="true"
>
	{kode.slice(0, 2)}
	{#if kode !== TICKER}
		<img
			src="https://storage.googleapis.com/sectorsapp-sea/logo/{kode}.webp"
			alt=""
			loading="lazy"
			decoding="async"
			data-testid="logo-emiten"
		/>
	{/if}
</span>

<style>
	.logo {
		--ukuran: 32px;
		position: relative;
		display: grid;
		flex: none;
		width: var(--ukuran);
		height: var(--ukuran);
		place-items: center;
		border: 1px solid light-dark(hsl(var(--rona) 45% 80%), hsl(var(--rona) 30% 32% / 0.55));
		border-radius: 50%;
		background: linear-gradient(
			160deg,
			light-dark(hsl(var(--rona) 60% 95%), hsl(var(--rona) 32% 21%)),
			light-dark(hsl(var(--rona) 50% 89%), hsl(var(--rona) 28% 13%))
		);
		font-family: var(--font-display);
		font-size: calc(var(--ukuran) * 0.36);
		font-weight: 600;
		letter-spacing: -0.02em;
		color: light-dark(hsl(var(--rona) 55% 32%), hsl(var(--rona) 72% 84%));
	}

	img {
		position: absolute;
		inset: -1px;
		width: calc(100% + 2px);
		height: calc(100% + 2px);
		border-radius: 50%;
	}

	@media (min-width: 640px) {
		.logo {
			--ukuran: 36px;
		}
	}
</style>
