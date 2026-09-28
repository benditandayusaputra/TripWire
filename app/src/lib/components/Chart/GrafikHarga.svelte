<script lang="ts">
	let { seri }: { seri: { date: string; price: number }[] } = $props();

	const id = $props.id();
	const LEBAR = 320;
	const TINGGI = 92;

	const titik = $derived.by(() => {
		if (seri.length < 2) return [] as [number, number][];
		const harga = seri.map((item) => item.price);
		const bawah = Math.min(...harga);
		const rentang = Math.max(...harga) - bawah || 1;
		return seri.map((item, urutan): [number, number] => [
			Math.round((urutan / (seri.length - 1)) * LEBAR * 10) / 10,
			Math.round((TINGGI - 14 - ((item.price - bawah) / rentang) * (TINGGI - 28)) * 10) / 10
		]);
	});

	const garis = $derived(titik.map(([x, y]) => `${x},${y}`).join(' '));
	const bidang = $derived(`${garis} ${LEBAR},${TINGGI} 0,${TINGGI}`);
	const terakhir = $derived(titik.at(-1));

	const label = $derived.by(() => {
		if (seri.length === 0) return [] as string[];
		const pilih = [seri[0], seri[Math.floor((seri.length - 1) / 2)], seri[seri.length - 1]];
		return pilih.map((item) =>
			new Date(item.date)
				.toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' })
				.toUpperCase()
		);
	});
</script>

{#if titik.length > 1}
	<svg
		viewBox="0 0 {LEBAR} {TINGGI}"
		preserveAspectRatio="none"
		class="block h-[92px] w-full"
		role="img"
		aria-label="Grafik harga komoditas"
	>
		<defs>
			<linearGradient id="isi-{id}" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" style="stop-color: var(--color-diamond-500)" stop-opacity="0.3" />
				<stop offset="100%" style="stop-color: var(--color-diamond-500)" stop-opacity="0" />
			</linearGradient>
		</defs>
		{#each [23, 46, 69] as y (y)}
			<line x1="0" y1={y} x2={LEBAR} y2={y} stroke="rgba(180,205,255,.09)" />
		{/each}
		<polygon points={bidang} fill="url(#isi-{id})" />
		<polyline
			points={garis}
			fill="none"
			class="stroke-diamond-500"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
		{#if terakhir}
			<circle cx={terakhir[0]} cy={terakhir[1]} r="4" class="fill-diamond-500 stroke-void" stroke-width="2" />
		{/if}
	</svg>
	<div class="tw-data text-muted mt-1.5 flex justify-between text-[9.5px]">
		{#each label as teks, urutan (urutan)}
			<span>{teks}</span>
		{/each}
	</div>
{/if}
