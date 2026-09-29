<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Bell } from 'lucide-svelte';

	let {
		judul,
		keterangan = '',
		ikon,
		aksi,
		children,
		testid
	}: {
		judul: string;
		keterangan?: string;
		ikon?: typeof Bell;
		aksi?: Snippet;
		children: Snippet;
		testid?: string;
	} = $props();

	const id = $props.id();
</script>

<section aria-labelledby="judul-{id}" data-testid={testid} class="panel">
	<header class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2.5">
			{#if ikon}
				{@const Ikon = ikon}
				<span class="ikon-panel">
					<Ikon class="size-4" aria-hidden="true" />
				</span>
			{/if}
			<div class="min-w-0">
				<h2 id="judul-{id}" class="text-ink text-[15px] leading-tight font-semibold">{judul}</h2>
				{#if keterangan}
					<p class="text-muted mt-0.5 text-[12px] leading-snug">{keterangan}</p>
				{/if}
			</div>
		</div>
		{@render aksi?.()}
	</header>

	<div class="mt-4">
		{@render children()}
	</div>
</section>

<style>
	.panel {
		min-width: 0;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px;
		transition: border-color 0.3s ease;
	}

	@media (hover: hover) {
		.panel:hover {
			border-color: color-mix(in srgb, var(--kilau) 20%, transparent);
		}
	}

	.ikon-panel {
		display: grid;
		width: 32px;
		height: 32px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 10px;
		background: var(--color-raised);
		color: var(--color-secondary);
	}
</style>
