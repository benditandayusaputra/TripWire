<script lang="ts">
	import { FileCheck2, Radar, ShieldAlert } from 'lucide-svelte';
	import Mark from './Mark.svelte';
	import Wordmark from './Wordmark.svelte';

	let { title, subtitle, children, footer } = $props();

	const janji = [
		{ icon: ShieldAlert, teks: 'Skor risiko tata kelola dari suspensi, insider, dan kepemilikan' },
		{ icon: Radar, teks: 'Mode mendalam untuk emiten tambang, sampai radar lisensi' },
		{ icon: FileCheck2, teks: 'Tiap insight disegel Ed25519, siapa pun bisa memverifikasi' }
	];
</script>

<div class="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
	<section class="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
		<div
			class="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_400px_at_20%_15%,rgba(74,158,255,0.16),transparent_65%)]"
		></div>
		<div
			class="via-line absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent to-transparent"
		></div>

		<div class="relative">
			<Wordmark />
		</div>

		<div class="relative max-w-md space-y-7">
			<p class="tw-overline">Sectors Hackathon 2026</p>
			<h2 class="tw-display text-ink">Red flag terdeteksi sebelum jadi berita.</h2>

			<ul class="space-y-3.5">
				{#each janji as item (item.teks)}
					<li class="flex items-start gap-3">
						<item.icon class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
						<span class="text-secondary text-[14.5px] leading-relaxed">{item.teks}</span>
					</li>
				{/each}
			</ul>
		</div>

		<p class="text-muted relative flex items-center gap-2 text-[13px]">
			<Mark size={7} color="var(--color-tier-moderate)" />
			Informasi dan analisis, bukan rekomendasi beli atau jual.
		</p>
	</section>

	<section class="flex items-center justify-center px-6 py-12">
		<div class="w-full max-w-sm space-y-8">
			<header class="space-y-2">
				<div class="mb-7 lg:hidden">
					<Wordmark size="sm" />
				</div>
				<h1 class="tw-title text-ink">{title}</h1>
				<p class="tw-caption">{subtitle}</p>
			</header>

			{@render children()}

			{#if footer}
				<div class="text-secondary text-[14px]">{@render footer()}</div>
			{/if}
		</div>
	</section>
</div>
