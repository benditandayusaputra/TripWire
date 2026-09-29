<script lang="ts">
	import { CloudOff, RotateCw } from 'lucide-svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { t } from '$lib/bahasa.svelte';
</script>

<svelte:head>
	<title>{t('Sedang offline · TripWire', 'Offline · TripWire')}</title>
</svelte:head>

<div class="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-6 py-16">
	<Wordmark />

	<div class="space-y-4">
		<CloudOff class="text-muted size-8" aria-hidden="true" />
		<h1 data-testid="judul-offline" class="tw-title text-ink">
			{t('Kamu sedang offline.', "You're offline.")}
		</h1>
		<p class="text-secondary leading-relaxed">
			{t(
				'Halaman yang pernah kamu buka tetap bisa dilihat tanpa internet. Untuk insight terbaru, sambungkan lagi ke internet.',
				"Pages you've opened before are still available without internet. Reconnect to get the latest insights."
			)}
		</p>
	</div>

	<button type="button" onclick={() => location.reload()} class="tw-primary self-start">
		<RotateCw class="size-4" aria-hidden="true" />
		{t('Coba lagi', 'Try again')}
	</button>
</div>
