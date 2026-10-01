<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import {
		AtSign,
		KeyRound,
		LoaderCircle,
		LogIn,
		RefreshCw,
		ShieldCheck,
		Volume2
	} from 'lucide-svelte';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import Field from '$lib/components/Field.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { lokal, t } from '$lib/bahasa.svelte';

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
		return new Date(value).toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>{t('Masuk ke TripWire', 'Log in to TripWire')}</title>
</svelte:head>

<AuthShell
	title={t('Masuk ke TripWire', 'Log in to TripWire')}
	subtitle={t(
		'Lanjutkan memantau emiten yang kamu awasi.',
		'Keep monitoring the stocks you watch.'
	)}
>
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
				{t('Email berhasil diverifikasi, silakan masuk.', 'Email verified. Please log in.')}
			</p>
		{/if}

		{#if registered === '1'}
			<p
				data-testid="registered-banner"
				class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 flex items-center gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
			>
				<Mark size={8} />
				{t('Akun sudah dibuat. Masuk untuk melanjutkan.', 'Account created. Log in to continue.')}
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
						{t(
							`Coba lagi setelah pukul ${formatWaktu(form.lockedUntil)}.`,
							`Try again after ${formatWaktu(form.lockedUntil)}.`
						)}
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
			placeholder={t('nama@email.com', 'name@email.com')}
			icon={AtSign}
		/>

		<Field
			id="password"
			label="Password"
			type="password"
			bind:value={password}
			error={fieldErrors.password}
			autocomplete="current-password"
			placeholder={t('Password kamu', 'Your password')}
			icon={KeyRound}
		/>

		{#if butuhTOTP}
			<div data-testid="totp-diperlukan" class="space-y-3">
				<p
					class="rounded-glass border-diamond-700 bg-diamond-900/40 text-diamond-100 flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
				>
					<ShieldCheck class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
					{t(
						'Akun ini dilindungi dua faktor. Masukkan kode dari aplikasi authenticator, atau salah satu kode cadangan kamu.',
						'This account is protected with two-factor authentication. Enter the code from your authenticator app, or one of your backup codes.'
					)}
				</p>

				<Field
					id="totp_code"
					label={t('Kode verifikasi', 'Verification code')}
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
				>{t('Kode captcha', 'Captcha code')}</label
			>
			<div class="flex gap-2">
				<div class="slip tw-gelap" data-testid="captcha" aria-busy={memuatCaptcha}>
					{#if captcha}
						<img
							src={captcha.image}
							alt={t('Kode captcha berisi 6 angka', 'Captcha code with 6 digits')}
							width="180"
							height="60"
						/>
					{:else if captchaGagal}
						<span class="text-tier-critical px-3 text-center text-[12.5px]"
							>{t('Kode gagal dimuat, coba lagi', "Couldn't load the code, try again")}</span
						>
					{/if}
				</div>
				<button type="button" onclick={muatCaptcha} disabled={memuatCaptcha} class="tombol-ikon">
					<RefreshCw class="size-4 {memuatCaptcha ? 'animate-spin' : ''}" aria-hidden="true" />
					<span class="sr-only">{t('Ganti kode captcha', 'Get a new captcha code')}</span>
				</button>
				<button
					type="button"
					onclick={() => suara?.play().catch(muatCaptcha)}
					disabled={!captcha}
					class="tombol-ikon"
				>
					<Volume2 class="size-4" aria-hidden="true" />
					<span class="sr-only"
						>{t(
							'Dengarkan kode captcha dalam bahasa Inggris',
							'Listen to the captcha code in English'
						)}</span
					>
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
				placeholder={t('Ketik 6 angka pada gambar', 'Type the 6 digits in the image')}
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

		<button type="submit" disabled={submitting} aria-busy={submitting} class="tw-primary w-full">
			{#if submitting}
				<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
			{:else}
				<LogIn class="size-4" aria-hidden="true" />
			{/if}
			{submitting ? t('Memproses', 'Processing') : t('Masuk', 'Log in')}
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
			repeating-linear-gradient(
				-45deg,
				color-mix(in srgb, var(--kilau) 3.5%, transparent) 0 6px,
				transparent 6px 12px
			),
			color-mix(in srgb, var(--color-void) 55%, var(--color-base));
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
