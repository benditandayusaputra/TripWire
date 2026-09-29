<script lang="ts">
	import { Activity } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import { formatDesimal, formatPersen, kelasArah } from '$lib/dashboard';
	import type { RingkasanPasar } from '$lib/pasar';
	import { NAMA_SEKTOR, formatRupiah } from '$lib/watchlist';

	let {
		pasar,
		memuat,
		class: kelas = ''
	}: { pasar: RingkasanPasar | null; memuat: boolean; class?: string } = $props();

	const total = $derived(pasar ? pasar.naik + pasar.turun + pasar.tetap : 0);
	const ubah = $derived(formatPersen(pasar?.ubah));
	const rasio = $derived(pasar && pasar.turun > 0 ? pasar.naik / pasar.turun : null);
	const terkuat = $derived(pasar?.sektor[0] ?? null);
	const terlemah = $derived(pasar && pasar.sektor.length > 1 ? pasar.sektor.at(-1) : null);
	const suasana = $derived.by(() => {
		if (!pasar || !total) return '';
		const porsi = pasar.naik / total;
		if (porsi >= 0.55) return t('Mayoritas saham menguat', 'Most stocks advanced');
		if (pasar.turun / total >= 0.55) return t('Mayoritas saham melemah', 'Most stocks declined');
		return t('Pasar bergerak campuran', 'Mixed session');
	});

	const namaSektor = (nama: string) => NAMA_SEKTOR[nama] ?? nama;

	const WARNA_SEBARAN = [
		'var(--color-turun)',
		'color-mix(in srgb, var(--color-turun) 72%, transparent)',
		'color-mix(in srgb, var(--color-turun) 45%, transparent)',
		'color-mix(in srgb, var(--kilau) 28%, transparent)',
		'color-mix(in srgb, var(--color-naik) 45%, transparent)',
		'color-mix(in srgb, var(--color-naik) 72%, transparent)',
		'var(--color-naik)'
	];
	const TICK_SEBARAN = [
		{ posisi: 1, label: '-5%' },
		{ posisi: 2, label: '-2%' },
		{ posisi: 3.5, label: '0' },
		{ posisi: 5, label: '+2%' },
		{ posisi: 6, label: '+5%' }
	];

	const labelKelompok = $derived([
		t('turun 5% atau lebih', 'down 5% or more'),
		t('turun 2 sampai 5%', 'down 2 to 5%'),
		t('turun kurang dari 2%', 'down less than 2%'),
		t('tidak berubah', 'unchanged'),
		t('naik kurang dari 2%', 'up less than 2%'),
		t('naik 2 sampai 5%', 'up 2 to 5%'),
		t('naik 5% atau lebih', 'up 5% or more')
	]);
	const puncakSebaran = $derived(Math.max(1, ...(pasar?.sebaran ?? [])));
</script>

<Panel
	judul={t('Denyut pasar', 'Market pulse')}
	keterangan={t(
		'Semua saham BEI dari screener Sectors',
		'All IDX stocks from the Sectors screener'
	)}
	ikon={Activity}
	testid="panel-denyut"
	class={kelas}
