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
		<p class="text-diamond-500 font-mono text-xs tracking-[0.3em] uppercase">
			Sectors Hackathon 2026
		</p>
		<h1 class="font-display text-ink-100 text-4xl leading-tight font-semibold sm:text-5xl">
			TripWire
		</h1>
		<p class="text-ink-300 max-w-xl text-lg">
			Deteksi red flag dan intelijen pasar untuk saham IDX, sebelum kabarnya jadi berita.
		</p>

		<div class="flex flex-wrap gap-3 pt-2">
			<a
				href="/register"
				class="bg-diamond-500 text-abyss-900 hover:bg-diamond-400 rounded-lg px-5 py-2.5 text-sm font-semibold transition"
			>
				Daftar gratis
			</a>
			<a
				href="/login"
				class="border-abyss-400 text-ink-200 hover:border-diamond-700 hover:text-ink-100 rounded-lg border px-5 py-2.5 text-sm font-semibold transition"
			>
				Masuk
			</a>
		</div>
	</header>

	<ul class="grid gap-4 sm:grid-cols-3">
		{#each pilar as item (item.judul)}
			<li class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
				<item.icon class="text-diamond-300 mb-3 size-5" aria-hidden="true" />
				<h2 class="font-display text-ink-100 text-base font-semibold">{item.judul}</h2>
				<p class="text-ink-400 mt-2 text-sm leading-relaxed">{item.teks}</p>
			</li>
		{/each}
	</ul>
</main>
