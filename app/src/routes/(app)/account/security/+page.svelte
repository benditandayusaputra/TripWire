<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Fingerprint,
		KeyRound,
		ShieldCheck,
		ShieldOff,
		Smartphone,
		TriangleAlert
	} from 'lucide-svelte';
	import Field from '$lib/components/Field.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { t } from '$lib/bahasa.svelte';

	let { data, form } = $props();

	let kode = $state('');
	let password = $state('');

	const setup = $derived(form?.setup);
	const backupCodes = $derived(form?.backupCodes ?? []);
	const aktif = $derived(data.status.enabled);
</script>

<svelte:head>
	<title>{t('Keamanan akun TripWire', 'TripWire account security')}</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">{t('Akun', 'Account')}</p>
		<h1 class="tw-title text-ink">{t('Keamanan', 'Security')}</h1>
		<p class="tw-caption">
			{t(
				'Lapisan kedua saat masuk, supaya password yang bocor saja tidak cukup untuk membuka akun.',
				'A second layer when you log in, so a leaked password alone is not enough to open your account.'
			)}
		</p>
	</header>

	{#if form?.error}
		<p
			data-testid="security-error"
			role="alert"
			class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	<div class="tw-card space-y-5 p-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-start gap-3">
				<Smartphone class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
				<div>
					<h2 class="tw-heading text-ink">{t('Aplikasi authenticator', 'Authenticator app')}</h2>
					<p class="tw-caption mt-1">
						{t(
							'Kode enam angka yang berganti tiap 30 detik dari Google Authenticator, Authy, atau sejenisnya.',
							'A six-digit code that changes every 30 seconds, from Google Authenticator, Authy, or a similar app.'
						)}
					</p>
				</div>
			</div>

			<span
				data-testid="status-2fa"
				data-aktif={aktif}
				class="tw-overline inline-flex items-center gap-2 {aktif ? 'text-tier-low' : 'text-muted'}"
			>
				<Mark size={7} color={aktif ? 'var(--color-tier-low)' : 'var(--color-muted)'} />
				{aktif ? t('Aktif', 'Enabled') : t('Belum aktif', 'Not enabled')}
			</span>
		</div>

		{#if backupCodes.length > 0}
			<div
				data-testid="backup-codes"
				class="rounded-glass border-tier-low/35 bg-tier-low/10 space-y-3 border p-4"
			>
				<p class="tw-overline text-tier-low flex items-center gap-2">
					<ShieldCheck class="size-3.5" aria-hidden="true" />
					{t('Kode cadangan, ditampilkan sekali ini saja', 'Backup codes, shown only this once')}
				</p>
				<ul class="grid grid-cols-2 gap-2 sm:grid-cols-5">
					{#each backupCodes as kodeCadangan (kodeCadangan)}
						<li
							class="tw-data text-ink rounded-glass-sm bg-void/60 px-2 py-1.5 text-center text-[13px]"
						>
							{kodeCadangan}
						</li>
					{/each}
				</ul>
				<p class="tw-caption">
					{t(
						'Tiap kode hanya bisa dipakai sekali, gunakan kalau kamu kehilangan akses ke aplikasi authenticator.',
						'Each code works only once. Use one if you lose access to your authenticator app.'
					)}
				</p>
			</div>
		{/if}

		{#if aktif}
			<div class="flex flex-wrap items-center gap-3">
				<p class="tw-caption flex-1">
					{t('Sisa kode cadangan yang belum terpakai:', 'Unused backup codes left:')}
					<span class="tw-data text-ink">{data.status.backup_codes_left}</span>
				</p>

				<form method="POST" action="?/kodeBaru" use:enhance>
					<button type="submit" data-testid="kode-baru" class="tw-ghost text-[13.5px]">
						<KeyRound class="size-3.5" aria-hidden="true" />
						{t('Buat kode cadangan baru', 'Generate new backup codes')}
					</button>
				</form>
			</div>

			<form method="POST" action="?/matikan" class="flex flex-wrap items-end gap-3" use:enhance>
				<div class="min-w-[12rem] flex-1">
					<Field
						id="password"
						label={t('Konfirmasi password untuk mematikan', 'Confirm your password to turn it off')}
						type="password"
						bind:value={password}
						error={form?.fields?.password}
						autocomplete="current-password"
						placeholder={t('Password kamu', 'Your password')}
						icon={KeyRound}
					/>
				</div>
				<button type="submit" data-testid="matikan-2fa" class="tw-ghost">
					<ShieldOff class="size-4" aria-hidden="true" />
					{t('Matikan dua faktor', 'Turn off two-factor')}
				</button>
			</form>
		{:else if setup}
			<div data-testid="setup-2fa" class="space-y-5">
				<div class="flex flex-wrap items-start gap-6">
					<img
						src={setup.qr_code}
						alt={t(
							'Kode QR untuk didaftarkan ke aplikasi authenticator',
							'QR code to register in your authenticator app'
						)}
						data-testid="qr-2fa"
						class="rounded-glass border-line size-40 border bg-white p-2"
					/>

					<div class="min-w-[14rem] flex-1 space-y-2">
						<p class="tw-overline">{t('Atau masukkan manual', 'Or enter it manually')}</p>
						<p data-testid="secret-2fa" class="tw-data text-diamond-300 text-[15px] break-all">
							{setup.secret}
						</p>
						<p class="tw-caption">
							{t(
								'Setelah tersimpan di aplikasi, masukkan kode enam angka yang muncul untuk memastikan jamnya sinkron.',
								'Once it is saved in the app, enter the six-digit code it shows to make sure the clocks are in sync.'
							)}
						</p>
					</div>
				</div>

				<form
					method="POST"
					action="?/konfirmasi"
					class="flex flex-wrap items-end gap-3"
					use:enhance
				>
					<input type="hidden" name="setup" value={JSON.stringify(setup)} />
					<div class="min-w-[10rem] flex-1">
						<Field
							id="code"
							label={t('Kode dari aplikasi', 'Code from the app')}
							bind:value={kode}
							error={form?.fields?.code}
							autocomplete="one-time-code"
							placeholder="123456"
							mono
						/>
					</div>
					<button type="submit" data-testid="konfirmasi-2fa" class="tw-primary">
						<ShieldCheck class="size-4" aria-hidden="true" />
						{t('Aktifkan', 'Enable')}
					</button>
				</form>
			</div>
		{:else}
			<form method="POST" action="?/mulai" use:enhance>
				<button type="submit" data-testid="mulai-2fa" class="tw-primary">
					<ShieldCheck class="size-4" aria-hidden="true" />
					{t('Aktifkan dua faktor', 'Enable two-factor')}
				</button>
			</form>
		{/if}
	</div>

	<div class="tw-card space-y-3 p-6">
		<div class="flex items-start gap-3">
			<Fingerprint class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
			<div>
				<h2 class="tw-heading text-ink">
					{t('Sidik jari dan security key', 'Fingerprint and security key')}
				</h2>
				<p class="tw-caption mt-1">
					{#if data.status.webauthn_enabled}
						{t(
							'Masuk dengan sidik jari atau security key sudah bisa dipakai. Perangkat terdaftar:',
							'You can log in with a fingerprint or security key. Registered devices:'
						)}
						<span class="tw-data text-ink">{data.status.webauthn_credentials}</span>.
					{:else}
						{t(
							'Masuk dengan sidik jari atau security key belum tersedia untuk saat ini.',
							'Logging in with a fingerprint or security key is not available yet.'
						)}
					{/if}
				</p>
			</div>
		</div>
	</div>
</section>
