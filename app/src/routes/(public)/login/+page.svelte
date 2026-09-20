<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { AtSign, KeyRound, LogIn } from 'lucide-svelte';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Field from '$lib/components/Field.svelte';
	import Mark from '$lib/components/Mark.svelte';

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
					class="rounded-glass border-tier-low/35 bg-tier-low/10 text-tier-low flex items-center gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<Mark size={8} color="var(--color-tier-low)" />
					Email berhasil diverifikasi, silakan masuk.
				</p>
			{/if}

			{#if registered === '1'}
				<p
					data-testid="registered-banner"
					class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 flex items-center gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<Mark size={8} />
					Akun sudah dibuat. Masuk untuk melanjutkan.
				</p>
			{/if}

			{#if form?.error}
				<p
					data-testid="login-error"
					role="alert"
					class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical border px-3.5 py-2.5 text-[13.5px]"
				>
					{form.error}
					{#if form.lockedUntil}
						<span class="text-secondary mt-1 block text-[12.5px]">
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
				icon={AtSign}
			/>

			<Field
				id="password"
				label="Password"
				type="password"
				bind:value={password}
				error={fieldErrors.password}
				autocomplete="current-password"
				placeholder="Password kamu"
				icon={KeyRound}
			/>

			<button type="submit" disabled={submitting} class="tw-primary w-full">
				<LogIn class="size-4" aria-hidden="true" />
				{submitting ? 'Memproses' : 'Masuk'}
			</button>
		</form>
	{/snippet}

	{#snippet footer()}
		Belum punya akun?
		<a href="/register" class="text-diamond-300 hover:text-diamond-100 font-medium transition">
			Daftar
		</a>
	{/snippet}
</AuthShell>
