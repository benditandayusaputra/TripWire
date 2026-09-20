<script lang="ts">
	let {
		id,
		label,
		type = 'text',
		value = $bindable(''),
		error = '',
		autocomplete,
		placeholder = '',
		hint = '',
		icon = undefined,
		mono = false,
		list = undefined,
		required = true
	} = $props();
</script>

<div class="space-y-1.5">
	<label for={id} class="text-secondary block text-[13.5px] font-medium">{label}</label>

	<div class="relative">
		{#if icon}
			{@const Icon = icon}
			<Icon
				class="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
				aria-hidden="true"
			/>
		{/if}
		<input
			{id}
			name={id}
			{type}
			{placeholder}
			{required}
			{autocomplete}
			{list}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
			class="tw-field {icon ? 'pl-10' : ''} {mono ? 'tw-data tracking-wider uppercase' : ''}"
		/>
	</div>

	{#if error}
		<p id="{id}-error" class="text-tier-critical text-[12.5px]">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="text-muted text-[12.5px]">{hint}</p>
	{/if}
</div>
