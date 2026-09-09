<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2 } from 'lucide-svelte';
	import KondisiLabel from '$lib/components/KondisiLabel.svelte';

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
</script>

<svelte:head>
	<title>Watchlist TripWire</title>
</svelte:head>

<section class="space-y-8">
	<header class="space-y-1">
		<h1 class="font-display text-ink-100 text-2xl font-semibold">Watchlist</h1>
		<p class="text-ink-400 text-sm">
			{data.items.length} emiten dipantau. Tiap emiten bisa punya kondisi pemicu sendiri.
		</p>
	</header>

	<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
		<h2 class="font-display text-ink-100 text-sm font-semibold">Tambah emiten</h2>

		{#if form?.aksi === 'tambah' && form?.error}
			<p
				data-testid="watchlist-error"
				role="alert"
				class="border-flag-critical/40 bg-flag-critical/10 text-flag-critical mt-3 rounded-lg border px-3 py-2 text-sm"
			>
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
			<div class="min-w-[12rem] flex-1 space-y-1.5">
				<label for="ticker" class="text-ink-200 block text-sm font-medium">Kode emiten</label>
				<input
					id="ticker"
					name="ticker"
					list="daftar-ticker"
					bind:value={ticker}
					placeholder="ANTM"
					autocomplete="off"
					required
					class="border-abyss-400 bg-abyss-600 text-ink-100 focus:border-diamond-500 w-full rounded-lg border px-3 py-2.5 font-mono text-sm tracking-wider uppercase outline-none"
				/>
				<datalist id="daftar-ticker">
					{#each cocok as emiten (emiten.code)}
						<option value={emiten.code}>{emiten.name}</option>
					{/each}
				</datalist>
			</div>

			<div class="space-y-1.5">
				<label for="data_display_pref" class="text-ink-200 block text-sm font-medium">
					Tampilan data
				</label>
				<select
					id="data_display_pref"
					name="data_display_pref"
					class="border-abyss-400 bg-abyss-600 text-ink-100 focus:border-diamond-500 rounded-lg border px-3 py-2.5 text-sm outline-none"
				>
					<option value="insight_only">Insight saja</option>
					<option value="insight_plus_data">Insight plus data</option>
				</select>
			</div>

			<button
				type="submit"
				data-testid="tambah-ticker"
				class="bg-diamond-500 text-abyss-900 hover:bg-diamond-400 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition"
			>
				<Plus class="size-4" aria-hidden="true" />
				Tambah
			</button>
		</form>
	</div>

	{#if data.items.length === 0}
		<p data-testid="watchlist-kosong" class="text-ink-400 text-sm">
			Belum ada emiten yang dipantau.
		</p>
	{:else}
		<ul data-testid="watchlist-items" class="space-y-4">
			{#each data.items as item (item.id)}
				<li
					data-testid="watchlist-item"
					data-ticker={item.ticker}
					class="border-abyss-400 bg-abyss-700 rounded-xl border"
				>
					<div class="border-abyss-400 flex items-start justify-between gap-4 border-b p-5">
						<div>
							<p class="text-diamond-300 font-mono text-lg font-semibold tracking-wider">
								{item.ticker}
							</p>
							<p class="text-ink-400 mt-0.5 text-sm">{item.company_name}</p>
							<p class="text-ink-500 mt-2 font-mono text-xs">
								{item.data_display_pref === 'insight_only' ? 'Insight saja' : 'Insight plus data'}
							</p>
						</div>

						<form method="POST" action="?/hapus" use:enhance>
							<input type="hidden" name="item_id" value={item.id} />
							<button
								type="submit"
								data-testid="hapus-ticker"
								aria-label="Hapus {item.ticker} dari watchlist"
								class="border-abyss-400 text-ink-400 hover:border-flag-critical/50 hover:text-flag-critical rounded-lg border p-2 transition"
							>
								<Trash2 class="size-4" aria-hidden="true" />
							</button>
						</form>
					</div>

					<div class="space-y-4 p-5">
						<h3 class="text-ink-500 font-mono text-xs tracking-wider uppercase">Kondisi pemicu</h3>

						{#if item.conditions.length === 0}
							<p class="text-ink-500 text-sm">Belum ada kondisi.</p>
						{:else}
							<ul data-testid="daftar-kondisi" class="space-y-2">
								{#each item.conditions as kondisi (kondisi.id)}
									<li
										data-testid="kondisi"
										data-condition-type={kondisi.condition_type}
										class="border-abyss-400 bg-abyss-600 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
									>
										<span class="flex items-center gap-2">
											<KondisiLabel type={kondisi.condition_type} config={kondisi.config} />
											<span
												data-testid="status-kondisi"
												class="rounded px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wider uppercase {kondisi.is_active
													? 'bg-flag-clear/15 text-flag-clear'
													: 'bg-abyss-400 text-ink-500'}"
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
													class="border-abyss-400 text-ink-300 hover:border-diamond-700 hover:text-ink-100 rounded border px-2 py-1 text-xs transition"
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
													class="border-abyss-400 text-ink-400 hover:border-flag-critical/50 hover:text-flag-critical rounded border px-2 py-1 text-xs transition"
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
									class="text-ink-300 block text-xs font-medium"
								>
									Jenis kondisi
								</label>
								<select
									id="condition_type-{item.id}"
									name="condition_type"
									bind:value={conditionType}
									class="border-abyss-400 bg-abyss-600 text-ink-100 focus:border-diamond-500 rounded-lg border px-3 py-2 text-sm outline-none"
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
									<label for="interval-{item.id}" class="text-ink-300 block text-xs font-medium">
										Interval jam
									</label>
									<input
										id="interval-{item.id}"
										name="interval_hours"
										type="number"
										min="1"
										max="720"
										bind:value={intervalHours}
										class="border-abyss-400 bg-abyss-600 text-ink-100 focus:border-diamond-500 w-24 rounded-lg border px-3 py-2 text-sm outline-none"
									/>
								</div>
							{/if}

							{#if conditionType === 'weekly'}
								<div class="space-y-1.5">
									<label for="weekday-{item.id}" class="text-ink-300 block text-xs font-medium">
										Hari
									</label>
									<select
										id="weekday-{item.id}"
										name="weekday"
										bind:value={weekday}
										class="border-abyss-400 bg-abyss-600 text-ink-100 focus:border-diamond-500 rounded-lg border px-3 py-2 text-sm outline-none"
									>
										<option value={1}>Senin</option>
										<option value={2}>Selasa</option>
										<option value={3}>Rabu</option>
										<option value={4}>Kamis</option>
										<option value={5}>Jumat</option>
									</select>
								</div>
							{/if}

							<button
								type="submit"
								data-testid="tambah-kondisi"
								class="border-diamond-700 text-diamond-300 hover:bg-diamond-900/40 rounded-lg border px-4 py-2 text-sm font-medium transition"
							>
								Tambah kondisi
							</button>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
