<script lang="ts">
	import { TIER_URUT } from '$lib/notifikasi';
	import { tierDariSkor } from '$lib/skor';

	let {
		jumlah,
		tautan,
		aktif = ''
	}: {
		jumlah: Record<(typeof TIER_URUT)[number], number>;
		tautan: (tier: string | null) => string;
		aktif?: string;
	} = $props();

	const WAKIL = { critical: 90, high: 70, moderate: 45, low: 10 } as const;

	const baris = $derived(
		TIER_URUT.map((tier) => ({ tier, info: tierDariSkor(WAKIL[tier]), nilai: jumlah[tier] }))
	);
	const puncak = $derived(Math.max(1, ...baris.map((satu) => satu.nilai)));
	const total = $derived(baris.reduce((hasil, satu) => hasil + satu.nilai, 0));
</script>

<ul class="space-y-1" data-testid="sebaran-tier">
	{#each baris as satu (satu.tier)}
		<li>
			<a
				href={tautan(aktif === satu.tier ? null : satu.tier)}
				data-sveltekit-noscroll
				aria-current={aktif === satu.tier ? 'true' : undefined}
				class="baris"
				class:aktif={aktif === satu.tier}
			>
				<span class="text-secondary flex w-22 flex-none items-center gap-2 text-[12.5px]">
					<span class="kotak" style="background:{satu.info.color}"></span>
					{satu.info.label}
				</span>
				<span class="lajur">
					<span
						class="isi"
						style="width:{satu.nilai
							? Math.max((satu.nilai / puncak) * 100, 4)
							: 0}%; background:{satu.info.color}"
					></span>
				</span>
				<span class="tw-data text-ink w-8 flex-none text-right text-[12.5px]">{satu.nilai}</span>
				<span class="tw-data text-muted w-10 flex-none text-right text-[11px]">
					{total ? Math.round((satu.nilai / total) * 100) : 0}%
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.baris {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 -8px;
		border-radius: 10px;
		padding: 6px 8px;
		transition: background 0.2s ease;
	}

	.baris.aktif {
		background: rgba(74, 158, 255, 0.1);
	}

	@media (hover: hover) {
		.baris:hover {
			background: color-mix(in srgb, var(--cahaya) 4%, transparent);
		}
	}

	.kotak {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 2px;
	}

	.lajur {
		position: relative;
		height: 6px;
		flex: 1;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--kilau) 8%, transparent);
	}

	.isi {
		position: absolute;
		inset: 0 auto 0 0;
		border-radius: 999px;
		transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
</style>
