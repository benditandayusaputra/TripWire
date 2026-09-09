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

	let { data, form } = $props();

	let kode = $state('');
	let password = $state('');

	const setup = $derived(form?.setup);
	const backupCodes = $derived(form?.backupCodes ?? []);
	const aktif = $derived(data.status.enabled);
</script>

<svelte:head>
	<title>Keamanan akun TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">Akun</p>
		<h1 class="tw-title text-ink">Keamanan</h1>
		<p class="tw-caption">
			Lapisan kedua saat masuk, supaya password yang bocor saja tidak cukup untuk membuka akun.
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
					<h2 class="tw-heading text-ink">Aplikasi authenticator</h2>
					<p class="tw-caption mt-1">
						Kode enam angka yang berganti tiap 30 detik dari Google Authenticator, Authy, atau
						sejenisnya.
					</p>
				</div>
			</div>

			<span
				data-testid="status-2fa"
				data-aktif={aktif}
				class="tw-overline inline-flex items-center gap-2 {aktif ? 'text-tier-low' : 'text-muted'}"
			>
				<Mark size={7} color={aktif ? 'var(--color-tier-low)' : 'var(--color-muted)'} />
				{aktif ? 'Aktif' : 'Belum aktif'}
			</span>
		</div>

		{#if backupCodes.length > 0}
			<div
				data-testid="backup-codes"
				class="rounded-glass border-tier-low/35 bg-tier-low/10 space-y-3 border p-4"
			>
				<p class="tw-overline text-tier-low flex items-center gap-2">
					<ShieldCheck class="size-3.5" aria-hidden="true" />
					Kode cadangan, ditampilkan sekali ini saja
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
					Tiap kode hanya bisa dipakai sekali, gunakan kalau kamu kehilangan akses ke aplikasi
					authenticator.
				</p>
			</div>
		{/if}

		{#if aktif}
			<div class="flex flex-wrap items-center gap-3">
				<p class="tw-caption flex-1">
					Sisa kode cadangan yang belum terpakai: <span class="tw-data text-ink"
						>{data.status.backup_codes_left}</span
					>
				</p>

				<form method="POST" action="?/kodeBaru" use:enhance>
					<button type="submit" data-testid="kode-baru" class="tw-ghost text-[13.5px]">
						<KeyRound class="size-3.5" aria-hidden="true" />
						Buat kode cadangan baru
					</button>
				</form>
			</div>

			<form method="POST" action="?/matikan" class="flex flex-wrap items-end gap-3" use:enhance>
				<div class="min-w-[12rem] flex-1">
					<Field
						id="password"
						label="Konfirmasi password untuk mematikan"
						type="password"
						bind:value={password}
						error={form?.fields?.password}
						autocomplete="current-password"
						placeholder="Password kamu"
						icon={KeyRound}
					/>
				</div>
				<button type="submit" data-testid="matikan-2fa" class="tw-ghost">
					<ShieldOff class="size-4" aria-hidden="true" />
					Matikan dua faktor
				</button>
			</form>
		{:else if setup}
			<div data-testid="setup-2fa" class="space-y-5">
				<div class="flex flex-wrap items-start gap-6">
					<img
						src={setup.qr_code}
						alt="Kode QR untuk didaftarkan ke aplikasi authenticator"
						data-testid="qr-2fa"
						class="rounded-glass border-line size-40 border bg-white p-2"
					/>

					<div class="min-w-[14rem] flex-1 space-y-2">
						<p class="tw-overline">Atau masukkan manual</p>
						<p data-testid="secret-2fa" class="tw-data text-diamond-300 text-[15px] break-all">
							{setup.secret}
						</p>
						<p class="tw-caption">
							Setelah tersimpan di aplikasi, masukkan kode enam angka yang muncul untuk memastikan
							jamnya sinkron.
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
							label="Kode dari aplikasi"
							bind:value={kode}
							error={form?.fields?.code}
							autocomplete="one-time-code"
							placeholder="123456"
							mono
						/>
					</div>
					<button type="submit" data-testid="konfirmasi-2fa" class="tw-primary">
						<ShieldCheck class="size-4" aria-hidden="true" />
						Aktifkan
					</button>
				</form>
			</div>
		{:else}
			<form method="POST" action="?/mulai" use:enhance>
				<button type="submit" data-testid="mulai-2fa" class="tw-primary">
					<ShieldCheck class="size-4" aria-hidden="true" />
					Aktifkan dua faktor
				</button>
			</form>
		{/if}
	</div>

	<div class="tw-card space-y-3 p-6">
		<div class="flex items-start gap-3">
			<Fingerprint class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
			<div>
				<h2 class="tw-heading text-ink">Sidik jari dan security key</h2>
				<p class="tw-caption mt-1">
					{#if data.status.webauthn_enabled}
						WebAuthn aktif di server ini. Terdaftar: <span class="tw-data text-ink"
							>{data.status.webauthn_credentials}</span
						> authenticator.
					{:else}
						WebAuthn dimatikan lewat feature flag di konfigurasi server, jadi endpoint-nya tidak
						terpasang.
					{/if}
				</p>
			</div>
		</div>
	</div>
</section>
