<script lang="ts">
	import { onMount } from 'svelte';
	import { Eye, EyeOff } from 'lucide-svelte';

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

	let tampak = $state(false);
	let siap = $state(false);
	const sandi = $derived(type === 'password');

	onMount(() => (siap = true));
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
			type={sandi && tampak ? 'text' : type}
			{placeholder}
			{required}
			{autocomplete}
			{list}
			bind:value
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
			class="tw-field {icon ? 'pl-10' : ''} {sandi ? 'pr-12' : ''} {mono
				? 'tw-data tracking-wider uppercase'
				: ''}"
		/>
		{#if sandi}
			<button
				type="button"
				aria-controls={id}
				disabled={!siap}
				onclick={() => (tampak = !tampak)}
				class="text-muted hover:text-ink absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-[10px] transition hover:bg-white/5"
			>
				{#if tampak}
					<EyeOff class="size-4.5" aria-hidden="true" />
				{:else}
					<Eye class="size-4.5" aria-hidden="true" />
				{/if}
				<span class="sr-only">{tampak ? 'Sembunyikan password' : 'Tampilkan password'}</span>
			</button>
		{/if}
	</div>

	{#if error}
		<p id="{id}-error" class="text-tier-critical text-[12.5px]">{error}</p>
	{:else if hint}
		<p id="{id}-hint" class="text-muted text-[12.5px]">{hint}</p>
	{/if}
</div>
