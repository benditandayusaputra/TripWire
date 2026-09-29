<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { lokal, t } from '$lib/bahasa.svelte';
	import { tierDariSkor } from '$lib/skor';
	import { gerakDikurangi, saatTerlihat } from '$lib/terlihat';
	import { PENGALI_POLA_SILANG, subSkor } from './simulasi';

	const CX = 170;
	const CY = 172;
	const R = 128;
	const TEBAL = 18;

	const TIER = $derived(
		[
			{ dari: 0, sampai: 30, contoh: 15 },
			{ dari: 30, sampai: 60, contoh: 45 },
			{ dari: 60, sampai: 85, contoh: 73 },
			{ dari: 85, sampai: 100, contoh: 93 }
		].map((item) => ({ ...item, info: tierDariSkor(item.contoh) }))
	);

	const PILIHAN = [
		{ sinyal: 1, pengali: 1 },
		{ sinyal: 2, pengali: 1.3 },
		{ sinyal: 3, pengali: 1.6 }
	];

	const desimal = $derived(new Intl.NumberFormat(lokal(), { maximumFractionDigits: 1 }));
	const dasar = subSkor.reduce((jumlah, item) => jumlah + item.bobot * item.nilai, 0);

	let pengali = $state(PENGALI_POLA_SILANG);
	let aktif = $state(true);
	let sorotTier = $state<string | null>(null);

	const mentah = $derived(Math.round(dasar * pengali));
	const skor = $derived(Math.min(100, mentah));
	const info = $derived(tierDariSkor(skor));
	const tampil = Tween.of(() => (aktif ? skor : 0), {
		duration: () => (gerakDikurangi() ? 0 : 1300),
		easing: cubicOut
	});

	function titik(nilai: number, r = R) {
		const sudut = Math.PI * (1 + nilai / 100);
		return [CX + r * Math.cos(sudut), CY + r * Math.sin(sudut)];
	}

	function busur(dari: number, sampai: number) {
		const [x0, y0] = titik(dari);
		const [x1, y1] = titik(sampai);
		return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
	}

	const amati = (node: HTMLElement) => {
		if (gerakDikurangi() || node.getBoundingClientRect().top < innerHeight * 0.8) return;
		aktif = false;
		return saatTerlihat(() => (aktif = true), '-20%')(node);
	};
</script>

