<script lang="ts">
	import { ArrowRight, Layers, ListChecks } from 'lucide-svelte';
	import KondisiLabel from '$lib/components/KondisiLabel.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import GrafikSkor from './GrafikSkor.svelte';
	import { arahHarga, formatHarga, labelSektor, posisiRentang, type Baris } from '$lib/dashboard';
	import { formatAngka, formatRingkas, formatTanggalSaja, labelSinyal } from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';

	let { baris }: { baris: Baris } = $props();

	const kutipan = $derived(baris.kutipan);
	const ubah = $derived(arahHarga(kutipan?.daily_close_change));
	const rentang = $derived(posisiRentang(kutipan));
	const payload = $derived(baris.redFlag?.payload);
	const subSkor = $derived(Object.entries(payload?.sub_scores ?? {}));
	const pola = $derived(payload?.cross_pattern);
	const freeFloat = $derived(payload?.supporting_data?.free_float_pct);
	const insightTerbaru = $derived(baris.redFlag ?? baris.pasar);

	const statistik = $derived(
		[
			kutipan?.market_cap ? ['Kapitalisasi pasar', `Rp${formatRingkas(kutipan.market_cap)}`] : null,
			kutipan?.market_cap_rank ? ['Peringkat kapitalisasi', `#${kutipan.market_cap_rank}`] : null,
			freeFloat !== undefined ? ['Saham publik', `${formatAngka(freeFloat, 1)}%`] : null,
			baris.sektor ? ['Sektor', labelSektor(baris.sektor)] : null
		].filter((item): item is string[] => item !== null)
	);
</script>

<div data-testid="sorotan-emiten" data-ticker={baris.ticker} class="space-y-5">
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 space-y-1">
			<div class="flex items-center gap-2">
				<span
					class="tw-data bg-raised text-ink rounded-md px-2 py-0.5 text-[13px] font-semibold tracking-wide"
				>
					{baris.ticker}
				</span>
				<span class="text-secondary truncate text-[13px]">{baris.nama}</span>
			</div>
			{#if kutipan}
				<p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
					<span class="tw-data text-ink text-[28px] leading-none font-medium">
						{formatHarga(kutipan.last_close_price)}
					</span>
					{#if ubah}
						<span class="tw-data text-[13px] font-medium {ubah.kelas}" aria-label={ubah.label}
							>{ubah.teks}</span
						>
					{/if}
				</p>
				{#if kutipan.latest_close_date}
					<p class="text-muted text-[11.5px]">
						Harga penutupan {formatTanggalSaja(kutipan.latest_close_date)}
					</p>
				{/if}
			{:else}
				<p class="text-muted pt-1 text-[12.5px]">
					Harga tampil setelah pemindaian pertama emiten ini.
				</p>
			{/if}
		</div>
		<div class="flex-none">
			<SkorBadge skor={baris.skor} size="lg" />
		</div>
	</div>

	<div class="space-y-2">
		<p class="tw-overline flex items-center justify-between gap-2">
			Riwayat Red Flag Score
			<span class="tracking-normal normal-case">{baris.riwayat.length} catatan</span>
		</p>
		<GrafikSkor riwayat={baris.riwayat} ambang={baris.ambang} ticker={baris.ticker} />
	</div>

	{#if subSkor.length}
		<div class="space-y-2.5">
			<p class="tw-overline">Komponen skor</p>
			<ul class="space-y-2">
				{#each subSkor as [kunci, nilai] (kunci)}
					<li class="grid grid-cols-[minmax(0,1fr)_88px_28px] items-center gap-3">
						<span class="text-secondary truncate text-[12.5px]">{labelSinyal(kunci)}</span>
						<span class="lajur">
							<span
								class="isi"
								style="width:{Math.max(nilai, 3)}%; background:{tierDariSkor(nilai).color}"
							></span>
						</span>
						<span class="tw-data text-ink text-right text-[12px]">{Math.round(nilai)}</span>
					</li>
				{/each}
			</ul>
			{#if pola?.multiplier_applied && pola.multiplier_applied > 1}
				<p class="text-secondary flex items-start gap-2 pt-1 text-[12px] leading-snug">
					<Layers class="text-diamond-300 mt-0.5 size-3.5 flex-none" aria-hidden="true" />
					{pola.signals_active_in_window ?? pola.active_signals?.length} sinyal muncul dalam {pola.window_days ??
						30}
					hari, skor dikali {formatAngka(pola.multiplier_applied, 1)}.
				</p>
			{/if}
		</div>
	{/if}

	{#if rentang}
		<div class="space-y-2">
			<p class="tw-overline">Rentang 52 minggu</p>
			<div class="flex items-center gap-3">
				<span class="tw-data text-muted text-[11.5px]">{formatHarga(rentang.rendah)}</span>
				<span class="rentang">
					<span class="penanda" style="left:{rentang.posisi * 100}%"></span>
				</span>
				<span class="tw-data text-muted text-[11.5px]">{formatHarga(rentang.tinggi)}</span>
			</div>
		</div>
	{/if}

	{#if statistik.length}
		<dl class="grid grid-cols-2 gap-x-4 gap-y-3">
			{#each statistik as [label, nilai] (label)}
				<div class="min-w-0">
					<dt class="text-muted text-[11.5px]">{label}</dt>
					<dd class="tw-data text-ink mt-0.5 truncate text-[13.5px]">{nilai}</dd>
				</div>
			{/each}
		</dl>
	{/if}

	{#if kutipan?.indices.length}
		<ul class="flex flex-wrap gap-1.5" aria-label="Indeks yang memuat {baris.ticker}">
			{#each kutipan.indices.slice(0, 6) as indeks (indeks)}
				<li class="chip">{indeks}</li>
			{/each}
		</ul>
	{/if}

	<div class="border-line space-y-3 border-t pt-4">
		<p class="text-[12.5px] leading-relaxed">
			{#if baris.kondisiAktif.length}
				<span class="text-muted">Dipantau:</span>
				<KondisiLabel
					type={baris.kondisiAktif[0].condition_type}
					config={baris.kondisiAktif[0].config}
				/>
				{#if baris.kondisiAktif.length > 1}
					<span class="text-muted">dan {baris.kondisiAktif.length - 1} kondisi lain</span>
				{/if}
			{:else}
				<span class="text-secondary"
					>Belum ada kondisi pemicu, jadi emiten ini belum ikut dipindai.</span
				>
			{/if}
		</p>
		<div class="flex flex-wrap gap-2">
			{#if insightTerbaru}
				<a href="/insights/{insightTerbaru.id}" class="tw-primary px-3.5 py-2 text-[13px]">
					Buka insight terbaru
					<ArrowRight class="size-3.5" aria-hidden="true" />
				</a>
			{/if}
			<a href="/watchlist" class="tw-ghost px-3.5 py-2 text-[13px]">
				<ListChecks class="size-3.5" aria-hidden="true" />
				Atur kondisi
			</a>
		</div>
	</div>
</div>

<style>
	.lajur {
		position: relative;
		height: 6px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.08);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transform-origin: left;
		animation: isi 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s backwards;
	}

	@keyframes isi {
		from {
			transform: scaleX(0);
		}
	}

	.rentang {
		position: relative;
		height: 4px;
		flex: 1;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.14);
	}

	.penanda {
		position: absolute;
		top: 50%;
		width: 11px;
		height: 11px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}

	.chip {
		border: 1px solid var(--edge);
		border-radius: 999px;
		padding: 2px 9px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-secondary);
	}
</style>
