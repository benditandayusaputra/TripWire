<script lang="ts">
	import { ShieldCheck } from 'lucide-svelte';
	import Mark from './Mark.svelte';

	let { hash = '', algorithm = 'Ed25519', sealedAt = '', compact = false } = $props();

	const potongan = $derived(hash ? `0x${hash.slice(0, 4)}...${hash.slice(-4)}` : '');

	const waktu = $derived.by(() => {
		if (!sealedAt) return '';
		const tanggal = new Date(sealedAt);
		return tanggal
			.toLocaleString('id-ID', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Asia/Jakarta'
			})
			.toUpperCase();
	});
</script>

{#if compact}
	<span data-testid="signature-badge" class="inline-flex items-center gap-1.5">
		<Mark size={7} color="var(--color-tier-low)" />
		<span class="tw-overline text-tier-low">Terverifikasi</span>
	</span>
{:else}
	<div
		data-testid="signature-badge"
		class="tw-glass flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5"
	>
		<span class="inline-flex items-center gap-2">
			<ShieldCheck class="text-tier-low size-4" aria-hidden="true" />
			<span class="tw-overline text-tier-low">Signature terverifikasi</span>
		</span>
		<span class="tw-data text-secondary text-[12px]"
			>{algorithm}{potongan ? ` · ${potongan}` : ''}</span
		>
		{#if waktu}
			<span class="tw-overline">Sealed {waktu} WIB</span>
		{/if}
	</div>
{/if}
