<script lang="ts">
	import { Search, ShieldCheck, ShieldX } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { formatTanggal } from '$lib/insight';

	let { data } = $props();

	let id = $state('');

	const hasil = $derived(data.hasil);

	$effect(() => {
		id = data.id;
	});

	const barisTeknis = $derived(
		hasil
			? [
					{ label: 'Algoritma', nilai: hasil.algorithm },
					{ label: 'Public key', nilai: hasil.public_key },
					{ label: 'Digest', nilai: hasil.digest },
					{ label: 'Signature', nilai: hasil.signature },
					{
						label: 'Hash sebelumnya',
						nilai: hasil.prev_hash ?? 'tidak ada, ini mata rantai pertama'
					},
					{ label: 'Hash saat ini', nilai: hasil.current_hash }
				]
			: []
	);
</script>

<svelte:head>
	<title>Verifikasi insight TripWire</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-6 py-8">
	<header class="flex items-center justify-between">
		<Wordmark />
		<a href="/login" class="tw-ghost text-[14px]">Masuk</a>
	</header>

	<main class="space-y-7 py-12">
		<div class="space-y-3">
			<p class="tw-overline">Verifikasi publik</p>
			<h1 class="tw-display text-ink">Cek keaslian sebuah insight.</h1>
			<p class="text-secondary max-w-xl leading-relaxed">
				Tempel ID insight untuk memeriksa tanda tangan Ed25519 dan rantai hash-nya. Tidak perlu
				akun, siapa pun bisa memverifikasi sendiri.
			</p>
		</div>

		<form method="GET" class="flex flex-wrap items-end gap-3">
			<div class="min-w-[16rem] flex-1 space-y-1.5">
				<label for="id" class="text-secondary block text-[13.5px] font-medium">ID insight</label>
				<input
					id="id"
					name="id"
					bind:value={id}
					placeholder="01a08611-f959-7087-ba6f-0ba95c5a19b3"
					class="tw-field tw-data"
				/>
			</div>
			<button type="submit" data-testid="verifikasi-submit" class="tw-primary">
				<Search class="size-4" aria-hidden="true" />
				Verifikasi
			</button>
		</form>

		{#if data.galat}
			<p
				data-testid="verifikasi-galat"
				class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical border px-3.5 py-2.5 text-[13.5px]"
			>
				{data.galat}
			</p>
		{/if}

		{#if hasil}
			<div data-testid="verifikasi-hasil" data-valid={hasil.valid} class="tw-card space-y-5 p-6">
				<div class="flex flex-wrap items-center gap-4">
					<SkorBadge skor={hasil.score} size="lg" />

					<div class="min-w-0 flex-1">
						<p class="tw-data text-diamond-300 text-xl font-semibold tracking-wider">
							{hasil.ticker}
						</p>
						<p class="tw-overline mt-1">
							{formatTanggal(hasil.generated_at)} WIB
						</p>
					</div>

					{#if hasil.valid}
						<span
							class="rounded-glass border-tier-low/35 bg-tier-low/10 text-tier-low inline-flex items-center gap-2 border px-3.5 py-2"
						>
							<ShieldCheck class="size-4" aria-hidden="true" />
							<span class="tw-overline text-tier-low">Valid</span>
						</span>
					{:else}
						<span
							class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical inline-flex items-center gap-2 border px-3.5 py-2"
						>
							<ShieldX class="size-4" aria-hidden="true" />
							<span class="tw-overline text-tier-critical">Tidak valid</span>
						</span>
					{/if}
				</div>

				{#if hasil.reason}
					<p data-testid="verifikasi-alasan" class="text-tier-critical text-[13.5px]">
						{hasil.reason}
					</p>
				{/if}

				<ul class="grid gap-2 sm:grid-cols-3">
					{#each [{ label: 'Signature', ok: hasil.signature_valid }, { label: 'Hash', ok: hasil.hash_valid }, { label: 'Rantai', ok: hasil.chain_valid }] as cek (cek.label)}
						<li class="tw-glass flex items-center justify-between px-3.5 py-2.5">
							<span class="tw-overline">{cek.label}</span>
							<span class="tw-overline {cek.ok ? 'text-tier-low' : 'text-tier-critical'}">
								{cek.ok ? 'Cocok' : 'Gagal'}
							</span>
						</li>
					{/each}
				</ul>

				<dl class="space-y-2">
					{#each barisTeknis as baris (baris.label)}
						<div class="border-line/60 flex flex-wrap gap-x-3 border-b pb-2 last:border-0">
							<dt class="tw-overline w-36 flex-none">{baris.label}</dt>
							<dd class="tw-data text-secondary min-w-0 flex-1 text-[12.5px] break-all">
								{baris.nilai}
							</dd>
						</div>
					{/each}
				</dl>
			</div>
		{/if}

		<DisclaimerBar />
	</main>
</div>
