<script lang="ts">
	import { page } from '$app/state';
	import { Bell, LayoutGrid, ListChecks, LogOut, UserRound } from 'lucide-svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { authStore } from '$lib/stores/authStore.svelte';

	let { data, children } = $props();

	$effect(() => {
		authStore.set(data.user);
	});

	const menu = [
		{ href: '/dashboard', label: 'Beranda', icon: LayoutGrid },
		{ href: '/watchlist', label: 'Watchlist', icon: ListChecks },
		{ href: '/notifications', label: 'Notifikasi', icon: Bell },
		{ href: '/account', label: 'Akun', icon: UserRound }
	];

	const inisial = $derived(
		(data.user?.full_name ?? '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((bagian: string) => bagian[0]?.toUpperCase() ?? '')
			.join('')
	);

	function aktif(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<div class="min-h-dvh pb-20 sm:pb-0">
	<header class="border-line/70 bg-void/70 sticky top-0 z-20 border-b backdrop-blur-xl">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
			<Wordmark size="sm" href="/dashboard" />

			<nav class="hidden items-center gap-1 sm:flex">
				{#each menu as item (item.href)}
					<a
						href={item.href}
						data-testid="nav-{item.href.slice(1)}"
						aria-current={aktif(item.href) ? 'page' : undefined}
						class="rounded-glass flex items-center gap-2 px-3 py-1.5 text-[13.5px] font-medium transition {aktif(
							item.href
						)
							? 'bg-diamond-500/12 text-diamond-100'
							: 'text-secondary hover:text-ink'}"
					>
						<item.icon class="size-4" aria-hidden="true" />
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="flex items-center gap-3">
				{#if data.user?.avatar_url}
					<img
						src={data.user.avatar_url}
						alt=""
						data-testid="avatar-header"
						class="border-line hidden size-8 rounded-full border object-cover sm:block"
					/>
				{:else}
					<span
						aria-hidden="true"
						class="border-line bg-raised text-diamond-100 hidden size-8 place-items-center rounded-full border text-[12px] font-semibold sm:grid"
					>
						{inisial}
					</span>
				{/if}
				<span data-testid="current-user" class="tw-data text-muted hidden text-[12px] md:inline">
					{data.user?.email}
				</span>

				<form method="POST" action="/logout">
					<button
						type="submit"
						data-testid="logout-button"
						aria-label="Keluar dari akun"
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

	<nav
		class="border-line/70 bg-void/85 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-xl sm:hidden"
	>
		<ul class="mx-auto flex max-w-lg">
			{#each menu as item (item.href)}
				<li class="flex-1">
					<a
						href={item.href}
						aria-current={aktif(item.href) ? 'page' : undefined}
						class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition {aktif(
							item.href
						)
							? 'text-diamond-300'
							: 'text-muted'}"
					>
						<item.icon class="size-5" aria-hidden="true" />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
