<script lang="ts">
	import { ShieldAlert, Radar, FileCheck2 } from 'lucide-svelte';

	const pilar = [
		{
			icon: ShieldAlert,
			judul: 'Red Flag Detector',
			teks: 'Skoring tata kelola, keuangan, dan perdagangan jadi satu angka yang bisa ditelusuri.'
		},
		{
			icon: Radar,
			judul: 'Market Intelligence',
			teks: 'Pantauan sektor dan komoditas, dengan mode mendalam untuk emiten tambang.'
		},
		{
			icon: FileCheck2,
			judul: 'Insight Terverifikasi',
			teks: 'Tiap insight ditandatangani Ed25519 dan terikat hash chain, siapa pun bisa memverifikasi.'
		}
	];
</script>

<svelte:head>
	<title>TripWire</title>
	<meta name="description" content="Red flag detector dan market intelligence untuk saham IDX" />
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-12 px-6 py-16">
	<header class="space-y-4">
		<p class="font-mono text-xs tracking-[0.3em] text-diamond-500 uppercase">Sectors Hackathon 2026</p>
		<h1 class="font-display text-4xl leading-tight font-semibold text-ink-100 sm:text-5xl">
			TripWire
		</h1>
		<p class="max-w-xl text-lg text-ink-300">
			Deteksi red flag dan intelijen pasar untuk saham IDX, sebelum kabarnya jadi berita.
		</p>
	</header>

	<ul class="grid gap-4 sm:grid-cols-3">
		{#each pilar as item (item.judul)}
			<li class="rounded-xl border border-abyss-400 bg-abyss-700 p-5">
				<item.icon class="mb-3 size-5 text-diamond-300" aria-hidden="true" />
				<h2 class="font-display text-base font-semibold text-ink-100">{item.judul}</h2>
				<p class="mt-2 text-sm leading-relaxed text-ink-400">{item.teks}</p>
			</li>
		{/each}
	</ul>
</main>