>
	{#if pasar}
		<div class="space-y-5">
			<div>
				<p class="text-muted text-[12px]">
					{t('Kapitalisasi pasar BEI', 'IDX market capitalization')}
				</p>
				<p class="mt-1 flex flex-wrap items-baseline gap-x-2.5">
					<span class="tw-data text-ink text-[26px] leading-none font-medium"
						>{formatRupiah(pasar.kapitalisasi)}</span
					>
					<span class="tw-data text-[13px] {kelasArah(ubah.arah)}">{ubah.teks}</span>
				</p>
				<p class="text-secondary mt-1.5 text-[12.5px]">{suasana}</p>
			</div>

			<div>
				<div class="flex items-baseline justify-between gap-3 text-[12px]">
					<span class="text-muted">{t('Pergerakan saham', 'Advancers and decliners')}</span>
					<span class="tw-data text-muted">{total} {t('saham', 'stocks')}</span>
				</div>
				<div
					data-testid="lebar-pasar"
					class="batang mt-2"
					role="img"
					aria-label={t(
						`${pasar.naik} saham naik, ${pasar.turun} turun, ${pasar.tetap} tetap`,
						`${pasar.naik} stocks up, ${pasar.turun} down, ${pasar.tetap} unchanged`
					)}
				>
					<span class="bg-naik" style="flex:{pasar.naik}"></span>
					<span class="tetap" style="flex:{pasar.tetap}"></span>
					<span class="bg-turun" style="flex:{pasar.turun}"></span>
				</div>
				<ul class="tw-data mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px]">
					<li class="text-naik">
						▲ {pasar.naik} <span class="text-muted">{t('naik', 'up')}</span>
					</li>
					<li class="text-secondary">
						■ {pasar.tetap} <span class="text-muted">{t('tetap', 'flat')}</span>
					</li>
					<li class="text-turun">
						▼ {pasar.turun} <span class="text-muted">{t('turun', 'down')}</span>
					</li>
				</ul>
				{#if rasio !== null}
					<p class="text-muted mt-1.5 text-[11.5px]">
						{t('Rasio naik banding turun', 'Advance to decline ratio')}
						<span class="tw-data text-secondary">{formatDesimal(rasio)}</span>
					</p>
				{/if}
			</div>

			<div>
				<p class="text-muted text-[12px]">
					{t('Sebaran perubahan harian', 'Daily change distribution')}
				</p>
				<div
					data-testid="sebaran-perubahan"
					class="histogram mt-2"
					role="img"
					aria-label={pasar.sebaran
						.map((jumlah, urutan) =>
							t(
								`${jumlah} saham ${labelKelompok[urutan]}`,
								`${jumlah} stocks ${labelKelompok[urutan]}`
							)
						)
						.join(', ')}
				>
					{#each pasar.sebaran as jumlah, urutan (urutan)}
						<span class="kolom" title="{jumlah} {labelKelompok[urutan]}">
							<span class="tw-data text-muted text-[10px]">{jumlah}</span>
							<span
								class="bar"
								style="height:{Math.max(
									4,
									(jumlah / puncakSebaran) * 100
								)}%; background:{WARNA_SEBARAN[urutan]}"
							></span>
						</span>
					{/each}
				</div>
				<div class="sumbu-sebaran" aria-hidden="true">
					{#each TICK_SEBARAN as tick (tick.label)}
						<span style="left:{(tick.posisi / 7) * 100}%">{tick.label}</span>
					{/each}
				</div>
			</div>

			{#if terkuat}
				<dl class="border-line grid grid-cols-2 gap-3 border-t pt-4">
					{#each [{ label: t('Sektor terkuat', 'Strongest sector'), sektor: terkuat }, ...(terlemah ? [{ label: t('Sektor terlemah', 'Weakest sector'), sektor: terlemah }] : [])] as satu (satu.label)}
						{@const ubahSektor = formatPersen(satu.sektor.ubah)}
						<div class="min-w-0">
							<dt class="text-muted text-[11.5px]">{satu.label}</dt>
							<dd class="text-ink mt-0.5 truncate text-[13.5px] font-medium">
								{namaSektor(satu.sektor.nama)}
							</dd>
							<dd class="tw-data text-[12px] {kelasArah(ubahSektor.arah)}">{ubahSektor.teks}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</div>
	{:else if memuat}
		<div class="space-y-4" aria-hidden="true">
			<span class="kerangka h-7 w-40"></span>
			<span class="kerangka h-3 w-full"></span>
			<span class="kerangka h-16 w-full"></span>
		</div>
	{:else}
		<p class="text-muted text-[13px]">
			{t(
				'Data seluruh pasar belum bisa dimuat dari Sectors. Watchlist kamu tetap diperbarui.',
				'Market-wide data could not be loaded from Sectors. Your watchlist is still updated.'
			)}
		</p>
	{/if}
</Panel>

<style>
	.batang {
		display: flex;
		height: 8px;
		gap: 2px;
		overflow: hidden;
		border-radius: 999px;
	}

	.batang span {
		min-width: 2px;
	}

	.tetap {
		background: color-mix(in srgb, var(--kilau) 22%, transparent);
	}

	.histogram {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		height: 76px;
		gap: 4px;
		align-items: end;
		border-bottom: 1px solid var(--edge);
	}

	.kolom {
		display: flex;
		height: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
	}

	.bar {
		width: 100%;
		max-height: calc(100% - 16px);
		border-radius: 4px 4px 0 0;
		transform-origin: bottom;
		animation: tumbuh 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
	}

	.sumbu-sebaran {
		position: relative;
		height: 16px;
		margin-top: 4px;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--color-muted);
	}

	.sumbu-sebaran span {
		position: absolute;
		transform: translateX(-50%);
	}

	@keyframes tumbuh {
		from {
			transform: scaleY(0);
		}
	}

	.kerangka {
		display: block;
		border-radius: 8px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
		animation: denyut 1.4s ease-in-out infinite;
	}

	@keyframes denyut {
		50% {
			opacity: 0.45;
		}
	}
</style>
