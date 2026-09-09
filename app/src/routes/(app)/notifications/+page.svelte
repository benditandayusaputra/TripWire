<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ArrowRight, CheckCheck, Inbox, MailOpen, Radio } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SignatureBadge from '$lib/components/SignatureBadge.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import { tierDariSkor } from '$lib/skor';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';
	import type { Notifikasi } from '$lib/api/notifications';
	import { tandaiDibaca } from '$lib/api/notifications';

	let { data } = $props();

	let menandai = $state(false);

	const belumDibaca = $derived(data.notifications.filter((item) => item.read_at === null));
	const sudahDibaca = $derived(data.notifications.filter((item) => item.read_at !== null));

	$effect(() => {
		presenceStore.sambung();
		return () => presenceStore.putus();
	});

	function waktuSingkat(nilai?: string) {
		if (!nilai) return '';
		return new Date(nilai)
			.toLocaleString('id-ID', {
				day: '2-digit',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Asia/Jakarta'
			})
			.toUpperCase();
	}

	function judul(jenis?: string, subtype?: string, skor?: number | null) {
		if (jenis === 'red_flag') {
			return `Skor risiko tata kelola ${tierDariSkor(skor).label.toLowerCase()}`;
		}
		if (subtype === 'mining_deep_dive') return 'Eksposur komoditas tambang diperbarui';
		return 'Snapshot fundamental terhadap sektor diperbarui';
	}

	function penjelasan(jenis?: string, subtype?: string) {
		if (jenis === 'red_flag') {
			return 'Gabungan sinyal suspend, klaster insider, dan perubahan konsentrasi kepemilikan.';
		}
		if (subtype === 'mining_deep_dive') {
			return 'Tren produksi, harga komoditas, umur cadangan, dan radar lisensi tambang.';
		}
		return 'Perbandingan fundamental emiten terhadap rata rata sub sektornya.';
	}

	async function tandaiSemua() {
		if (menandai || belumDibaca.length === 0) return;
		menandai = true;

		try {
			await Promise.all(belumDibaca.map((item) => tandaiDibaca(item.id)));
			await invalidateAll();
		} finally {
			menandai = false;
		}
	}
</script>

