<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Field from '$lib/components/Field.svelte';

	let { form } = $props();

	let fullName = $state('');
	let email = $state('');
	let password = $state('');
	let submitting = $state(false);

	const fieldErrors = $derived(form?.fields ?? {});

	$effect(() => {
		if (form?.email) email = form.email;
		if (form?.fullName) fullName = form.fullName;
	});
</script>

<svelte:head>
	<title>Daftar TripWire</title>
</svelte:head>

<AuthShell title="Buat akun" subtitle="Pantau emiten IDX dan terima peringatan lebih awal.">
	{#snippet children()}
		<form
			method="POST"
			class="space-y-5"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
				};
			}}
		>
			{#if form?.error}
				<p
					data-testid="register-error"
					role="alert"
					class="border-flag-critical/40 bg-flag-critical/10 text-flag-critical rounded-lg border px-3 py-2.5 text-sm"
				>
					{form.error}
				</p>
			{/if}

			<Field
				id="full_name"
				label="Nama lengkap"
				bind:value={fullName}
				error={fieldErrors.full_name}
				autocomplete="name"
				placeholder="Nama kamu"
			/>

			<Field
				id="email"
				label="Email"
				type="email"
				bind:value={email}
				error={fieldErrors.email}
				autocomplete="email"
				placeholder="nama@email.com"
			/>

			<Field
				id="password"
				label="Password"
				type="password"
				bind:value={password}
				error={fieldErrors.password}
				autocomplete="new-password"
				placeholder="Minimal 10 karakter"
			/>

			<button
				type="submit"
				disabled={submitting}
				class="bg-diamond-500 text-abyss-900 hover:bg-diamond-400 focus:ring-diamond-900 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:outline-none disabled:opacity-60"
			>
				{submitting ? 'Memproses' : 'Daftar'}
			</button>
		</form>
	{/snippet}

	{#snippet footer()}
		Sudah punya akun?
		<a href="/login" class="text-diamond-400 hover:text-diamond-300 font-medium">Masuk</a>
	{/snippet}
</AuthShell>
