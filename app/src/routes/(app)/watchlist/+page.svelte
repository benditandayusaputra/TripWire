<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarClock, Plus, Trash2, TriangleAlert } from 'lucide-svelte';
	import Field from '$lib/components/Field.svelte';
	import KondisiLabel from '$lib/components/KondisiLabel.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let { data, form } = $props();

	let ticker = $state('');
	let conditionType = $state('daily');
	let intervalHours = $state(6);
	let weekday = $state(1);

	const cocok = $derived.by(() => {
		const needle = ticker.trim().toUpperCase();
		if (needle.length < 1) return [];
		return data.tickers
			.filter((t) => t.code.startsWith(needle) || t.name.toUpperCase().includes(needle))
			.slice(0, 6);
	});

	const totalKondisi = $derived(
		data.items.reduce((jumlah, item) => jumlah + item.conditions.length, 0)
	);

	const kondisiAktif = $derived(
		data.items.reduce(
			(jumlah, item) => jumlah + item.conditions.filter((kondisi) => kondisi.is_active).length,
			0
		)
	);
</script>

<svelte:head>
	<title>Watchlist TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="space-y-1.5">
			<p class="tw-overline">Watchlist</p>
			<h1 class="tw-title text-ink">Emiten yang kamu pantau</h1>
		</div>

		<dl class="flex gap-2.5">
			<div class="tw-glass px-3.5 py-2 text-center">
				<dt class="tw-overline">Saham</dt>
				<dd class="tw-data text-ink mt-0.5 text-[17px] font-semibold">{data.items.length}</dd>
			</div>
			<div class="tw-glass px-3.5 py-2 text-center">
				<dt class="tw-overline">Kondisi</dt>
				<dd class="tw-data text-ink mt-0.5 text-[17px] font-semibold">{totalKondisi}</dd>
			</div>
			<div class="tw-glass px-3.5 py-2 text-center">
				<dt class="tw-overline">Aktif</dt>
				<dd class="tw-data text-tier-low mt-0.5 text-[17px] font-semibold">{kondisiAktif}</dd>
			</div>
		</dl>
	</header>

	<div class="tw-card p-5">
		<h2 class="tw-heading text-ink flex items-center gap-2">
			<Plus class="text-diamond-300 size-4" aria-hidden="true" />
			Tambah emiten
		</h2>

		{#if form?.aksi === 'tambah' && form?.error}
			<p
				data-testid="watchlist-error"
				role="alert"
				class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical mt-4 flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
			>
				<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
				{form.error}
			</p>
		{/if}

		<form
			method="POST"
			action="?/tambah"
			class="mt-4 flex flex-wrap items-end gap-3"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					ticker = '';
				}}
		>
			<div class="min-w-[11rem] flex-1">
				<Field
					id="ticker"
					label="Kode emiten"
					bind:value={ticker}
					placeholder="ANTM"
					autocomplete="off"
					list="daftar-ticker"
					mono
				/>
				<datalist id="daftar-ticker">
					{#each cocok as emiten (emiten.code)}
						<option value={emiten.code}>{emiten.name}</option>
					{/each}
				</datalist>
			</div>

			<div class="space-y-1.5">
				<label for="data_display_pref" class="text-secondary block text-[13.5px] font-medium">
					Tampilan data
				</label>
				<select id="data_display_pref" name="data_display_pref" class="tw-field">
					<option value="insight_only">Insight saja</option>
					<option value="insight_plus_data">Insight plus data</option>
				</select>
			</div>

			<button type="submit" data-testid="tambah-ticker" class="tw-primary">
				<Plus class="size-4" aria-hidden="true" />
				Tambah
			</button>
		</form>
	</div>

	{#if data.items.length === 0}
		<div class="tw-glass flex items-center gap-3 px-4 py-4">
			<Mark size={7} color="var(--color-muted)" />
			<p data-testid="watchlist-kosong" class="tw-caption">
				Belum ada emiten yang dipantau. Tambahkan satu kode emiten untuk mulai.
			</p>
		</div>
	{:else}
		<ul data-testid="watchlist-items" class="space-y-4">
			{#each data.items as item (item.id)}
				<li data-testid="watchlist-item" data-ticker={item.ticker} class="tw-card overflow-hidden">
					<div class="border-line/70 flex items-start justify-between gap-4 border-b p-5">
						<div class="min-w-0">
							<p class="tw-data text-diamond-300 text-[19px] font-semibold tracking-wider">
								{item.ticker}
							</p>
							<p class="text-secondary mt-0.5 text-[14px]">{item.company_name}</p>
							<p class="tw-overline mt-2.5">
								{item.data_display_pref === 'insight_only' ? 'Insight saja' : 'Insight plus data'}
							</p>
						</div>

						<form method="POST" action="?/hapus" use:enhance>
							<input type="hidden" name="item_id" value={item.id} />
							<button
								type="submit"
								data-testid="hapus-ticker"
								aria-label="Hapus {item.ticker} dari watchlist"
								class="rounded-glass border-line text-muted hover:border-tier-critical/50 hover:text-tier-critical border p-2 transition"
							>
								<Trash2 class="size-4" aria-hidden="true" />
							</button>
						</form>
					</div>

					<div class="space-y-4 p-5">
						<h3 class="tw-overline flex items-center gap-2">
							<CalendarClock class="size-3.5" aria-hidden="true" />
							Kondisi pemicu
						</h3>

						{#if item.conditions.length === 0}
							<p class="text-muted text-[13.5px]">Belum ada kondisi.</p>
						{:else}
							<ul data-testid="daftar-kondisi" class="space-y-2">
								{#each item.conditions as kondisi (kondisi.id)}
									<li
										data-testid="kondisi"
										data-condition-type={kondisi.condition_type}
										class="tw-glass flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-[13.5px]"
									>
										<span class="flex items-center gap-2.5">
											<Mark
												size={7}
												color={kondisi.is_active ? 'var(--color-tier-low)' : 'var(--color-muted)'}
											/>
											<KondisiLabel type={kondisi.condition_type} config={kondisi.config} />
											<span
												data-testid="status-kondisi"
												class="tw-overline {kondisi.is_active ? 'text-tier-low' : 'text-muted'}"
											>
												{kondisi.is_active ? 'Aktif' : 'Nonaktif'}
											</span>
										</span>

										<span class="flex items-center gap-2">
											<form method="POST" action="?/ubahKondisi" use:enhance>
												<input type="hidden" name="item_id" value={item.id} />
												<input type="hidden" name="condition_id" value={kondisi.id} />
												<input type="hidden" name="is_active" value={String(!kondisi.is_active)} />
												<button
													type="submit"
													data-testid="toggle-kondisi"
													class="tw-ghost px-2.5 py-1 text-[12.5px]"
												>
													{kondisi.is_active ? 'Nonaktifkan' : 'Aktifkan'}
												</button>
											</form>

											<form method="POST" action="?/hapusKondisi" use:enhance>
												<input type="hidden" name="item_id" value={item.id} />
												<input type="hidden" name="condition_id" value={kondisi.id} />
												<button
													type="submit"
													data-testid="hapus-kondisi"
													class="rounded-glass border-line text-muted hover:border-tier-critical/50 hover:text-tier-critical border px-2.5 py-1 text-[12.5px] transition"
												>
													Hapus
												</button>
											</form>
										</span>
									</li>
								{/each}
							</ul>
						{/if}

						<form
							method="POST"
							action="?/tambahKondisi"
							class="flex flex-wrap items-end gap-3"
							use:enhance
						>
							<input type="hidden" name="item_id" value={item.id} />

							<div class="space-y-1.5">
								<label
									for="condition_type-{item.id}"
									class="text-secondary block text-[12.5px] font-medium"
								>
									Jenis kondisi
								</label>
								<select
									id="condition_type-{item.id}"
									name="condition_type"
									bind:value={conditionType}
									class="tw-field py-2 text-[13.5px]"
								>
									<option value="daily">Harian</option>
									<option value="weekly">Mingguan</option>
									<option value="recent_event">Event terbaru</option>
									<option value="geopolitical">Geopolitik</option>
									<option value="periodic_custom">Periodik custom</option>
								</select>
							</div>

							{#if conditionType === 'periodic_custom'}
								<div class="space-y-1.5">
									<label
										for="interval-{item.id}"
										class="text-secondary block text-[12.5px] font-medium"
									>
										Interval jam
									</label>
									<input
										id="interval-{item.id}"
										name="interval_hours"
										type="number"
										min="1"
										max="720"
										bind:value={intervalHours}
										class="tw-field tw-data w-24 py-2 text-[13.5px]"
									/>
								</div>
							{/if}

							{#if conditionType === 'weekly'}
								<div class="space-y-1.5">
									<label
										for="weekday-{item.id}"
										class="text-secondary block text-[12.5px] font-medium"
									>
										Hari
									</label>
									<select
										id="weekday-{item.id}"
										name="weekday"
										bind:value={weekday}
										class="tw-field py-2 text-[13.5px]"
									>
										<option value={1}>Senin</option>
										<option value={2}>Selasa</option>
										<option value={3}>Rabu</option>
										<option value={4}>Kamis</option>
										<option value={5}>Jumat</option>
									</select>
								</div>
							{/if}

							<button type="submit" data-testid="tambah-kondisi" class="tw-ghost">
								<Plus class="size-4" aria-hidden="true" />
								Tambah kondisi
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
