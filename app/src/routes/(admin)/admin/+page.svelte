<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Activity, CircleGauge, Play, TriangleAlert, Users } from 'lucide-svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { formatTanggal, waktuRelatif } from '$lib/insight';
	import { lokal, t } from '$lib/bahasa.svelte';

	let { data, form } = $props();

	let menjalankan = $state(false);
	let runSebelum = $state<string | null | undefined>(undefined);

	$effect(() => {
		if (runSebelum === undefined) return;
		if ((data.terakhir?.mulai_pada ?? null) !== runSebelum) {
			runSebelum = undefined;
			return;
		}
		let sisa = 60;
		const jeda = setInterval(() => {
			sisa -= 1;
			if (sisa < 0) {
				clearInterval(jeda);
				runSebelum = undefined;
				return;
			}
			invalidateAll();
		}, 3000);
		return () => clearInterval(jeda);
	});

	const sisaPersen = $derived(
		Number(data.credits.credit_budget) > 0
			? Math.round(
					(Number(data.credits.credits_remaining) / Number(data.credits.credit_budget)) * 100
				)
			: 0
	);

	const puncakHarian = $derived(
		Math.max(1, ...data.credits.daily_usage.map((hari) => hari.credits))
	);
	const rataHarian = $derived(
		data.credits.daily_average === null
			? ''
			: data.credits.daily_average.toLocaleString(lokal(), { maximumFractionDigits: 1 })
	);

	function namaHari(tanggal: string) {
		return new Date(`${tanggal}T00:00:00+07:00`).toLocaleDateString(lokal(), {
			weekday: 'short',
			timeZone: 'Asia/Jakarta'
		});
	}

	const ringkasan = $derived([
		{ label: t('Pengguna', 'Users'), nilai: data.stats.total_users },
		{ label: t('Item watchlist', 'Watchlist items'), nilai: data.stats.total_watchlist },
		{ label: t('Insight tersimpan', 'Saved insights'), nilai: data.stats.total_insight },
		{ label: t('Kondisi aktif', 'Active conditions'), nilai: data.stats.kondisi_aktif }
	]);
</script>

