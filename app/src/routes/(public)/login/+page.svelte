<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Field from '$lib/components/Field.svelte';

	let { form } = $props();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);

	const verified = $derived(page.url.searchParams.get('verified'));
	const registered = $derived(page.url.searchParams.get('registered'));
	const fieldErrors = $derived(form?.fields ?? {});

	$effect(() => {
		if (form?.email) email = form.email;
	});

	function formatWaktu(value: string) {
		return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Masuk ke TripWire</title>
</svelte:head>

<AuthShell title="Masuk" subtitle="Lanjutkan memantau emiten yang kamu awasi.">
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
			{#if verified === '1'}
				<p
					data-testid="verified-banner"
					class="border-flag-clear/40 bg-flag-clear/10 text-flag-clear rounded-lg border px-3 py-2.5 text-sm"
				>
					Email berhasil diverifikasi, silakan masuk.
				</p>
			{/if}

			{#if registered === '1'}
				<p
					data-testid="registered-banner"
					class="border-diamond-700 bg-diamond-900/30 text-diamond-200 rounded-lg border px-3 py-2.5 text-sm"
				>
					Akun sudah dibuat. Masuk untuk melanjutkan.
				</p>
			{/if}

			{#if form?.error}
				<p
					data-testid="login-error"
					role="alert"
					class="border-flag-critical/40 bg-flag-critical/10 text-flag-critical rounded-lg border px-3 py-2.5 text-sm"
				>
					{form.error}
					{#if form.lockedUntil}
						<span class="text-ink-300 mt-1 block text-xs">
							Coba lagi setelah pukul {formatWaktu(form.lockedUntil)}.
						</span>
					{/if}
				</p>
			{/if}

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
				autocomplete="current-password"
				placeholder="Password kamu"
			/>

			<button
				type="submit"
				disabled={submitting}
				class="bg-diamond-500 text-abyss-900 hover:bg-diamond-400 focus:ring-diamond-900 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:outline-none disabled:opacity-60"
			>
				{submitting ? 'Memproses' : 'Masuk'}
			</button>
		</form>
	{/snippet}

	{#snippet footer()}
		Belum punya akun?
		<a href="/register" class="text-diamond-400 hover:text-diamond-300 font-medium">Daftar</a>
	{/snippet}
</AuthShell>
