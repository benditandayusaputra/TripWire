<script lang="ts">
	import { ArrowLeft, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import {
		formatTanggal,
		formatTanggalSaja,
		judulInsight,
		labelSinyal,
		labelSubtype
	} from '$lib/insight';
	import { tierDariSkor } from '$lib/skor';

	let { data } = $props();

	const insight = $derived(data.insight);
	const payload = $derived(insight.payload ?? {});
	const verifikasi = $derived(data.verification);
	const tier = $derived(tierDariSkor(insight.score));
	const pola = $derived(payload.cross_pattern);

	const subSkor = $derived(Object.entries(payload.sub_scores ?? {}));

	const suspensi = $derived(
		(payload.supporting_data?.suspensions ?? []) as {
			date: string;
			reason: string;
			severity_tier: number;
		}[]
	);

	const insider = $derived(
		(payload.supporting_data?.insider_transactions ?? []) as {
			date: string;
			holder_name: string;
			transaction_type: string;
			transaction_value: number;
		}[]
	);

	const kepemilikan = $derived(
		(payload.supporting_data?.ownership_snapshots ?? []) as {
			date: string;
			top_holder_name: string;
			top_holder_percentage: number;
		}[]
	);

	function rupiah(nilai: number) {
		return new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(
			nilai
		);
	}
</script>

<svelte:head>
	<title>{insight.ticker} · Detail insight TripWire</title>
</svelte:head>

<section class="space-y-6">
	<a
		href="/dashboard"
		class="text-secondary hover:text-ink inline-flex items-center gap-1.5 text-[13.5px] transition"
	>
		<ArrowLeft class="size-3.5" aria-hidden="true" />
		Kembali ke dashboard
	</a>

	<DisclaimerBar />

	<header class="tw-card space-y-5 p-6">
		<div class="flex flex-wrap items-start gap-5">
			<SkorBadge skor={insight.score} size="lg" />

			<div class="min-w-0 flex-1 space-y-2">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<span
						data-testid="detail-ticker"
						class="tw-data text-diamond-300 text-2xl font-semibold tracking-wider"
					>
						{insight.ticker}
					</span>
					<span class="tw-caption">{insight.company_name}</span>
				</div>

				<h1 data-testid="detail-judul" class="tw-heading text-ink">{judulInsight(insight)}</h1>

				<p class="tw-overline">
					{labelSubtype(insight.subtype)} · {formatTanggal(insight.generated_at)} WIB
				</p>
			</div>
		</div>

		{#if verifikasi}
			<div
				data-testid="badge-signature"
				data-valid={verifikasi.valid}
				class="rounded-glass flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3 {verifikasi.valid
					? 'border-tier-low/35 bg-tier-low/10'
					: 'border-tier-critical/35 bg-tier-critical/10'}"
			>
				{#if verifikasi.valid}
					<span class="text-tier-low inline-flex items-center gap-2">
						<ShieldCheck class="size-4" aria-hidden="true" />
						<span class="tw-overline text-tier-low">Signature terverifikasi</span>
					</span>
				{:else}
					<span class="text-tier-critical inline-flex items-center gap-2">
						<ShieldX class="size-4" aria-hidden="true" />
						<span class="tw-overline text-tier-critical">Signature tidak valid</span>
					</span>
				{/if}

				<span class="tw-data text-secondary text-[12px]">
					{verifikasi.algorithm} · 0x{verifikasi.digest.slice(0, 4)}...{verifikasi.digest.slice(-4)}
				</span>

				<a
					href="/verify-insight?id={insight.id}"
					class="text-diamond-300 hover:text-diamond-100 ml-auto text-[13px] font-medium transition"
				>
					Verifikasi mandiri
				</a>
			</div>

			{#if verifikasi.reason}
				<p class="text-tier-critical text-[13px]">{verifikasi.reason}</p>
			{/if}
		{/if}
	</header>

	{#if subSkor.length > 0}
		<div class="tw-card space-y-4 p-6">
			<h2 class="tw-heading text-ink">Rincian sub skor</h2>

			<dl class="grid gap-3 sm:grid-cols-3">
				{#each subSkor as [kunci, nilai] (kunci)}
					{@const sub = tierDariSkor(nilai)}
					<div class="tw-glass p-4" data-testid="sub-skor" data-nama={kunci}>
						<dt class="tw-overline">{labelSinyal(kunci)}</dt>
						<dd class="font-display mt-2 text-xl font-semibold {sub.text}">
							{Math.round(nilai)}
						</dd>
					</div>
				{/each}
			</dl>

			{#if pola?.multiplier_applied}
				<p
					data-testid="pola-silang"
					class="rounded-glass border-line bg-void/50 flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<ShieldAlert class="mt-0.5 size-4 flex-none {tier.text}" aria-hidden="true" />
					<span class="text-secondary">
						{#if pola.multiplier_applied > 1}
							Pengali pola silang <span class="tw-data text-ink">{pola.multiplier_applied}x</span>
							aktif karena {pola.signals_active_in_window} sinyal muncul bersamaan dalam {pola.window_days}
							hari.
						{:else}
							Tidak ada pola silang aktif dalam {pola.window_days} hari terakhir, skor memakai bobot dasar.
						{/if}
					</span>
				</p>
			{/if}
		</div>
	{/if}

	{#if suspensi.length > 0}
		<div class="tw-card space-y-3 p-6">
			<h2 class="tw-heading text-ink">Riwayat suspensi</h2>
			<ul class="space-y-2">
				{#each suspensi as item (item.date)}
					<li class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
						<span class="text-ink text-[13.5px]">{item.reason}</span>
						<span class="tw-overline">{formatTanggalSaja(item.date)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if insider.length > 0}
		<div class="tw-card space-y-3 p-6">
			<h2 class="tw-heading text-ink">Transaksi insider</h2>
			<ul class="space-y-2">
				{#each insider as item (item.date + item.holder_name)}
					<li class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
						<span class="text-ink text-[13.5px]">
							{item.holder_name}
							<span class="text-muted"
								>{item.transaction_type === 'sell' ? 'melepas' : 'menambah'}</span
							>
						</span>
						<span class="tw-data text-secondary text-[13px]">
							Rp {rupiah(item.transaction_value)}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if kepemilikan.length > 0}
		<div class="tw-card space-y-3 p-6">
			<h2 class="tw-heading text-ink">Konsentrasi kepemilikan</h2>
			<ul class="space-y-2">
				{#each kepemilikan as item (item.date)}
					<li class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5">
						<span class="text-ink text-[13.5px]">{item.top_holder_name}</span>
						<span class="tw-data text-secondary text-[13px]">
							{item.top_holder_percentage}%
							<span class="text-muted">· {formatTanggalSaja(item.date)}</span>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
