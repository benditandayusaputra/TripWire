<script lang="ts">
	import Logo from './Logo.svelte';

	let { size = 'md', href = '/' } = $props();

	const ukuran = $derived(size === 'sm' ? 30 : size === 'lg' ? 46 : 36);
	const teks = $derived(size === 'sm' ? 'text-[16px]' : size === 'lg' ? 'text-2xl' : 'text-[19px]');
</script>

<a {href} class="flex items-center gap-2 transition hover:opacity-85">
	<Logo size={ukuran} cincin={false} />
	<span class="font-display {teks} text-ink font-semibold tracking-tight">TripWire</span>
</a>
