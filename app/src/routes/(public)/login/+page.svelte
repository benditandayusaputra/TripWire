<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { AtSign, KeyRound, LogIn, RefreshCw, ShieldCheck, Volume2 } from 'lucide-svelte';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Field from '$lib/components/Field.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let { form } = $props();

	let email = $state('');
	let password = $state('');
	let totpCode = $state('');
	let submitting = $state(false);

	let captcha = $state<{ captcha_id: string; image: string } | null>(null);
	let captchaGagal = $state(false);
	let memuatCaptcha = $state(true);
	let jawaban = $state('');
	let suara = $state<HTMLAudioElement>();

	const verified = $derived(page.url.searchParams.get('verified'));
	const registered = $derived(page.url.searchParams.get('registered'));
	const fieldErrors = $derived(form?.fields ?? {});
	const butuhTOTP = $derived(form?.totpRequired === true);

	$effect(() => {
		if (form?.email) email = form.email;
	});

	async function muatCaptcha() {
		memuatCaptcha = true;
		jawaban = '';
		try {
			const response = await fetch('/api/auth/captcha', { method: 'POST' });
			if (!response.ok) throw new Error(String(response.status));
			captcha = await response.json();
			captchaGagal = false;
		} catch {
			captcha = null;
			captchaGagal = true;
		}
		memuatCaptcha = false;
	}

	onMount(muatCaptcha);

	function formatWaktu(value: string) {
		return new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Masuk ke TripWire</title>
</svelte:head>

<AuthShell title="Masuk ke TripWire" subtitle="Lanjutkan memantau emiten yang kamu awasi.">
	<form
		method="POST"
		class="space-y-5"
		use:enhance={() => {
			submitting = true;
			return async ({ result, update }) => {
				await update({ reset: false });
				submitting = false;
				if (result.type === 'failure' || result.type === 'error') muatCaptcha();
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

		{#if butuhTOTP}
			<div data-testid="totp-diperlukan" class="space-y-3">
				<p
					class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<ShieldCheck class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
					Akun ini dilindungi dua faktor. Masukkan kode dari aplikasi authenticator, atau salah satu kode
					cadangan kamu.
				</p>

				<Field
					id="totp_code"
					label="Kode verifikasi"
					bind:value={totpCode}
					error={fieldErrors.totp_code}
					autocomplete="one-time-code"
					placeholder="123456"
					mono
				/>
			</div>
		{/if}

		<div class="space-y-1.5">
			<label for="captcha_answer" class="text-secondary block text-[13.5px] font-medium"
				>Kode captcha</label
			>
			<div class="flex gap-2">
				<div class="slip" data-testid="captcha" aria-busy={memuatCaptcha}>
					{#if captcha}
						<img src={captcha.image} alt="Kode captcha berisi 6 angka" width="180" height="60" />
					{:else if captchaGagal}
						<span class="text-tier-critical px-3 text-center text-[12.5px]"
							>Kode gagal dimuat, coba lagi</span
						>
					{/if}
				</div>
				<button type="button" onclick={muatCaptcha} disabled={memuatCaptcha} class="tombol-ikon">
					<RefreshCw class="size-4 {memuatCaptcha ? 'animate-spin' : ''}" aria-hidden="true" />
					<span class="sr-only">Ganti kode captcha</span>
				</button>
				<button
					type="button"
					onclick={() => suara?.play().catch(muatCaptcha)}
					disabled={!captcha}
					class="tombol-ikon"
				>
					<Volume2 class="size-4" aria-hidden="true" />
					<span class="sr-only">Dengarkan kode captcha dalam bahasa Inggris</span>
				</button>
			</div>
			<input
				id="captcha_answer"
				name="captcha_answer"
				bind:value={jawaban}
				required
				inputmode="numeric"
				autocomplete="off"
				maxlength="6"
				placeholder="Ketik 6 angka pada gambar"
				aria-invalid={fieldErrors.captcha_answer ? 'true' : undefined}
				aria-describedby={fieldErrors.captcha_answer ? 'captcha_answer-error' : undefined}
				class="tw-field tw-data tracking-[0.35em] placeholder:font-sans placeholder:tracking-normal"
			/>
			{#if fieldErrors.captcha_answer}
				<p id="captcha_answer-error" class="text-tier-critical text-[12.5px]">
					{fieldErrors.captcha_answer}
				</p>
			{/if}
			<input type="hidden" name="captcha_id" value={captcha?.captcha_id ?? ''} />
			{#if captcha}
				<audio bind:this={suara} src="/api/auth/captcha/{captcha.captcha_id}/audio" preload="none"
				></audio>
			{/if}
		</div>

		<button type="submit" disabled={submitting} class="tw-primary w-full">
			<LogIn class="size-4" aria-hidden="true" />
			{submitting ? 'Memproses' : 'Masuk'}
		</button>
	</form>
</AuthShell>

<style>
	.slip {
		display: grid;
		flex: 1;
		min-width: 0;
		height: 60px;
		place-items: center;
		overflow: hidden;
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-glass);
		background:
			repeating-linear-gradient(-45deg, rgba(180, 205, 255, 0.035) 0 6px, transparent 6px 12px),
			rgba(8, 11, 18, 0.55);
	}

	.slip[aria-busy='true'] img {
		opacity: 0.35;
	}

	.slip img {
		filter: invert(1) grayscale(1) brightness(1.15);
		transition: opacity 0.2s ease;
	}

	.tombol-ikon {
		display: grid;
		width: 56px;
		height: 60px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: var(--radius-glass);
		color: var(--color-secondary);
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease;
	}

	@media (hover: hover) {
		.tombol-ikon:not(:disabled):hover {
			border-color: var(--color-diamond-700);
			background: rgba(74, 158, 255, 0.06);
			color: var(--color-ink);
		}
	}
</style>
