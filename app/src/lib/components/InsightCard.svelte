<script lang="ts">
	import { ChevronRight } from 'lucide-svelte';
	import SignatureBadge from './SignatureBadge.svelte';
	import SkorBadge from './SkorBadge.svelte';
	import { judulInsight, labelSubtype, waktuRelatif, type Insight } from '$lib/insight';

	let { insight }: { insight: Insight } = $props();

	const judul = $derived(judulInsight(insight));
</script>

<a
	href="/insights/{insight.id}"
	data-testid="insight-card"
	data-ticker={insight.ticker}
	class="group flex items-start gap-3.5 rounded-xl px-3 py-3 transition hover:bg-white/[0.035]"
>
	<span class="w-13 flex-none pt-0.5">
		<SkorBadge skor={insight.score} showLabel={false} />
	</span>

	<span class="min-w-0 flex-1">
		<span class="flex items-baseline gap-2">
			<span class="tw-data text-ink text-[13.5px] font-semibold tracking-wide"
				>{insight.ticker}</span
			>
			<span class="text-muted truncate text-[12.5px]">{insight.company_name}</span>
			<span class="tw-data text-muted ml-auto flex-none text-[11px]">
				{waktuRelatif(insight.generated_at)}
			</span>
		</span>
		<span class="text-ink mt-1 block text-[14px] leading-snug">{judul}</span>
		<span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
			<span class="tw-overline">{labelSubtype(insight.subtype)}</span>
			<SignatureBadge />
		</span>
	</span>

	<ChevronRight
		class="text-muted group-hover:text-ink mt-1 size-4 flex-none transition group-hover:translate-x-0.5"
		aria-hidden="true"
	/>
</a>
