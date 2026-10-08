<script lang="ts">
	import { Layers } from 'lucide-svelte';
	import { t } from '$lib/bahasa.svelte';
	import Panel from './Panel.svelte';
	import { formatPersen, kataArah, kelasArah } from '$lib/dashboard';
	import type { RingkasanPasar } from '$lib/pasar';
	import { NAMA_SEKTOR } from '$lib/watchlist';

	let {
		pasar,
		memuat,
		sektorWatchlist,
		class: kelas = ''
	}: {
		pasar: RingkasanPasar | null;
		memuat: boolean;
		sektorWatchlist: string[];
		class?: string;
	} = $props();

	const puncak = $derived(
		Math.max(0.001, ...(pasar?.sektor ?? []).map((satu) => Math.abs(satu.ubah)))
	);
	const namaSektor = (nama: string) => NAMA_SEKTOR[nama] ?? nama;
</script>

<Panel
	judul={t('Kinerja sektor', 'Sector performance')}
	keterangan={t(
		'Rata rata perubahan harian, saham besar lebih berpengaruh',
		'Market cap weighted daily change'
	)}
	ikon={Layers}
	testid="panel-sektor"
	class={kelas}
>
	{#if pasar?.sektor.length}
		<ul class="space-y-2.5">
			{#each pasar.sektor as satu (satu.nama)}
				{@const ubah = formatPersen(satu.ubah)}
				{@const lebar = (Math.abs(satu.ubah) / puncak) * 50}
				<li
					data-testid="sektor-item"
					data-sektor={satu.nama}
					class="baris"
					title={t(
						`${satu.jumlah} saham, ${satu.naik} naik, ${satu.turun} turun`,
						`${satu.jumlah} stocks, ${satu.naik} up, ${satu.turun} down`
					)}
				>
					<span class="min-w-0">
						<span class="flex items-center gap-1.5">
							<span class="text-secondary truncate text-[12.5px]">{namaSektor(satu.nama)}</span>
							{#if sektorWatchlist.includes(satu.nama)}
								<span
									class="bg-diamond-500 size-1.5 flex-none rounded-full"
									title={t(
										'Ada saham watchlist kamu di sektor ini',
										'Your watchlist has stocks in this sector'
									)}
								></span>
							{/if}
						</span>
						<span
							class="sumbu"
							role="img"
							aria-label={t(
								`${namaSektor(satu.nama)} ${kataArah(ubah.arah)} ${ubah.angka}`,
								`${namaSektor(satu.nama)} ${kataArah(ubah.arah)} ${ubah.angka}`
							)}
						>
							<span
								class="batang {ubah.arah < 0 ? 'bg-turun kiri' : 'bg-naik'}"
								style="width:{Math.max(lebar, ubah.arah === 0 ? 0 : 1.5)}%"
							></span>
						</span>
					</span>
					<span class="tw-data w-[76px] text-right text-[12px] {kelasArah(ubah.arah)}"
						>{ubah.teks}</span
					>
				</li>
			{/each}
		</ul>
		<p class="text-muted mt-4 flex items-center gap-2 text-[11.5px]">
			<span class="bg-diamond-500 size-1.5 rounded-full" aria-hidden="true"></span>
			{t('Sektor yang memuat saham watchlist kamu', 'Sectors holding your watchlist stocks')}
		</p>
	{:else if memuat}
		<ul class="space-y-3" aria-hidden="true">
			{#each [0, 1, 2, 3, 4, 5] as urutan (urutan)}
				<li class="kerangka"></li>
			{/each}
		</ul>
	{:else}
		<p class="text-muted text-[13px]">
			{t(
				'Kinerja sektor belum bisa dimuat dari Sectors.',
				'Sector performance could not be loaded from Sectors.'
			)}
		</p>
	{/if}
</Panel>

<style>
	.baris {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 12px;
	}

	.sumbu {
		position: relative;
		display: block;
		height: 6px;
		margin-top: 5px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 7%, transparent);
	}

	.sumbu::after {
		content: '';
		position: absolute;
		top: -3px;
		bottom: -3px;
		left: 50%;
		width: 1px;
		background: var(--edge-strong);
	}

	.batang {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		border-radius: 0 999px 999px 0;
		transform-origin: left;
		animation: tumbuh 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
	}

	.batang.kiri {
		right: 50%;
		left: auto;
		border-radius: 999px 0 0 999px;
		transform-origin: right;
	}

	.kerangka {
		height: 24px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
		animation: denyut 1.4s ease-in-out infinite;
	}

	@keyframes tumbuh {
		from {
			transform: scaleX(0);
		}
	}

	@keyframes denyut {
		50% {
			opacity: 0.45;
		}
	}
</style>
