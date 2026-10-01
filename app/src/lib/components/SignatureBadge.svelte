<script lang="ts">
	import Mark from './Mark.svelte';
	import { t } from '$lib/bahasa.svelte';
</script>

<span data-testid="signature-badge" class="inline-flex items-center gap-1.5">
	<Mark size={7} color="var(--color-tier-low)" />
	<span class="tw-overline text-tier-low">{t('Terverifikasi', 'Verified')}</span>
</span>
