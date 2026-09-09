<script lang="ts">
	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		error = '',
		autocomplete,
		placeholder = '',
		required = true
	} = $props();
</script>

<div class="space-y-1.5">
	<label for={id} class="text-ink-200 block text-sm font-medium">{label}</label>
	<input
		{id}
		name={id}
		{type}
		{placeholder}
		{required}
		{autocomplete}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		class="border-abyss-400 bg-abyss-700 text-ink-100 placeholder:text-ink-500 focus:border-diamond-500 focus:ring-diamond-900 aria-[invalid=true]:border-flag-critical w-full rounded-lg border px-3 py-2.5 text-sm transition outline-none focus:ring-2"
	/>
	{#if error}
		<p id="{id}-error" class="text-flag-critical text-xs">{error}</p>
	{/if}
</div>
