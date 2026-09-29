<script lang="ts">
	import { untrack } from 'svelte';
	import { navigating } from '$app/state';

	let nilai = $state(0);
	let tampil = $state(false);
	let tundaMulai: ReturnType<typeof setTimeout> | undefined;
	let tundaSelesai: ReturnType<typeof setTimeout> | undefined;
	let detak: ReturnType<typeof setInterval> | undefined;

	function mulai() {
		clearTimeout(tundaSelesai);
		if (tampil || tundaMulai) return;
		tundaMulai = setTimeout(() => {
			tundaMulai = undefined;
			tampil = true;
			nilai = 0.14;
			detak = setInterval(() => (nilai += (0.92 - nilai) * 0.09), 180);
		}, 80);
	}

	function selesai() {
		clearTimeout(tundaMulai);
		tundaMulai = undefined;
		clearInterval(detak);
		if (!tampil) return;
		nilai = 1;
		tundaSelesai = setTimeout(() => {
			tampil = false;
			nilai = 0;
		}, 380);
	}

	$effect(() => {
		const sedangPindah = navigating.to !== null;
		untrack(() => (sedangPindah ? mulai() : selesai()));
	});
</script>

{#if tampil}
	<div
		class="progres"
		class:rampung={nilai === 1}
		data-testid="progres-navigasi"
		aria-hidden="true"
	>
		<span style="width: {nilai * 100}%"></span>
	</div>
{/if}

<style>
	.progres {
		position: fixed;
		inset: 0 0 auto;
		z-index: 70;
		height: 2.5px;
		pointer-events: none;
		transition: opacity 0.25s ease 0.12s;
	}

	.progres.rampung {
		opacity: 0;
	}

	span {
		position: relative;
		display: block;
		height: 100%;
		border-radius: 0 999px 999px 0;
		background: linear-gradient(
			90deg,
			var(--color-diamond-700),
			var(--color-diamond-500) 55%,
			var(--color-diamond-300)
		);
		box-shadow: 0 0 12px rgba(74, 158, 255, 0.55);
		transition: width 0.2s ease;
	}

	span::after {
		content: '';
		position: absolute;
		top: -1px;
		right: -2px;
		width: 90px;
		height: 4.5px;
		border-radius: 999px;
		background: radial-gradient(closest-side, rgba(214, 236, 255, 0.95), transparent);
		opacity: 0.9;
	}
</style>
