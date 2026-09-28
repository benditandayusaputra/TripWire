<script lang="ts">
	import '../app.css';
	import ProgresNavigasi from '$lib/components/ProgresNavigasi.svelte';

	let { children } = $props();
</script>

<ProgresNavigasi />

{@render children()}
