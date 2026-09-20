<script lang="ts">
	import { enhance } from '$app/forms';
	import { AtSign, KeyRound, User, UserPlus } from 'lucide-svelte';
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
					class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical border px-3.5 py-2.5 text-[13.5px]"
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
				icon={User}
			/>

			<Field
				id="email"
				label="Email"
				type="email"
				bind:value={email}
				error={fieldErrors.email}
				autocomplete="email"
				placeholder="nama@email.com"
				icon={AtSign}
			/>

			<Field
				id="password"
				label="Password"
				type="password"
				bind:value={password}
				error={fieldErrors.password}
				autocomplete="new-password"
				placeholder="Minimal 10 karakter"
				icon={KeyRound}
				hint="Minimal 10 karakter, memuat huruf dan angka."
			/>

			<button type="submit" disabled={submitting} class="tw-primary w-full">
				<UserPlus class="size-4" aria-hidden="true" />
				{submitting ? 'Memproses' : 'Daftar'}
			</button>
		</form>
	{/snippet}

	{#snippet footer()}
		Sudah punya akun?
		<a href="/login" class="text-diamond-300 hover:text-diamond-100 font-medium transition">Masuk</a>
	{/snippet}
</AuthShell>
