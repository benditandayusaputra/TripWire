<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Radar } from 'lucide-svelte';

	let {
		judul,
		keterangan = '',
		ikon,
		aksi,
		children,
		testid,
		mengisi = false,
		class: kelas = ''
	}: {
		judul: string;
		keterangan?: string;
		ikon?: typeof Radar;
		aksi?: Snippet;
		children: Snippet;
		testid?: string;
		mengisi?: boolean;
		class?: string;
	} = $props();

	const id = $props.id();
</script>

<section aria-labelledby="judul-{id}" data-testid={testid} class="panel {kelas}" class:mengisi>
	<header class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
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

	<div class="badan mt-4">
		{@render children()}
	</div>
</section>

<style>
	.panel {
		min-width: 0;
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px 16px;
		transition: border-color 0.3s ease;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 20px 22px;
		}
	}

	.panel.mengisi {
		display: flex;
		flex-direction: column;
	}

	.mengisi > .badan {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
	}

	@media (hover: hover) {
		.panel:hover {
			border-color: var(--edge-strong);
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
