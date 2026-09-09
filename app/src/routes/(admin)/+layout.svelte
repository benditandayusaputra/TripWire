<script lang="ts">
	import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-dvh">
	<header class="border-line/70 bg-void/70 sticky top-0 z-20 border-b backdrop-blur-xl">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
			<div class="flex items-center gap-5">
				<Wordmark size="sm" href="/dashboard" />
				<span
					class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 tw-overline inline-flex items-center gap-1.5 border px-2.5 py-1"
				>
					<ShieldCheck class="size-3" aria-hidden="true" />
					Admin
				</span>
			</div>

			<div class="flex items-center gap-3">
				<a href="/dashboard" class="tw-ghost px-3 py-1.5 text-[13px]">
					<ArrowLeft class="size-3.5" aria-hidden="true" />
					Aplikasi
				</a>

				<span data-testid="current-user" class="tw-data text-muted hidden text-[12px] md:inline">
					{data.user?.email}
				</span>

				<form method="POST" action="/logout">
					<button
						type="submit"
						data-testid="logout-button"
						class="tw-ghost px-3 py-1.5 text-[13px]"
					>
						<LogOut class="size-3.5" aria-hidden="true" />
						Keluar
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-6 py-8">
		{@render children()}
	</main>
</div>
