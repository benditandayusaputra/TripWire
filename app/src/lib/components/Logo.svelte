<script lang="ts">
	let {
		size = 28,
		cincin = undefined,
		label = ''
	}: { size?: number; cincin?: boolean; label?: string } = $props();

	const id = $props.id();
	const pakaiCincin = $derived(cincin ?? size >= 40);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	class="tw-gelap flex-none overflow-visible"
	role={label ? 'img' : undefined}
	aria-label={label || undefined}
	aria-hidden={label ? undefined : 'true'}
>
	<defs>
		<linearGradient id="kawat-{id}" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" style="stop-color: var(--color-diamond-500)" stop-opacity="0" />
			<stop offset="0.3" style="stop-color: var(--color-diamond-300)" stop-opacity="0.9" />
			<stop offset="0.7" style="stop-color: var(--color-diamond-300)" stop-opacity="0.9" />
			<stop offset="1" style="stop-color: var(--color-diamond-500)" stop-opacity="0" />
		</linearGradient>
		<linearGradient id="meja-{id}" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" style="stop-color: var(--color-diamond-300)" />
			<stop offset="1" style="stop-color: var(--color-diamond-500)" />
		</linearGradient>
		<clipPath id="potong-{id}">
			<rect x="18.5" y="18.5" width="27" height="27" rx="5" transform="rotate(45 32 32)" />
		</clipPath>
		<filter id="pendar-{id}" x="-60%" y="-60%" width="220%" height="220%">
			<feGaussianBlur stdDeviation="4.5" />
		</filter>
	</defs>

	{#if pakaiCincin}
		<rect
			x="12"
			y="12"
			width="40"
			height="40"
			rx="10"
			transform="rotate(45 32 32)"
			fill="none"
			class="stroke-diamond-500"
			stroke-opacity="0.35"
			stroke-width="1"
		/>
	{/if}
	<rect x="0.5" y="31" width="63" height="2" rx="1" fill="url(#kawat-{id})" />
	<rect
		x="20"
		y="20"
		width="24"
		height="24"
		rx="5"
		transform="rotate(45 32 32)"
		class="fill-diamond-500"
		opacity="0.6"
		filter="url(#pendar-{id})"
	/>
	<g clip-path="url(#potong-{id})">
		<polygon points="32,4 4,32 22.5,32 32,22.5" class="fill-diamond-100" />
		<polygon points="32,4 60,32 41.5,32 32,22.5" class="fill-diamond-300" />
		<polygon points="60,32 32,60 32,41.5 41.5,32" class="fill-diamond-500" />
		<polygon points="4,32 32,60 32,41.5 22.5,32" class="fill-diamond-700" />
		<polygon points="32,22.5 41.5,32 32,41.5 22.5,32" fill="url(#meja-{id})" />
	</g>
	<rect
		x="18.5"
		y="18.5"
		width="27"
		height="27"
		rx="5"
		transform="rotate(45 32 32)"
		fill="none"
		class="stroke-white"
		stroke-opacity="0.3"
		stroke-width="0.7"
	/>
</svg>
