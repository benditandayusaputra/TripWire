<script lang="ts">
	import { presenceStore } from '$lib/stores/presenceStore.svelte';

	let { data } = $props();

	$effect(() => {
		presenceStore.sambung();
		return () => presenceStore.putus();
	});

	function waktuSingkat(nilai?: string) {
		if (!nilai) return '';
		return new Date(nilai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function labelSkor(skor?: number | null) {
		return typeof skor === 'number' ? skor.toFixed(2) : 'tanpa skor';
	}
</script>

<svelte:head>
	<title>Notifikasi TripWire</title>
</svelte:head>

<section class="space-y-8">
	<header class="space-y-1">
		<h1 class="font-display text-ink-100 text-2xl font-semibold">Notifikasi</h1>
		<p class="text-ink-400 text-sm">
			Insight baru dari watchlist kamu muncul di sini secara langsung, tanpa perlu memuat ulang
			halaman.
		</p>
	</header>

	<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-display text-ink-100 text-sm font-semibold">Aliran langsung</h2>
			<span
				data-testid="status-stream"
				data-terhubung={presenceStore.terhubung}
				class="text-xs {presenceStore.terhubung ? 'text-emerald-400' : 'text-ink-400'}"
			>
				{presenceStore.terhubung ? 'Terhubung' : 'Menyambungkan'}
			</span>
		</div>

		<ul data-testid="insight-live" class="mt-4 space-y-3">
			{#each presenceStore.insightBaru as insight (insight.notification_id)}
				<li
					data-testid="insight-live-item"
					data-ticker={insight.ticker}
					class="border-abyss-400 bg-abyss-600 rounded-lg border p-4"
				>
					<div class="flex items-baseline justify-between gap-3">
						<span class="text-ink-100 font-semibold">{insight.ticker}</span>
						<span class="text-ink-400 text-xs">{waktuSingkat(insight.generated_at)}</span>
					</div>
					<p class="text-ink-400 mt-1 text-sm">
						{insight.company_name}, skor {labelSkor(insight.score)}
						{insight.category ? `, kategori ${insight.category}` : ''}
					</p>
					<a
						class="text-ink-100 mt-2 inline-block text-xs underline"
						href={`/insights/${insight.insight_id}`}>Lihat detail insight</a
					>
				</li>
			{:else}
				<li data-testid="insight-live-kosong" class="text-ink-400 text-sm">
					Belum ada insight baru sejak halaman ini dibuka.
				</li>
			{/each}
		</ul>
	</div>

	<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
		<h2 class="font-display text-ink-100 text-sm font-semibold">
			Riwayat notifikasi
			{#if data.unread > 0}
				<span data-testid="notifikasi-belum-dibaca" class="text-ink-400 font-normal">
					({data.unread} belum dibaca)
				</span>
			{/if}
		</h2>

		<ul data-testid="notifikasi-riwayat" class="mt-4 space-y-3">
			{#each data.notifications as notifikasi (notifikasi.id)}
				<li
					data-testid="notifikasi-item"
					data-ticker={notifikasi.ticker}
					class="border-abyss-400 flex items-baseline justify-between gap-3 rounded-lg border p-4"
				>
					<div>
						<span class="text-ink-100 font-semibold">{notifikasi.ticker}</span>
						<p class="text-ink-400 mt-1 text-sm">
							{notifikasi.insight_type === 'red_flag' ? 'Red flag detector' : 'Market intelligence'},
							skor {labelSkor(notifikasi.score)}
						</p>
					</div>
					<span class="text-ink-400 text-xs">{waktuSingkat(notifikasi.sent_at)}</span>
				</li>
			{:else}
				<li class="text-ink-400 text-sm">Belum ada notifikasi yang pernah dikirim.</li>
			{/each}
		</ul>
	</div>

	<p class="text-ink-400 text-xs">
		Seluruh insight di halaman ini adalah informasi dan analisis, bukan rekomendasi beli atau jual.
	</p>
</section>
