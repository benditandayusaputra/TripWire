<script lang="ts">
	import Mark from './Mark.svelte';

	let { size = 'md', href = '/' } = $props();

	const ukuran = $derived(size === 'sm' ? 14 : size === 'lg' ? 24 : 18);
	const teks = $derived(size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-2xl' : 'text-lg');
</script>

<a {href} class="flex items-center gap-2.5 transition hover:opacity-85">
	<Mark size={ukuran} />
	<span class="font-display {teks} text-ink font-semibold tracking-tight">TripWire</span>
</a>
