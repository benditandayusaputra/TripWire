<script lang="ts">
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
	class="tw-card hover:border-diamond-700 flex items-start gap-4 p-5 transition"
>
	<SkorBadge skor={insight.score} showLabel={false} />

	<div class="min-w-0 flex-1 space-y-2">
		<div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
			<span class="tw-data text-diamond-300 text-[15px] font-semibold tracking-wider">
				{insight.ticker}
			</span>
			<span class="tw-caption">{insight.company_name}</span>
			<span class="tw-overline ml-auto">{waktuRelatif(insight.generated_at)}</span>
		</div>

		<p class="text-ink text-[14.5px] leading-snug">{judul}</p>

		<div class="flex flex-wrap items-center gap-3">
			<span class="tw-overline">{labelSubtype(insight.subtype)}</span>
			<SignatureBadge compact />
		</div>
	</div>
</a>
