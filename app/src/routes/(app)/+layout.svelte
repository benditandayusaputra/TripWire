<script lang="ts">
	import { Diamond, LogOut } from 'lucide-svelte';
	import { authStore } from '$lib/stores/authStore.svelte';

	let { data, children } = $props();

	$effect(() => {
		authStore.set(data.user);
	});
</script>

<div class="min-h-dvh">
	<header class="border-abyss-400 bg-abyss-800 border-b">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
			<nav class="flex items-center gap-6">
				<a href="/dashboard" class="flex items-center gap-2">
					<Diamond class="text-diamond-500 size-5" aria-hidden="true" />
					<span class="font-display text-base font-semibold tracking-tight">TripWire</span>
				</a>

				<a
					href="/watchlist"
					data-testid="nav-watchlist"
					class="text-ink-300 hover:text-ink-100 text-sm font-medium transition"
				>
					Watchlist
				</a>
			</nav>

			<div class="flex items-center gap-4">
				<span data-testid="current-user" class="text-ink-400 font-mono text-xs">
					{data.user?.email}
				</span>
				<form method="POST" action="/logout">
					<button
						type="submit"
						data-testid="logout-button"
						class="border-abyss-400 text-ink-200 hover:border-diamond-700 hover:text-ink-100 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
					>
						<LogOut class="size-3.5" aria-hidden="true" />
						Keluar
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-10">
		{@render children()}
	</main>
</div>
