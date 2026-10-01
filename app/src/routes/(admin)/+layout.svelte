<script lang="ts">
	import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-svelte';
	import Preferensi from '$lib/components/Preferensi.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { t } from '$lib/bahasa.svelte';

	let { data, children } = $props();
</script>

<div class="min-h-dvh">
	<header class="border-line/70 bg-void/70 sticky top-0 z-20 border-b backdrop-blur-xl">
		<div
			class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:gap-4 sm:px-6"
		>
			<div class="flex items-center gap-5">
				<Wordmark size="sm" href="/dashboard" />
				<span
					class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 tw-overline hidden items-center gap-1.5 border px-2.5 py-1 sm:inline-flex"
				>
					<ShieldCheck class="size-3" aria-hidden="true" />
					Admin
				</span>
			</div>

			<div class="flex items-center gap-2 sm:gap-3">
				<Preferensi />

				<a
					href="/dashboard"
					class="tw-ghost px-3 py-1.5 text-[13px] whitespace-nowrap"
					aria-label={t('Kembali ke aplikasi', 'Back to the app')}
				>
					<ArrowLeft class="size-3.5" aria-hidden="true" />
					<span class="hidden sm:inline">{t('Aplikasi', 'App')}</span>
				</a>

				<span
					data-testid="current-user"
					class="tw-data text-muted hidden max-w-[14rem] truncate text-[12px] lg:inline"
					title={data.user?.email}
				>
					{data.user?.email}
				</span>

				<form method="POST" action="/logout">
					<button
						type="submit"
						data-testid="logout-button"
						aria-label={t('Keluar dari akun', 'Log out of your account')}
						class="tw-ghost px-3 py-1.5 text-[13px] whitespace-nowrap"
					>
						<LogOut class="size-3.5" aria-hidden="true" />
						<span class="hidden sm:inline">{t('Keluar', 'Log out')}</span>
					</button>
				</form>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
		{@render children()}
	</main>
</div>
