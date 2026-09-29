<script lang="ts">
	import type { HariNotifikasi } from '$lib/api/notifications';
	import { lokal, t } from '$lib/bahasa.svelte';
	import { labelHari } from '$lib/notifikasi';

	let { hari }: { hari: HariNotifikasi[] } = $props();

	const TINGGI = 132;
	const ATAS = 16;
	const BAWAH = 22;
	const DASAR = TINGGI - BAWAH;

	let lebar = $state(0);
	let aktif = $state<number | null>(null);

	const w = $derived(lebar || 300);
	const slot = $derived(w / Math.max(hari.length, 1));
	const tebal = $derived(Math.min(24, Math.max(3, slot * 0.62)));
	const puncak = $derived(Math.max(1, ...hari.map((satu) => satu.total)));
	const total = $derived(hari.reduce((jumlah, satu) => jumlah + satu.total, 0));
	const kritis = $derived(hari.reduce((jumlah, satu) => jumlah + satu.critical, 0));

	const batang = $derived(
		hari.map((satu, urutan) => {
			const tinggi = (satu.total / puncak) * (DASAR - ATAS);
			const x = urutan * slot + (slot - tebal) / 2;
			const y = DASAR - tinggi;
			const r = Math.min(4, tebal / 2, tinggi);
			return {
				...satu,
				x,
				y,
				jalur:
					satu.total === 0
						? ''
						: `M${x},${DASAR}V${y + r}Q${x},${y} ${x + r},${y}H${x + tebal - r}Q${x + tebal},${y} ${x + tebal},${y + r}V${DASAR}Z`
			};
		})
	);

	const rincian = [
		['critical', 'Kritis', 'Critical', 'var(--color-tier-critical)'],
		['high', 'Tinggi', 'High', 'var(--color-tier-high)'],
		['moderate', 'Sedang', 'Moderate', 'var(--color-tier-moderate)'],
		['low', 'Rendah', 'Low', 'var(--color-tier-low)'],
		['market', 'Intelijen pasar', 'Market intelligence', 'var(--color-secondary)']
	] as const;

	const sorot = $derived(aktif === null ? null : batang[aktif]);
	const posisiTip = $derived(
		sorot ? Math.min(Math.max(sorot.x + tebal / 2, 84), Math.max(w - 84, 84)) : 0
	);

	const tglPendek = (tanggal: string) =>
		new Date(`${tanggal}T12:00:00+07:00`).toLocaleDateString(lokal(), {
			day: 'numeric',
			month: 'short',
			timeZone: 'Asia/Jakarta'
		});
</script>

<div class="space-y-3">
	<div class="flex items-baseline justify-between gap-3">
		<p class="text-secondary text-[12.5px]">
			<span data-testid="aktivitas-total" class="tw-data text-ink text-[18px] font-medium"
				>{total}</span
			>
			{t(
				`notifikasi dalam ${hari.length} hari`,
				`${total === 1 ? 'alert' : 'alerts'} in ${hari.length} ${hari.length === 1 ? 'day' : 'days'}`
			)}
		</p>
		<p class="text-muted flex items-center gap-1.5 text-[11.5px]">
			<span class="titik-kritis" aria-hidden="true"></span>
			{t('Ada skor kritis', 'Critical score')}
		</p>
	</div>

	<div class="relative" bind:clientWidth={lebar}>
		<svg
			width={w}
			height={TINGGI}
			viewBox="0 0 {w} {TINGGI}"
			class="block overflow-visible"
			role="img"
			aria-label={t(
				`Notifikasi per hari selama ${hari.length} hari terakhir, total ${total}, ${kritis} berskor kritis`,
				`Alerts per day over the last ${hari.length} days, ${total} total, ${kritis} with a critical score`
			)}
		>
			<line x1="0" x2={w} y1={ATAS} y2={ATAS} class="kisi" />
			<text x={w} y={ATAS - 5} text-anchor="end" class="label-sumbu">{puncak}</text>
			<line x1="0" x2={w} y1={DASAR} y2={DASAR} class="kisi dasar" />

			{#each batang as satu, urutan (satu.date)}
				{#if satu.jalur}
					<path d={satu.jalur} class="batang" class:redup={aktif !== null && aktif !== urutan} />
				{/if}
				{#if satu.critical > 0}
					<circle cx={satu.x + tebal / 2} cy={satu.y - 8} r="4" class="penanda" />
				{/if}
				<rect
					role="presentation"
					x={urutan * slot}
					y="0"
					width={slot}
					height={DASAR}
					fill="transparent"
					onpointerenter={() => (aktif = urutan)}
					onpointerleave={() => (aktif = null)}
				/>
			{/each}

			{#if hari.length}
				<text x="0" y={TINGGI - 5} class="label-sumbu">{tglPendek(hari[0].date)}</text>
				<text x={w} y={TINGGI - 5} text-anchor="end" class="label-sumbu"
					>{t('Hari ini', 'Today')}</text
				>
			{/if}
		</svg>

		{#if sorot}
			<div class="tip" style="left:{posisiTip}px; top:{Math.max(sorot.y - 14, 0)}px" role="status">
				<p class="text-ink text-[12px] font-medium">{labelHari(sorot.date)}</p>
				<p class="text-secondary tw-data mt-0.5 text-[11.5px]">
					{t(
						`${sorot.total} notifikasi`,
						`${sorot.total} ${sorot.total === 1 ? 'alert' : 'alerts'}`
					)}
				</p>
				{#each rincian as [kunci, label, labelEn, warna] (kunci)}
					{#if sorot[kunci] > 0}
						<p class="text-secondary mt-1 flex items-center gap-1.5 text-[11.5px]">
							<span class="kotak" style="background:{warna}"></span>
							{t(label, labelEn)}
							<span class="tw-data text-ink ml-auto pl-3">{sorot[kunci]}</span>
						</p>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<div class="sr-only">
		<table>
			<caption>{t('Jumlah notifikasi per hari', 'Alerts per day')}</caption>
			<thead>
				<tr
					><th>{t('Tanggal', 'Date')}</th><th>Total</th
					>{#each rincian as [kunci, label, labelEn] (kunci)}<th>{t(label, labelEn)}</th>{/each}</tr
				>
			</thead>
			<tbody>
				{#each hari as satu (satu.date)}
					<tr>
						<td>{satu.date}</td><td>{satu.total}</td><td>{satu.critical}</td><td>{satu.high}</td>
						<td>{satu.moderate}</td><td>{satu.low}</td><td>{satu.market}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.kisi {
		stroke: color-mix(in srgb, var(--kilau) 10%, transparent);
		stroke-width: 1;
	}

	.kisi.dasar {
		stroke: color-mix(in srgb, var(--kilau) 22%, transparent);
	}

	.label-sumbu {
		fill: var(--color-muted);
		font-family: var(--font-mono);
		font-size: 10.5px;
	}

	.batang {
		fill: var(--color-diamond-500);
		transition: opacity 0.2s ease;
	}

	.batang.redup {
		opacity: 0.35;
	}

	.penanda {
		fill: var(--color-tier-critical);
		stroke: var(--color-base);
		stroke-width: 2;
		pointer-events: none;
	}

	.titik-kritis {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--color-tier-critical);
	}

	.tip {
		position: absolute;
		z-index: 2;
		min-width: 150px;
		transform: translate(-50%, -100%);
		border: 1px solid var(--edge-strong);
		border-radius: 10px;
		background: var(--color-raised);
		padding: 8px 10px;
		box-shadow: 0 16px 32px -16px var(--bayang);
		pointer-events: none;
	}

	.kotak {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 2px;
	}
</style>
