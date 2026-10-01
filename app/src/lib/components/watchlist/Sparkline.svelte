<script lang="ts">
	let { nilai, label }: { nilai: number[]; label: string } = $props();

	const id = $props.id();
	const LEBAR = 72;
	const TINGGI = 28;

	const arah = $derived(Math.sign(nilai[nilai.length - 1] - nilai[0]));
	const titik = $derived.by(() => {
		const rendah = Math.min(...nilai);
		const rentang = Math.max(...nilai) - rendah || 1;
		const langkah = LEBAR / (nilai.length - 1);
		return nilai.map((harga, i) => [
			i * langkah,
			3 + (1 - (harga - rendah) / rentang) * (TINGGI - 6)
		]);
	});
	const garis = $derived(
		titik.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
	);
</script>

<svg
	viewBox="0 0 {LEBAR} {TINGGI}"
	class="tren"
	data-testid="tren-harga"
	data-arah={arah > 0 ? 'naik' : arah < 0 ? 'turun' : 'datar'}
	preserveAspectRatio="none"
	role="img"
	aria-label={label}
>
	<defs>
		<linearGradient id="isi-{id}" x1="0" x2="0" y1="0" y2="1">
			<stop offset="0" stop-color="currentColor" stop-opacity="0.26" />
			<stop offset="1" stop-color="currentColor" stop-opacity="0" />
		</linearGradient>
	</defs>
	<line x1="0" x2={LEBAR} y1={titik[0][1]} y2={titik[0][1]} class="dasar" />
	<path d="{garis}L{LEBAR} {TINGGI}L0 {TINGGI}Z" fill="url(#isi-{id})" class="area" />
	<path d={garis} pathLength="1" class="jejak" />
</svg>

<style>
	.tren {
		display: block;
		width: 100%;
		height: 28px;
		overflow: visible;
		color: var(--color-muted);
	}

	.tren[data-arah='naik'] {
		color: var(--color-naik);
	}

	.tren[data-arah='turun'] {
		color: var(--color-turun);
	}

	.dasar {
		stroke: color-mix(in srgb, var(--kilau) 22%, transparent);
		stroke-dasharray: 2 3;
		vector-effect: non-scaling-stroke;
	}

	.jejak {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-dasharray: 1;
		animation: gambar 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.area {
		animation: muncul 0.9s ease both 0.2s;
	}

	@keyframes gambar {
		from {
			stroke-dashoffset: 1;
		}
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes muncul {
		from {
			opacity: 0;
		}
	}
</style>
