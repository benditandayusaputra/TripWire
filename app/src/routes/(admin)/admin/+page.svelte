<script lang="ts">
	import { enhance } from '$app/forms';
	import { Activity, CircleGauge, Play, TriangleAlert, Users } from 'lucide-svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { formatTanggal, waktuRelatif } from '$lib/insight';

	let { data, form } = $props();

	let menjalankan = $state(false);

	const sisaPersen = $derived(
		Number(data.credits.credit_budget) > 0
			? Math.round(
					(Number(data.credits.credits_remaining) / Number(data.credits.credit_budget)) * 100
				)
			: 0
	);

	const ringkasan = $derived([
		{ label: 'Pengguna', nilai: data.stats.total_users },
		{ label: 'Item watchlist', nilai: data.stats.total_watchlist },
		{ label: 'Insight tersimpan', nilai: data.stats.total_insight },
		{ label: 'Kondisi aktif', nilai: data.stats.kondisi_aktif }
	]);
</script>

<svelte:head>
	<title>Admin TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">Panel admin</p>
		<h1 data-testid="admin-heading" class="tw-title text-ink">Kesehatan sistem</h1>
		<p class="tw-caption">Sisa kuota Sectors, status scheduler, dan daftar pengguna.</p>
	</header>

	{#if form?.error}
		<p
			data-testid="admin-error"
			role="alert"
			class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	<dl data-testid="admin-statistik" class="grid gap-3 sm:grid-cols-4">
		{#each ringkasan as item (item.label)}
			<div class="tw-card p-5">
				<dt class="tw-overline">{item.label}</dt>
				<dd class="font-display text-ink mt-2 text-2xl font-semibold">{item.nilai}</dd>
			</div>
		{/each}
	</dl>

	<div class="tw-card space-y-4 p-6">
		<h2 class="tw-heading text-ink flex items-center gap-2">
			<CircleGauge class="text-diamond-300 size-4" aria-hidden="true" />
			Kuota Sectors API
		</h2>

		<div data-testid="admin-credits" class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span class="tw-data font-display text-ink text-2xl font-semibold">
				{data.credits.credits_remaining}
			</span>
			<span class="tw-caption">
				sisa dari {data.credits.credit_budget} credit, terpakai {data.credits.credits_used}
			</span>
		</div>

		<div class="bg-void/60 h-2 overflow-hidden rounded-full">
			<div
				class="h-full rounded-full {sisaPersen > 30 ? 'bg-tier-low' : 'bg-tier-critical'}"
				style="width: {Math.max(sisaPersen, 2)}%"
			></div>
		</div>

		<p class="tw-overline flex items-center gap-2">
			<Mark
				size={7}
				color={data.credits.circuit_open ? 'var(--color-tier-critical)' : 'var(--color-tier-low)'}
			/>
			{data.credits.circuit_open ? 'Circuit breaker terbuka' : 'Circuit breaker tertutup'}
		</p>
	</div>

	<div class="tw-card space-y-4 p-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="tw-heading text-ink flex items-center gap-2">
				<Activity class="text-diamond-300 size-4" aria-hidden="true" />
				Scheduler
			</h2>

			<form
				method="POST"
				action="?/scan"
				use:enhance={() => {
					menjalankan = true;
					return async ({ update }) => {
						await update();
						menjalankan = false;
					};
				}}
			>
				<button
					type="submit"
					data-testid="trigger-scan"
					class="tw-ghost text-[13px]"
					disabled={menjalankan}
				>
					<Play class="size-3.5" aria-hidden="true" />
					{menjalankan ? 'Menjalankan' : 'Jalankan scan manual'}
				</button>
			</form>
		</div>

		{#if data.terakhir}
			<div data-testid="scheduler-terakhir" class="tw-glass space-y-3 p-4">
				<p class="tw-overline">
					Run terakhir · {data.terakhir.pemicu} · {waktuRelatif(data.terakhir.selesai_pada)}
				</p>

				<dl class="grid gap-3 sm:grid-cols-4">
					{#each [{ l: 'Kondisi ditinjau', v: data.terakhir.kondisi_ditinjau }, { l: 'Ticker diproses', v: data.terakhir.ticker_diproses }, { l: 'Insight baru', v: data.terakhir.insight_baru }, { l: 'Gagal', v: data.terakhir.gagal }] as item (item.l)}
						<div>
							<dt class="tw-overline">{item.l}</dt>
							<dd class="tw-data text-ink mt-1 text-[15px]">{item.v}</dd>
						</div>
					{/each}
				</dl>

				<p class="tw-caption">
					Selesai dalam {data.terakhir.durasi_ms} ms pada {formatTanggal(
						data.terakhir.selesai_pada
					)} WIB.
				</p>

				{#if data.terakhir.catatan.length > 0}
					<ul class="space-y-1">
						{#each data.terakhir.catatan as catatan (catatan)}
							<li class="text-tier-high text-[12.5px]">{catatan}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{:else}
			<p data-testid="scheduler-kosong" class="tw-caption">
				Scheduler belum pernah jalan. Pakai tombol di atas untuk memicu scan pertama.
			</p>
		{/if}

		{#if data.riwayat.length > 1}
			<div class="space-y-2">
				<p class="tw-overline">Riwayat run</p>
				<ul class="space-y-1.5">
					{#each data.riwayat.slice(1, 6) as run (run.mulai_pada)}
						<li
							class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 text-[13px]"
						>
							<span class="text-secondary">{run.pemicu} · {waktuRelatif(run.selesai_pada)}</span>
							<span class="tw-data text-muted">
								{run.ticker_diproses} ticker · {run.insight_baru} insight · {run.durasi_ms} ms
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="tw-card space-y-4 p-6">
		<h2 class="tw-heading text-ink flex items-center gap-2">
			<Users class="text-diamond-300 size-4" aria-hidden="true" />
			Pengguna terbaru
		</h2>

		<div class="overflow-x-auto">
			<table data-testid="admin-users" class="w-full min-w-[38rem] text-left text-[13.5px]">
				<thead>
					<tr class="border-line/70 border-b">
						<th class="tw-overline pb-2 font-medium">Email</th>
						<th class="tw-overline pb-2 font-medium">Role</th>
						<th class="tw-overline pb-2 font-medium">2FA</th>
						<th class="tw-overline pb-2 font-medium">Watchlist</th>
						<th class="tw-overline pb-2 font-medium">Terakhir masuk</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as pengguna (pengguna.id)}
						<tr data-testid="admin-user-row" class="border-line/40 border-b last:border-0">
							<td class="tw-data text-ink py-2.5 text-[12.5px]">{pengguna.email}</td>
							<td class="py-2.5">
								<span class={pengguna.role === 'admin' ? 'text-diamond-300' : 'text-secondary'}>
									{pengguna.role}
								</span>
							</td>
							<td class="py-2.5 {pengguna.totp_enabled ? 'text-tier-low' : 'text-muted'}">
								{pengguna.totp_enabled ? 'aktif' : 'mati'}
							</td>
							<td class="tw-data text-secondary py-2.5">{pengguna.watchlist_count}</td>
							<td class="text-muted py-2.5 text-[12.5px]">
								{pengguna.last_login_at ? waktuRelatif(pengguna.last_login_at) : 'belum pernah'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
