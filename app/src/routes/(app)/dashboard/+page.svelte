<script lang="ts">
	import { ArrowRight, ListChecks, MailWarning, Radar } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import InsightCard from '$lib/components/InsightCard.svelte';

	let { data } = $props();

	const emailTerverifikasi = $derived(Boolean(data.user?.email_verified_at));

	const sapaan = $derived.by(() => {
		const jam = new Date().getHours();
		if (jam < 11) return 'Selamat pagi';
		if (jam < 15) return 'Selamat siang';
		if (jam < 19) return 'Selamat sore';
		return 'Selamat malam';
	});

	const ringkasan = $derived([
		{ label: 'Saham dipantau', nilai: data.summary.saham_dipantau },
		{ label: 'Insight terkumpul', nilai: data.summary.insight_total },
		{ label: 'Berstatus kritis', nilai: data.summary.insight_kritis, kritis: true },
		{ label: 'Kondisi aktif', nilai: data.summary.kondisi_aktif }
	]);

	const saringan = [
		{ nilai: '', label: 'Semua' },
		{ nilai: 'red_flag', label: 'Red flag' },
		{ nilai: 'market_intelligence', label: 'Market intel' }
	];
</script>

<svelte:head>
	<title>Dashboard TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">{sapaan}</p>
		<h1 data-testid="dashboard-heading" class="tw-title text-ink">
			{data.user?.full_name}
		</h1>
	</header>

	<DisclaimerBar />

	{#if !emailTerverifikasi}
		<div
			data-testid="email-belum-verifikasi"
			class="rounded-glass border-diamond-700 bg-diamond-900/40 flex items-start gap-3 border px-4 py-3.5"
		>
			<MailWarning class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
			<p class="text-secondary text-[13.5px]">
				Email kamu belum diverifikasi. Cek kotak masuk untuk mengaktifkan notifikasi insight.
			</p>
		</div>
	{/if}

	<dl data-testid="ringkasan" class="grid gap-3 sm:grid-cols-4">
		{#each ringkasan as item (item.label)}
			<div class="tw-card p-5">
				<dt class="tw-overline">{item.label}</dt>
				<dd
					class="font-display mt-2 text-2xl font-semibold {item.kritis && item.nilai > 0
						? 'text-tier-critical'
						: 'text-ink'}"
				>
					{item.nilai}
				</dd>
			</div>
		{/each}
	</dl>

	<div class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="tw-heading text-ink">Insight terbaru</h2>

			<nav class="flex gap-1.5">
				{#each saringan as item (item.nilai)}
					<a
						href={item.nilai ? `/dashboard?type=${item.nilai}` : '/dashboard'}
						data-testid="saring-{item.nilai || 'semua'}"
						aria-current={data.jenis === item.nilai ? 'page' : undefined}
						class="rounded-glass px-3 py-1.5 text-[13px] font-medium transition {data.jenis ===
						item.nilai
							? 'bg-diamond-500/12 text-diamond-100'
							: 'text-secondary hover:text-ink'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>

		{#if data.insights.length === 0}
			<div class="tw-glass flex items-start gap-3 px-4 py-5">
				<Radar class="text-muted mt-0.5 size-4 flex-none" aria-hidden="true" />
				<div class="space-y-2">
					<p data-testid="feed-kosong" class="tw-caption">
						Belum ada insight. Tambahkan emiten ke watchlist dulu, lalu kondisi pemicunya.
					</p>
					<a
						href="/watchlist"
						class="text-diamond-300 hover:text-diamond-100 inline-flex items-center gap-1.5 text-[13.5px] font-medium transition"
					>
						<ListChecks class="size-3.5" aria-hidden="true" />
						Buka watchlist
						<ArrowRight class="size-3.5" aria-hidden="true" />
					</a>
				</div>
			</div>
		{:else}
			<ul data-testid="feed-insight" class="space-y-3">
				{#each data.insights as insight (insight.id)}
					<li><InsightCard {insight} /></li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
