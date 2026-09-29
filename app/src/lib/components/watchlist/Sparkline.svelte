<script lang="ts">
	let { nilai, warna, label }: { nilai: number[]; warna: string; label: string } = $props();

	const LEBAR = 76;
	const TINGGI = 26;

	const titik = $derived.by(() => {
		if (nilai.length === 0) return [] as [number, number][];
		const deret = nilai.length === 1 ? [nilai[0], nilai[0]] : nilai;
		const langkah = LEBAR / (deret.length - 1);
		const y = (skor: number) => 3 + (1 - skor / 100) * (TINGGI - 6);
		return deret.flatMap((skor, i): [number, number][] =>
			i === 0
				? [[0, y(skor)]]
				: [
						[i * langkah, y(deret[i - 1])],
						[i * langkah, y(skor)]
					]
		);
	});
</script>

{#if titik.length}
	<svg
		viewBox="0 0 {LEBAR} {TINGGI}"
		class="block h-[26px] w-[76px] overflow-visible"
		role="img"
		aria-label={label}
	>
		<line x1="0" x2={LEBAR} y1={TINGGI - 3} y2={TINGGI - 3} stroke="rgba(180,205,255,.1)" />
		<polyline
			points={titik.map(([x, y]) => `${x},${y}`).join(' ')}
			fill="none"
			stroke={warna}
			stroke-width="1.75"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		<circle cx={titik.at(-1)?.[0]} cy={titik.at(-1)?.[1]} r="2.5" fill={warna} />
	</svg>
{:else}
	<span class="text-muted tw-data text-[11px]" aria-label={label}>belum ada</span>
{/if}