<div class="space-y-6" {@attach amati}>
	<div class="mx-auto max-w-95">
		<svg
			viewBox="0 0 340 200"
			class="block w-full"
			role="img"
			aria-label={t(
				`Red Flag Score ${skor} dari 100, ${info.label}`,
				`Red Flag Score ${skor} out of 100, ${info.label}`
			)}
		>
			{#each TIER as item, urutan (item.dari)}
				<path
					d={busur(item.dari + (urutan ? 0.3 : 0), item.sampai - (urutan < 3 ? 0.3 : 0))}
					stroke={item.info.color}
					stroke-width={TEBAL}
					fill="none"
					class="busur"
					class:redup={(sorotTier ?? info.label) !== item.info.label}
				/>
			{/each}

			{#each [30, 60, 85] as batas (batas)}
				{@const [x, y] = titik(batas, R + TEBAL / 2 + 13)}
				<text {x} y={y + 4} text-anchor="middle" class="label-batas">{batas}</text>
			{/each}
			<text x={CX - R} y={CY + 24} text-anchor="middle" class="label-batas">0</text>
			<text x={CX + R} y={CY + 24} text-anchor="middle" class="label-batas">100</text>

			<text x={CX} y={CY - 44} text-anchor="middle" class="angka">{Math.round(tampil.current)}</text
			>
			<text x={CX} y={CY - 22} text-anchor="middle" class="label-tier" fill={info.color}
				>{info.label}</text
			>

			<g style="transform: rotate({tampil.current * 1.8}deg)" class="jarum">
				<path d="M{CX} {CY - 5} L{CX - R + 30} {CY} L{CX} {CY + 5} Z" />
				<circle cx={CX} cy={CY} r="10" />
				<circle cx={CX} cy={CY} r="3.5" class="poros" />
			</g>
		</svg>
	</div>

	<ul
		class="grid grid-cols-2 gap-2 sm:grid-cols-4"
		aria-label={t('Kategori skor', 'Score categories')}
	>
		{#each TIER as item (item.dari)}
			<li
				class="kategori border-line rounded-lg border px-3 py-2"
				class:aktif={info.label === item.info.label}
				onpointerenter={() => (sorotTier = item.info.label)}
				onpointerleave={() => (sorotTier = null)}
			>
				<span class="mb-1.5 block h-1 w-6 rounded-full" style="background:{item.info.color}"></span>
				<span class="text-ink block text-[13px] font-medium">{item.info.label}</span>
				<span class="tw-data text-muted block text-[11.5px]"
					>{item.info.range.replace(' sampai ', t(' s.d. ', ' to '))}</span
				>
			</li>
		{/each}
	</ul>

	<div class="border-line bg-void/50 space-y-4 rounded-xl border p-4">
		<div class="space-y-2">
			<p class="text-secondary text-[13px]" id="label-pola">
				{t(
					'Sinyal yang muncul berdekatan dalam 30 hari',
					'Signals appearing close together within 30 days'
				)}
			</p>
			<div class="grid grid-cols-3 gap-1.5" role="group" aria-labelledby="label-pola">
				{#each PILIHAN as item (item.sinyal)}
					<button
						type="button"
						class="pilihan"
						aria-pressed={pengali === item.pengali}
						onclick={() => (pengali = item.pengali)}
					>
						<span class="block text-[13px] font-medium">
							{t(
								`${item.sinyal} sinyal`,
								`${item.sinyal} ${item.sinyal === 1 ? 'signal' : 'signals'}`
							)}
						</span>
						<span class="tw-data block text-[12px] opacity-80">×{desimal.format(item.pengali)}</span
						>
					</button>
				{/each}
			</div>
		</div>

		<div class="tw-data text-secondary space-y-1 text-[12.5px] leading-relaxed">
			<p>
				{#each subSkor as item, urutan (item.kunci)}
					{urutan ? ' + ' : ''}<span class="whitespace-nowrap"
						>({desimal.format(item.bobot)} × {item.nilai})</span
					>
				{/each}
				<span class="whitespace-nowrap"
					>= <span class="text-ink">{desimal.format(dasar)}</span></span
				>
			</p>
			<p>
				{desimal.format(dasar)} × <span class="text-diamond-300">{desimal.format(pengali)}</span> =
				<span class="text-ink">{mentah}</span>
				{#if mentah > 100}
					<span class="text-muted">{t(', dibatasi jadi 100', ', capped at 100')}</span>
				{/if}
			</p>
		</div>
	</div>
</div>

<style>
	.busur {
		transition:
			opacity 0.3s ease,
			stroke-width 0.3s ease;
	}

	.busur.redup {
		opacity: 0.28;
	}

	.label-batas {
		font-family: var(--font-mono);
		font-size: 11px;
		fill: var(--color-muted);
	}

	.angka {
		font-family: var(--font-display);
		font-size: 50px;
		font-weight: 600;
		letter-spacing: -0.03em;
		fill: var(--color-ink);
	}

	.label-tier {
		font-size: 13px;
		font-weight: 600;
	}

	.jarum {
		transform-box: view-box;
		transform-origin: 170px 172px;
	}

	.jarum path,
	.jarum circle {
		fill: var(--color-ink);
	}

	.jarum .poros {
		fill: var(--color-base);
	}

	.kategori {
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			transform 0.2s ease;
	}

	.kategori.aktif {
		border-color: color-mix(in srgb, var(--kilau) 28%, transparent);
		background: color-mix(in srgb, var(--cahaya) 3%, transparent);
	}

	@media (hover: hover) {
		.kategori:hover {
			transform: translateY(-2px);
			border-color: color-mix(in srgb, var(--kilau) 35%, transparent);
		}
	}

	.pilihan {
		border: 1px solid var(--edge);
		border-radius: 10px;
		padding: 8px 6px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			background 0.2s ease,
			color 0.2s ease;
	}

	.pilihan[aria-pressed='true'] {
		border-color: var(--color-diamond-500);
		background: rgba(74, 158, 255, 0.12);
		color: var(--color-diamond-100);
	}

	@media (hover: hover) {
		.pilihan:hover {
			border-color: var(--color-diamond-700);
			color: var(--color-ink);
		}
	}
</style>