<svelte:head>
	<title>{t('Admin TripWire', 'TripWire admin')}</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">{t('Panel admin', 'Admin panel')}</p>
		<h1 data-testid="admin-heading" class="tw-title text-ink">
			{t('Kesehatan sistem', 'System health')}
		</h1>
		<p class="tw-caption">
			{t(
				'Sisa kuota Sectors, pemindaian otomatis, dan daftar pengguna.',
				'Remaining Sectors quota, automatic scans, and the user list.'
			)}
		</p>
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
			{t('Kuota Sectors', 'Sectors quota')}
		</h2>

		<div data-testid="admin-credits" class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span class="tw-data font-display text-ink text-2xl font-semibold">
				{data.credits.credits_remaining}
			</span>
			<span class="tw-caption">
				{t(
					`sisa dari ${data.credits.credit_budget} kredit, terpakai ${data.credits.credits_used}`,
					`left of ${data.credits.credit_budget} credits, ${data.credits.credits_used} used`
				)}
			</span>
		</div>

		<div class="bg-void/60 h-2 overflow-hidden rounded-full">
			<div
				class="h-full rounded-full {sisaPersen > 30 ? 'bg-tier-low' : 'bg-tier-critical'}"
				style="width: {Math.max(sisaPersen, 2)}%"
			></div>
		</div>

		<div data-testid="admin-pemakaian" class="space-y-3">
			<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<p class="tw-overline">{t('Pemakaian 7 hari terakhir', 'Usage over the last 7 days')}</p>
				<p data-testid="admin-perkiraan" class="tw-caption">
					{#if data.credits.days_left === null}
						{t('Belum ada pemakaian yang tercatat.', 'No usage recorded yet.')}
					{:else}
						{t(
							`Rata rata ${rataHarian} kredit per hari, cukup sekitar ${data.credits.days_left} hari lagi sebelum menyentuh ambang ${data.credits.credit_threshold}.`,
							`Averaging ${rataHarian} credits a day, enough for about ${data.credits.days_left} more days before reaching the ${data.credits.credit_threshold} threshold.`
						)}
					{/if}
				</p>
			</div>
			<ol class="flex h-20 items-end gap-1.5">
				{#each data.credits.daily_usage as hari (hari.date)}
					<li
						data-testid="admin-hari"
						class="flex h-full flex-1 flex-col items-center justify-end gap-1"
						title="{hari.date}: {hari.credits}"
					>
						<span class="tw-data text-secondary text-[11px]">{hari.credits}</span>
						<span
							class="bg-secondary/45 w-full max-w-9 rounded-sm"
							style="height: {Math.max((hari.credits / puncakHarian) * 44, 2)}px"
						></span>
						<span class="tw-overline text-[10px]">{namaHari(hari.date)}</span>
					</li>
				{/each}
			</ol>
		</div>

		<p class="tw-overline flex items-center gap-2">
			<Mark
				size={7}
				color={data.credits.circuit_open ? 'var(--color-tier-critical)' : 'var(--color-tier-low)'}
			/>
			{data.credits.circuit_open
				? t(
						'Koneksi ke Sectors dijeda sementara karena beberapa kali gagal',
						'Connection to Sectors is paused for now after several failures'
					)
				: t('Koneksi ke Sectors normal', 'Connection to Sectors is normal')}
		</p>
	</div>

	<div class="tw-card space-y-4 p-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 class="tw-heading text-ink flex items-center gap-2">
				<Activity class="text-diamond-300 size-4" aria-hidden="true" />
				{t('Pemindaian otomatis', 'Automatic scans')}
			</h2>

			<form
				method="POST"
				action="?/scan"
				use:enhance={() => {
					menjalankan = true;
					const sebelum = data.terakhir?.mulai_pada ?? null;
					return async ({ result, update }) => {
						await update();
						menjalankan = false;
						if (result.type === 'success') runSebelum = sebelum;
					};
				}}
			>
				<button
					type="submit"
					data-testid="trigger-scan"
					class="tw-ghost text-[13px]"
					disabled={menjalankan || runSebelum !== undefined}
				>
					<Play class="size-3.5" aria-hidden="true" />
					{menjalankan || runSebelum !== undefined
						? t('Sedang memindai', 'Scanning')
						: t('Pindai sekarang', 'Scan now')}
				</button>
			</form>
		</div>

		{#if runSebelum !== undefined}
			<p data-testid="scan-berjalan" class="tw-caption" role="status">
				{t(
					'Pemindaian berjalan di latar belakang. Hasilnya muncul di sini begitu selesai.',
					'The scan is running in the background. Results appear here once it finishes.'
				)}
			</p>
		{/if}

		{#if data.terakhir}
			<div data-testid="scheduler-terakhir" class="tw-glass space-y-3 p-4">
				<p class="tw-overline">
					{t('Pemindaian terakhir', 'Last scan')} · {data.terakhir.pemicu} · {waktuRelatif(
						data.terakhir.selesai_pada
					)}
				</p>

				<dl class="grid gap-3 sm:grid-cols-4">
					{#each [{ l: t('Kondisi ditinjau', 'Conditions reviewed'), v: data.terakhir.kondisi_ditinjau }, { l: t('Ticker diproses', 'Tickers processed'), v: data.terakhir.ticker_diproses }, { l: t('Insight baru', 'New insights'), v: data.terakhir.insight_baru }, { l: t('Gagal', 'Failed'), v: data.terakhir.gagal }] as item (item.l)}
						<div>
							<dt class="tw-overline">{item.l}</dt>
							<dd class="tw-data text-ink mt-1 text-[15px]">{item.v}</dd>
						</div>
					{/each}
				</dl>

				<p class="tw-caption">
					{t(
						`Selesai dalam ${data.terakhir.durasi_ms} ms pada ${formatTanggal(data.terakhir.selesai_pada)} WIB.`,
						`Finished in ${data.terakhir.durasi_ms} ms on ${formatTanggal(data.terakhir.selesai_pada)} WIB.`
					)}
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
				{t(
					'Pemindaian otomatis belum pernah jalan. Pakai tombol di atas untuk memicu pemindaian pertama.',
					'Automatic scans have never run. Use the button above to trigger the first scan.'
				)}
			</p>
		{/if}

		{#if data.riwayat.length > 1}
			<div class="space-y-2">
				<p class="tw-overline">{t('Riwayat pemindaian', 'Scan history')}</p>
				<ul class="space-y-1.5">
					{#each data.riwayat.slice(1, 6) as run (run.mulai_pada)}
						<li
							class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 text-[13px]"
						>
							<span class="text-secondary">{run.pemicu} · {waktuRelatif(run.selesai_pada)}</span>
							<span class="tw-data text-muted">
								{t(
									`${run.ticker_diproses} ticker · ${run.insight_baru} insight · ${run.durasi_ms} ms`,
									`${run.ticker_diproses} ${run.ticker_diproses === 1 ? 'ticker' : 'tickers'} · ${run.insight_baru} ${run.insight_baru === 1 ? 'insight' : 'insights'} · ${run.durasi_ms} ms`
								)}
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
			{t('Pengguna terbaru', 'Newest users')}
		</h2>

		<div class="overflow-x-auto">
			<table data-testid="admin-users" class="w-full min-w-[38rem] text-left text-[13.5px]">
				<thead>
					<tr class="border-line/70 border-b">
						<th class="tw-overline pb-2 font-medium">Email</th>
						<th class="tw-overline pb-2 font-medium">Role</th>
						<th class="tw-overline pb-2 font-medium">2FA</th>
						<th class="tw-overline pb-2 font-medium">Watchlist</th>
						<th class="tw-overline pb-2 font-medium">{t('Terakhir masuk', 'Last login')}</th>
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
								{pengguna.totp_enabled ? t('aktif', 'on') : t('mati', 'off')}
							</td>
							<td class="tw-data text-secondary py-2.5">{pengguna.watchlist_count}</td>
							<td class="text-muted py-2.5 text-[12.5px]">
								{pengguna.last_login_at
									? waktuRelatif(pengguna.last_login_at)
									: t('belum pernah', 'never')}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>
