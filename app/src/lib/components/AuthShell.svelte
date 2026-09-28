<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import Mark from './Mark.svelte';
	import PanelPasar from './auth/PanelPasar.svelte';

	let { title, subtitle, children }: { title: string; subtitle: string; children: Snippet } =
		$props();

	const pilihan = [
		{ href: '/login', label: 'Masuk' },
		{ href: '/register', label: 'Daftar' }
	];
</script>

<div class="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
	<main
		class="lembar relative z-10 order-2 -mt-7 flex flex-1 justify-center px-5 pt-7 pb-10 sm:px-8 lg:mt-0 lg:items-center lg:px-12 lg:py-14"
	>
		<div class="w-full max-w-100 space-y-7">
			<nav aria-label="Pilih masuk atau daftar" class="saklar">
				{#each pilihan as item (item.href)}
					<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>
						{item.label}
					</a>
				{/each}
			</nav>

			<header class="space-y-1.5">
				<h1 class="tw-title text-ink">{title}</h1>
				<p class="tw-caption">{subtitle}</p>
			</header>

			{@render children()}

			<p class="text-muted flex items-center gap-2.5 text-[12.5px]">
				<Mark size={7} color="var(--color-tier-moderate)" />
				Informasi dan analisis, bukan rekomendasi beli atau jual.
			</p>
		</div>
	</main>

	<PanelPasar />
</div>

<style>
	.lembar {
		border-top: 1px solid var(--edge);
		border-radius: 28px 28px 0 0;
		background: var(--color-base);
	}

	@media (min-width: 1024px) {
		.lembar {
			border-top: 0;
			border-radius: 0;
			background: radial-gradient(
				560px 420px at 50% 42%,
				rgba(74, 158, 255, 0.07),
				transparent 70%
			);
		}
	}

	.saklar {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
		border: 1px solid var(--edge);
		border-radius: 14px;
		background: rgba(8, 11, 18, 0.6);
		padding: 4px;
	}

	.saklar a {
		border-radius: 10px;
		padding: 8px 12px;
		text-align: center;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-muted);
		transition:
			color 0.2s ease,
			background 0.2s ease;
	}

	.saklar a:hover {
		color: var(--color-ink);
	}

	.saklar a[aria-current='page'] {
		background: var(--color-raised);
		color: var(--color-ink);
		box-shadow:
			inset 0 0 0 1px var(--edge-strong),
			0 8px 18px -12px #000;
	}
</style>
