<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, SearchX, TriangleAlert } from 'lucide-svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { t } from '$lib/bahasa.svelte';

	const hilang = $derived(page.status === 404);
</script>

<svelte:head>
	<title
		>{hilang
			? t('Halaman tidak ditemukan', 'Page not found')
			: t('Terjadi galat', 'Something went wrong')} · TripWire</title
	>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-6 py-16">
	<Wordmark />

	<div class="space-y-4" data-testid="halaman-galat">
		{#if hilang}
			<SearchX class="text-muted size-8" aria-hidden="true" />
		{:else}
			<TriangleAlert class="text-muted size-8" aria-hidden="true" />
		{/if}
		<h1 class="tw-title text-ink">
			{hilang
				? t('Halaman ini tidak ditemukan.', "This page wasn't found.")
				: t('Halaman ini belum bisa dimuat.', "This page couldn't be loaded.")}
		</h1>
		<p class="text-secondary leading-relaxed">
			{page.error?.message && page.error.message !== 'Not Found'
				? page.error.message
				: t(
						'Alamatnya mungkin salah ketik atau sudah tidak dipakai.',
						'The address may be mistyped or no longer in use.'
					)}
		</p>
	</div>

	<div class="flex flex-wrap gap-3">
		<a href="/dashboard" class="tw-primary" data-testid="galat-kembali">
			<ArrowLeft class="size-4" aria-hidden="true" />
			{t('Kembali ke dashboard', 'Back to dashboard')}
		</a>
		<a href="/" class="tw-ghost">{t('Ke beranda', 'Go to home')}</a>
	</div>
</div>
