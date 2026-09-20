<script lang="ts">
	import { Diamond } from 'lucide-svelte';

	let { title, subtitle, children, footer } = $props();
</script>

<div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
	<section
		class="border-abyss-400 bg-abyss-800 hidden flex-col justify-between border-r p-12 lg:flex"
	>
		<a href="/" class="flex items-center gap-3">
			<Diamond class="text-diamond-500 size-6" aria-hidden="true" />
			<span class="font-display text-lg font-semibold tracking-tight">TripWire</span>
		</a>

		<div class="max-w-md space-y-6">
			<p class="text-diamond-500 font-mono text-xs tracking-[0.3em] uppercase">
				Sectors Hackathon 2026
			</p>
			<h2 class="font-display text-ink-100 text-3xl leading-tight font-semibold">
				Red flag terdeteksi sebelum jadi berita.
			</h2>
			<p class="text-ink-400 leading-relaxed">
				Skoring tata kelola, keuangan, dan perdagangan untuk emiten IDX, tiap insight ditandatangani
				Ed25519 dan terikat hash chain.
			</p>
		</div>

		<p class="text-ink-500 font-mono text-xs">Bukan rekomendasi beli atau jual.</p>
	</section>

	<section class="flex items-center justify-center px-6 py-12">
		<div class="w-full max-w-sm space-y-8">
			<header class="space-y-2">
				<a href="/" class="mb-6 flex items-center gap-2 lg:hidden">
					<Diamond class="text-diamond-500 size-5" aria-hidden="true" />
					<span class="font-display text-base font-semibold">TripWire</span>
				</a>
				<h1 class="font-display text-ink-100 text-2xl font-semibold">{title}</h1>
				<p class="text-ink-400 text-sm">{subtitle}</p>
			</header>

			{@render children()}

			{#if footer}
				<div class="text-ink-400 text-sm">{@render footer()}</div>
			{/if}
		</div>
	</section>
</div>
