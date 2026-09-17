<script lang="ts">
	import { CloudOff, RotateCw } from 'lucide-svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
</script>

<svelte:head>
	<title>Sedang offline · TripWire</title>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-6 py-16">
	<Wordmark />

	<div class="space-y-4">
		<CloudOff class="text-muted size-8" aria-hidden="true" />
		<h1 data-testid="judul-offline" class="tw-title text-ink">Kamu sedang offline.</h1>
		<p class="text-secondary leading-relaxed">
			Halaman yang pernah dibuka tetap bisa dilihat dari cache. Untuk insight terbaru, sambungkan
			lagi ke internet.
		</p>
	</div>

	<button type="button" onclick={() => location.reload()} class="tw-primary self-start">
		<RotateCw class="size-4" aria-hidden="true" />
		Coba lagi
	</button>
</div>
