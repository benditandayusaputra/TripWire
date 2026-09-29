<script lang="ts" module>
	export type LangkahTur = { target?: string; judul: string; isi: string };
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { gerakDikurangi } from '$lib/terlihat';
	import { t } from '$lib/bahasa.svelte';

	let {
		langkah,
		buka = $bindable(false),
		onselesai
	}: { langkah: LangkahTur[]; buka?: boolean; onselesai: () => void } = $props();

	type Kotak = { x: number; y: number; w: number; h: number };

	let aktif = $state<LangkahTur[]>([]);
	let ke = $state(0);
	let sorot = $state<Kotak | null>(null);
	let kartu = $state<HTMLElement>();
	let lanjut = $state<HTMLButtonElement>();
	let tinggiKartu = $state(0);
	let lebarLayar = $state(1024);
	let tinggiLayar = $state(768);
	let asal: HTMLElement | null = null;
	let bingkai = 0;

	const sekarang = $derived(aktif[ke]);
	const terakhir = $derived(ke === aktif.length - 1);

	const posisi = $derived.by(() => {
		const lebar = Math.min(380, lebarLayar - 32);
		const tinggi = tinggiKartu || 230;
		if (!sorot) {
			return {
				kiri: (lebarLayar - lebar) / 2,
				atas: Math.max(16, (tinggiLayar - tinggi) / 2),
				lebar
			};
		}
		const kiri = Math.min(Math.max(16, sorot.x + sorot.w / 2 - lebar / 2), lebarLayar - 16 - lebar);
		const bawah = sorot.y + sorot.h + 12;
		const atas =
			bawah + tinggi <= tinggiLayar - 16
				? bawah
				: sorot.y - 12 - tinggi >= 16
					? sorot.y - 12 - tinggi
					: tinggiLayar - 16 - tinggi;
		return { kiri, atas, lebar };
	});

	function cari(target?: string) {
		if (!target) return null;
		return (
			[...document.querySelectorAll<HTMLElement>(target)].find(
				(elemen) => elemen.getClientRects().length > 0
			) ?? null
		);
	}

	export function mulai() {
		aktif = langkah.filter((satu) => !satu.target || cari(satu.target));
		if (!aktif.length) return;
		asal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		ke = 0;
		buka = true;
		cancelAnimationFrame(bingkai);
		ikuti();
		tampilkan();
	}

	function tutup() {
		buka = false;
		cancelAnimationFrame(bingkai);
		sorot = null;
		onselesai();
		asal?.focus();
	}

	async function tampilkan() {
		await tick();
		cari(sekarang?.target)?.scrollIntoView({
			block: 'center',
			behavior: gerakDikurangi() ? 'auto' : 'smooth'
		});
		lanjut?.focus({ preventScroll: true });
	}

	function pindah(arah: number) {
		const tujuan = ke + arah;
		if (tujuan < 0) return;
		if (tujuan >= aktif.length) return tutup();
		ke = tujuan;
		tampilkan();
	}

	function ikuti() {
		const kotak = cari(sekarang?.target)?.getBoundingClientRect();
		const baru = kotak
			? {
					x: Math.round(kotak.left - 6),
					y: Math.round(kotak.top - 6),
					w: Math.round(kotak.width + 12),
					h: Math.round(kotak.height + 12)
				}
			: null;
		if (
			baru?.x !== sorot?.x ||
			baru?.y !== sorot?.y ||
			baru?.w !== sorot?.w ||
			baru?.h !== sorot?.h
		) {
			sorot = baru;
		}
		bingkai = requestAnimationFrame(ikuti);
	}

	function tombol(event: KeyboardEvent) {
		if (!buka) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			tutup();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			pindah(1);
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			pindah(-1);
		} else if (event.key === 'Tab' && kartu) {
			const tombolKartu = [...kartu.querySelectorAll<HTMLButtonElement>('button')];
			const pertama = tombolKartu[0];
			const akhir = tombolKartu[tombolKartu.length - 1];
			if (event.shiftKey && document.activeElement === pertama) {
				event.preventDefault();
				akhir.focus();
			} else if (!event.shiftKey && document.activeElement === akhir) {
				event.preventDefault();
				pertama.focus();
			} else if (!kartu.contains(document.activeElement)) {
				event.preventDefault();
				pertama.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={tombol} bind:innerWidth={lebarLayar} bind:innerHeight={tinggiLayar} />

{#if buka && sekarang}
	<div class="tur" data-testid="tur-watchlist">
		<div class="penutup" class:redup={!sorot}></div>
		{#if sorot}
			<div
				class="sorot"
				data-testid="tur-sorot"
				style="left:{sorot.x}px; top:{sorot.y}px; width:{sorot.w}px; height:{sorot.h}px"
				aria-hidden="true"
			></div>
		{/if}

		<div
			bind:this={kartu}
			bind:clientHeight={tinggiKartu}
			class="kartu"
			role="dialog"
			aria-modal="true"
			aria-labelledby="judul-tur"
			aria-describedby="isi-tur"
			style="left:{posisi.kiri}px; top:{posisi.atas}px; width:{posisi.lebar}px"
		>
			<div class="flex items-center justify-between gap-3">
				<p class="tw-data text-diamond-300 flex items-center gap-2 text-[11.5px]">
					<Mark size={9} />
					{t(`Langkah ${ke + 1} dari ${aktif.length}`, `Step ${ke + 1} of ${aktif.length}`)}
				</p>
				<button type="button" class="lewati" onclick={tutup}>{t('Lewati tur', 'Skip tour')}</button>
			</div>

			<div aria-live="polite">
				{#key ke}
					<div in:fly={{ y: 6, duration: 220 }}>
						<h2 id="judul-tur" class="tw-heading text-ink mt-2.5 text-[18px]">{sekarang.judul}</h2>
						<p id="isi-tur" class="text-secondary mt-1.5 text-[13.5px] leading-relaxed">
							{sekarang.isi}
						</p>
					</div>
				{/key}
			</div>

			<div class="mt-4 flex items-center justify-between gap-3">
				<span class="titik" aria-hidden="true">
					{#each aktif as satu, urutan (satu.judul)}
						<span class:aktif={urutan === ke}></span>
					{/each}
				</span>
				<span class="flex gap-2">
					{#if ke > 0}
						<button
							type="button"
							class="tw-ghost px-3 py-1.5 text-[13px]"
							onclick={() => pindah(-1)}
						>
							<ArrowLeft class="size-3.5" aria-hidden="true" />
							{t('Kembali', 'Back')}
						</button>
					{/if}
					<button
						bind:this={lanjut}
						type="button"
						data-testid="tur-lanjut"
						class="tw-primary px-3.5 py-1.5 text-[13px]"
						onclick={() => pindah(1)}
					>
						{terakhir ? t('Mulai memantau', 'Start monitoring') : t('Lanjut', 'Next')}
						{#if !terakhir}<ArrowRight class="size-3.5" aria-hidden="true" />{/if}
					</button>
				</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.tur {
		position: fixed;
		inset: 0;
		z-index: 70;
	}

	.penutup {
		position: absolute;
		inset: 0;
	}

	.penutup.redup {
		background: var(--tirai);
		backdrop-filter: blur(2px);
	}

	.sorot {
		position: absolute;
		border-radius: 16px;
		box-shadow:
			0 0 0 9999px var(--tirai),
			0 0 0 2px var(--color-diamond-500),
			0 0 36px 6px rgba(74, 158, 255, 0.32);
		pointer-events: none;
	}

	.kartu {
		position: absolute;
		border: 1px solid var(--edge-strong);
		border-radius: 18px;
		background: linear-gradient(180deg, var(--color-raised), var(--color-base));
		padding: 16px 18px 16px;
		box-shadow: 0 30px 80px -24px color-mix(in srgb, var(--bayang) 85%, transparent);
	}

	.lewati {
		border-radius: 8px;
		padding: 2px 6px;
		font-size: 12.5px;
		color: var(--color-muted);
		transition: color 0.2s ease;
	}

	.lewati:hover {
		color: var(--color-ink);
	}

	.titik {
		display: flex;
		gap: 5px;
	}

	.titik span {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--edge-strong);
		transition:
			width 0.25s ease,
			background 0.25s ease;
	}

	.titik span.aktif {
		width: 18px;
		background: var(--color-diamond-500);
	}
</style>
