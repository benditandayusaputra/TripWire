<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import KondisiLabel from '$lib/components/KondisiLabel.svelte';
	import {
		ubahKondisiPeringatan,
		type EmitenDipantau,
		type KondisiPeringatan
	} from '$lib/api/notifications';
	import { t } from '$lib/bahasa.svelte';

	let { emiten }: { emiten: EmitenDipantau[] } = $props();

	let mengubah = $state('');
	let galat = $state('');

	async function ubah(item: EmitenDipantau, kondisi: KondisiPeringatan) {
		if (mengubah) return;
		mengubah = kondisi.id;
		galat = '';
		try {
			await ubahKondisiPeringatan(item.id, kondisi.id, !kondisi.is_active);
			await invalidateAll();
		} catch (err) {
			galat =
				err instanceof Error
					? err.message
					: t('Kondisi gagal diubah.', "Couldn't update the condition.");
		} finally {
			mengubah = '';
		}
	}
</script>

{#if emiten.length}
	<ul class="space-y-3" data-testid="aturan-peringatan">
		{#each emiten as item (item.id)}
			<li class="space-y-1.5" data-ticker={item.ticker}>
				<p class="flex items-baseline gap-2">
					<span class="tw-data text-ink text-[13px] font-semibold">{item.ticker}</span>
					<span class="text-muted truncate text-[11.5px]">{item.company_name}</span>
				</p>

				{#if item.conditions.length}
					<ul class="space-y-1">
						{#each item.conditions as kondisi (kondisi.id)}
							<li class="kondisi">
								<span id="label-{kondisi.id}" class="min-w-0 flex-1 truncate text-[12.5px]">
									<KondisiLabel type={kondisi.condition_type} config={kondisi.config} />
								</span>
								<button
									type="button"
									role="switch"
									aria-checked={kondisi.is_active}
									aria-labelledby="label-{kondisi.id}"
									data-testid="sakelar-kondisi"
									class="sakelar"
									disabled={mengubah === kondisi.id}
									onclick={() => ubah(item, kondisi)}
								>
									<span class="kenop"></span>
								</button>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-muted text-[12px]">
						{t(
							'Belum ada kondisi, semua insight dikirim.',
							'No conditions yet, so every insight is sent.'
						)}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
	{#if galat}
		<p class="text-tier-critical mt-2 text-[12.5px]" role="alert">{galat}</p>
	{/if}
{:else}
	<p class="text-muted text-[12.5px]">
		{t(
			'Belum ada saham di watchlist, jadi belum ada yang dipantau.',
			'No stocks on your watchlist yet, so nothing is being monitored.'
		)}
	</p>
{/if}

<style>
	.kondisi {
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: 10px;
		background: var(--color-void);
		padding: 6px 8px 6px 10px;
	}

	.sakelar {
		position: relative;
		width: 34px;
		height: 20px;
		flex: none;
		border: 1px solid var(--edge-strong);
		border-radius: 999px;
		background: var(--color-raised);
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.sakelar[aria-checked='true'] {
		border-color: var(--color-diamond-500);
		background: var(--color-diamond-700);
	}

	.kenop {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 999px;
		background: var(--color-muted);
		transition:
			transform 0.2s ease,
			background 0.2s ease;
	}

	.sakelar[aria-checked='true'] .kenop {
		background: var(--color-diamond-100);
		transform: translateX(14px);
	}
</style>