{#snippet kepalaKartu(ticker: string, skor: number | null | undefined, waktu: string)}
	<span class="flex items-center gap-2.5 pr-5">
		<SkorBadge {skor} showLabel={false} />
		<span class="tw-data text-ink text-[13px] font-semibold">{ticker}</span>
		<span class="tw-data text-muted ml-auto text-[11px]">{waktu}</span>
	</span>
{/snippet}

{#snippet titikBelum(warna: string)}
	<span
		class="absolute top-3.5 right-3.5 size-2 animate-pulse rounded-full {warna}"
		aria-label="Belum dibaca"
	></span>
{/snippet}

<svelte:head>
	<title>Notifikasi TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1.5">
			<p class="tw-overline">Realtime</p>
			<h1 class="tw-title text-ink">Notifikasi</h1>
			<p class="tw-caption">
				Insight baru dari watchlist kamu masuk begitu dibuat, tanpa perlu memuat ulang halaman.
			</p>
		</div>

		{#if belumDibaca.length > 0}
			<button
				type="button"
				data-testid="tandai-semua"
				class="tw-ghost text-[13px]"
				disabled={menandai}
				onclick={tandaiSemua}
			>
				<CheckCheck class="size-4" aria-hidden="true" />
				{menandai ? 'Menandai' : 'Tandai semua dibaca'}
			</button>
		{/if}
	</header>

	<DisclaimerBar />

	<div class="space-y-3">
		<p class="tw-overline flex items-center gap-2">
			<span
				class="bg-diamond-500 size-1.5 rounded-full {presenceStore.terhubung
					? 'animate-pulse'
					: 'opacity-40'}"
			></span>
			<Radio
				class="size-3.5 {presenceStore.terhubung ? 'text-diamond-300' : 'text-muted'}"
				aria-hidden="true"
			/>
			Baru masuk
			<span
				data-testid="status-stream"
				data-terhubung={presenceStore.terhubung}
				class="{presenceStore.terhubung ? 'text-tier-low' : 'text-muted'} ml-auto"
			>
				{presenceStore.terhubung ? 'Terhubung' : 'Menyambungkan'}
			</span>
		</p>

		<ul data-testid="insight-live" class="space-y-2.5">
			{#each presenceStore.insightBaru as insight (insight.notification_id)}
				<li
					data-testid="insight-live-item"
					data-ticker={insight.ticker}
					class="tw-glass relative space-y-2 px-4 py-3.5"
				>
					{@render titikBelum('bg-diamond-500')}
					{@render kepalaKartu(insight.ticker, insight.score, waktuSingkat(insight.generated_at))}

					<span class="text-ink block text-[14px] font-semibold">
						{judul(insight.insight_type, insight.subtype, insight.score)}
					</span>
					<span class="text-secondary block text-[12.5px] leading-relaxed">
						{insight.company_name}. {penjelasan(insight.insight_type, insight.subtype)}
					</span>

					<div class="flex flex-wrap items-center justify-between gap-3 pt-0.5">
						<SignatureBadge compact />
						<a
							class="text-diamond-300 inline-flex items-center gap-1.5 text-[12.5px] hover:underline"
							href={`/insights/${insight.insight_id}`}
						>
							Lihat detail
							<ArrowRight class="size-3.5" aria-hidden="true" />
						</a>
					</div>
				</li>
			{:else}
				<li data-testid="insight-live-kosong" class="tw-glass text-muted px-4 py-3.5 text-[13px]">
					Belum ada insight baru sejak halaman ini dibuka.
				</li>
			{/each}
		</ul>
	</div>

	<div data-testid="notifikasi-riwayat" class="space-y-6">
		<div class="space-y-3">
			<p class="tw-overline flex items-center gap-2">
				<Inbox class="size-3.5" aria-hidden="true" />
				Belum dibaca
				{#if belumDibaca.length > 0}
					<span data-testid="notifikasi-belum-dibaca" class="text-diamond-300">
						· {belumDibaca.length}
					</span>
				{/if}
			</p>

			<ul class="space-y-2.5">
				{#each belumDibaca as notifikasi (notifikasi.id)}
					<li
						data-testid="notifikasi-item"
						data-ticker={notifikasi.ticker}
						data-dibaca="false"
						class="tw-glass relative space-y-2 px-4 py-3.5"
					>
						{@render titikBelum(
							tierDariSkor(notifikasi.score).tier === 'critical'
								? 'bg-tier-critical'
								: 'bg-diamond-500'
						)}
						{@render kepalaKartu(
							notifikasi.ticker ?? '',
							notifikasi.score,
							waktuSingkat(notifikasi.sent_at)
						)}

						<span class="text-ink block text-[14px] font-semibold">
							{judul(notifikasi.insight_type, notifikasi.subtype, notifikasi.score)}
						</span>
						<span class="text-secondary block text-[12.5px] leading-relaxed">
							{penjelasan(notifikasi.insight_type, notifikasi.subtype)}
						</span>
					</li>
				{:else}
					<li class="text-muted text-[13px]">Semua notifikasi sudah kamu baca.</li>
				{/each}
			</ul>
		</div>

		{#if sudahDibaca.length > 0}
			<div class="space-y-3">
				<p class="tw-overline flex items-center gap-2">
					<MailOpen class="size-3.5" aria-hidden="true" />
					Sudah dibaca
				</p>

				<ul class="border-line divide-line rounded-glass divide-y border">
					{#each sudahDibaca as notifikasi (notifikasi.id)}
						<li
							data-testid="notifikasi-item"
							data-ticker={notifikasi.ticker}
							data-dibaca="true"
							class="space-y-1.5 px-4 py-3"
						>
							{@render kepalaKartu(
								notifikasi.ticker ?? '',
								notifikasi.score,
								waktuSingkat(notifikasi.sent_at)
							)}
							<span class="text-secondary block text-[13px]">
								{judul(notifikasi.insight_type, notifikasi.subtype, notifikasi.score)}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</section>
