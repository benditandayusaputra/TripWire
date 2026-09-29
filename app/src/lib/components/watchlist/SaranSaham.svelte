<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, LoaderCircle, Plus } from 'lucide-svelte';
	import LogoEmiten from './LogoEmiten.svelte';
	import { formatHarga, formatRupiah, formatUbah, type SahamPasar } from '$lib/watchlist';

	let { saham, dipantau, penuh }: { saham: SahamPasar[]; dipantau: string[]; penuh: boolean } =
		$props();

	let mengirim = $state('');
</script>

<ul data-testid="saran-saham" class="grid gap-x-6 sm:grid-cols-2">
	{#each saham as satu (satu.ticker)}
		{@const ubah = formatUbah(satu.daily_close_change)}
		{@const sudah = dipantau.includes(satu.ticker)}
		<li data-testid="saran-item" data-ticker={satu.ticker} class="baris-saran">
			<LogoEmiten kode={satu.ticker} />
			<span class="min-w-0">
				<span class="tw-data text-ink block text-[14px] font-semibold tracking-wide"
					>{satu.ticker}</span
				>
				<span class="text-muted block truncate text-[12px]">{satu.company_name}</span>
			</span>
			<span class="flex flex-col items-end">
				<span class="tw-data text-ink text-[14px]">{formatHarga(satu.last_close_price)}</span>
				<span
					class="tw-data text-[11.5px] {ubah.arah > 0
						? 'text-naik'
						: ubah.arah < 0
							? 'text-turun'
							: 'text-muted'}">{ubah.teks}</span
				>
			</span>
			<span class="tw-data text-muted hidden w-16 text-right text-[11.5px] md:block"
				>{formatRupiah(satu.market_cap)}</span
			>
			<form
				method="POST"
				action="?/tambah"
				use:enhance={() => {
					mengirim = satu.ticker;
					return async ({ update }) => {
						await update();
						mengirim = '';
					};
				}}
			>
				<input type="hidden" name="ticker" value={satu.ticker} />
				<input type="hidden" name="pantau_harian" value="on" />
				<button
					type="submit"
					class="tombol-pantau"
					disabled={penuh || sudah || mengirim !== ''}
					aria-label="Pantau {satu.ticker}"
				>
					{#if mengirim === satu.ticker}
						<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
					{:else if sudah}
						<Check class="size-3.5" aria-hidden="true" />
					{:else}
						<Plus class="size-3.5" aria-hidden="true" />
					{/if}
					<span class="hidden sm:inline">{sudah ? 'Dipantau' : 'Pantau'}</span>
				</button>
			</form>
		</li>
	{/each}
</ul>

<style>
	.baris-saran {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 12px;
		border-bottom: 1px solid var(--edge-soft);
		padding: 10px 2px;
	}

	.tombol-pantau {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--color-diamond-700);
		border-radius: 10px;
		background: rgba(74, 158, 255, 0.08);
		padding: 7px 10px;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-diamond-100);
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	@media (hover: hover) {
		.tombol-pantau:not(:disabled):hover {
			border-color: var(--color-diamond-500);
			background: rgba(74, 158, 255, 0.18);
		}
	}
</style>
