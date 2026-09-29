<script lang="ts">
	import { ronaEmiten } from '$lib/watchlist';

	let { kode, ukuran }: { kode: string; ukuran?: number } = $props();
</script>

<span
	class="logo"
	style="--rona:{ronaEmiten(kode)};{ukuran ? ` --ukuran:${ukuran}px;` : ''}"
	aria-hidden="true"
>
	{kode.slice(0, 2)}
</span>

<style>
	.logo {
		--ukuran: 32px;
		display: grid;
		flex: none;
		width: var(--ukuran);
		height: var(--ukuran);
		place-items: center;
		border: 1px solid hsl(var(--rona) 30% 32% / 0.55);
		border-radius: calc(var(--ukuran) * 0.3);
		background: linear-gradient(160deg, hsl(var(--rona) 32% 21%), hsl(var(--rona) 28% 13%));
		font-family: var(--font-display);
		font-size: calc(var(--ukuran) * 0.36);
		font-weight: 600;
		letter-spacing: -0.02em;
		color: hsl(var(--rona) 72% 84%);
	}

	@media (min-width: 640px) {
		.logo {
			--ukuran: 36px;
		}
	}
</style>
