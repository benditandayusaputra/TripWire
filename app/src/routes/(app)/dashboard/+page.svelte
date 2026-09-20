<script lang="ts">
	let { data } = $props();

	const statusEmail = $derived(data.user?.email_verified_at ? 'Terverifikasi' : 'Belum verifikasi');
</script>

<svelte:head>
	<title>Dashboard TripWire</title>
</svelte:head>

<section class="space-y-6">
	<header class="space-y-1">
		<h1 data-testid="dashboard-heading" class="font-display text-ink-100 text-2xl font-semibold">
			Halo, {data.user?.full_name}
		</h1>
		<p class="text-ink-400 text-sm">Sesi kamu aktif. Watchlist dan insight menyusul.</p>
	</header>

	<dl class="grid gap-4 sm:grid-cols-3">
		<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
			<dt class="text-ink-500 font-mono text-xs tracking-wider uppercase">Email</dt>
			<dd class="text-ink-100 mt-2 text-sm break-all">{data.user?.email}</dd>
		</div>
		<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
			<dt class="text-ink-500 font-mono text-xs tracking-wider uppercase">Status email</dt>
			<dd class="text-ink-100 mt-2 text-sm">{statusEmail}</dd>
		</div>
		<div class="border-abyss-400 bg-abyss-700 rounded-xl border p-5">
			<dt class="text-ink-500 font-mono text-xs tracking-wider uppercase">Paket</dt>
			<dd class="text-ink-100 mt-2 text-sm capitalize">{data.user?.tier}</dd>
		</div>
	</dl>
</section>
