<script lang="ts">
	import { Search, ShieldCheck, ShieldX } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Preferensi from '$lib/components/Preferensi.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { formatTanggal } from '$lib/insight';
	import { t } from '$lib/bahasa.svelte';

	let { data } = $props();

	let id = $state('');

	const hasil = $derived(data.hasil);

	$effect(() => {
		id = data.id;
	});

	const pemeriksaan = $derived(
		hasil
			? [
					{ label: t('Segel dari TripWire', 'Sealed by TripWire'), ok: hasil.signature_valid },
					{ label: t('Isi tidak berubah', 'Content unchanged'), ok: hasil.hash_valid },
					{ label: t('Rantai catatan utuh', 'Record chain intact'), ok: hasil.chain_valid }
				]
			: []
	);

	const alasan = $derived.by(() => {
		if (!hasil || hasil.valid) return '';
		if (!hasil.signature_valid)
			return t(
				'Isi insight ini sudah berubah setelah disegel.',
				'This insight was changed after it was sealed.'
			);
		if (!hasil.hash_valid)
			return t(
				'Catatan insight ini tidak cocok dengan urutan catatan sebelumnya.',
				"This insight's record doesn't match the sequence of earlier records."
			);
		if (!hasil.chain_valid)
			return t(
				'Catatan insight sebelumnya tidak ditemukan.',
				"The previous insight's record wasn't found."
			);
		return t(
			'Insight ini tidak lolos pemeriksaan keaslian.',
			'This insight failed the authenticity check.'
		);
	});

	const barisTeknis = $derived(
		hasil
			? [
					{ label: t('Algoritma', 'Algorithm'), nilai: hasil.algorithm },
					{ label: 'Public key', nilai: hasil.public_key },
					{ label: 'Digest', nilai: hasil.digest },
					{ label: 'Signature', nilai: hasil.signature },
					{
						label: t('Hash sebelumnya', 'Previous hash'),
						nilai:
							hasil.prev_hash ??
							t('tidak ada, ini mata rantai pertama', 'none, this is the first link in the chain')
					},
					{ label: t('Hash saat ini', 'Current hash'), nilai: hasil.current_hash }
				]
			: []
	);
</script>

<svelte:head>
	<title>{t('Verifikasi insight TripWire', 'Verify a TripWire insight')}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-6 py-8">
	<header class="flex items-center justify-between">
		<Wordmark />
		<div class="flex items-center gap-2">
			<Preferensi />
			<a href="/login" class="tw-ghost text-[14px]">{t('Masuk', 'Log in')}</a>
		</div>
	</header>

	<main class="space-y-7 py-12">
		<div class="space-y-3">
			<p class="tw-overline">{t('Verifikasi publik', 'Public verification')}</p>
			<h1 class="tw-display text-ink">
				{t('Cek keaslian sebuah insight.', 'Check whether an insight is authentic.')}
			</h1>
			<p class="text-secondary max-w-xl leading-relaxed">
				{t(
					'Tempel ID insight untuk memastikan isinya asli dari TripWire dan belum diubah sejak dibuat. Tidak perlu akun, siapa pun bisa mengeceknya.',
					"Paste an insight ID to confirm it really came from TripWire and hasn't been changed since it was created. No account needed, anyone can check."
				)}
			</p>
		</div>

		<form method="GET" class="flex flex-wrap items-end gap-3">
			<div class="min-w-[16rem] flex-1 space-y-1.5">
				<label for="id" class="text-secondary block text-[13.5px] font-medium"
					>{t('ID insight', 'Insight ID')}</label
				>
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
				{t('Verifikasi', 'Verify')}
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
							<span class="tw-overline text-tier-low">{t('Asli', 'Authentic')}</span>
						</span>
					{:else}
						<span
							class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical inline-flex items-center gap-2 border px-3.5 py-2"
						>
							<ShieldX class="size-4" aria-hidden="true" />
							<span class="tw-overline text-tier-critical">{t('Tidak cocok', 'Mismatch')}</span>
						</span>
					{/if}
				</div>

				{#if hasil.valid}
					<p class="text-secondary text-[14px] leading-relaxed">
						{t(
							'Insight ini asli dari TripWire dan isinya belum berubah sejak dibuat.',
							"This insight really came from TripWire and hasn't changed since it was created."
						)}
					</p>
				{:else}
					<p data-testid="verifikasi-alasan" class="text-tier-critical text-[13.5px]">
						{alasan}
					</p>
				{/if}

				<ul class="grid gap-2 sm:grid-cols-3">
					{#each pemeriksaan as cek (cek.label)}
						<li class="tw-glass flex items-center justify-between gap-2 px-3.5 py-2.5">
							<span class="text-secondary text-[13px]">{cek.label}</span>
							<span class="tw-overline {cek.ok ? 'text-tier-low' : 'text-tier-critical'}">
								{cek.ok ? t('Cocok', 'Pass') : t('Gagal', 'Fail')}
							</span>
						</li>
					{/each}
				</ul>

				<details data-testid="detail-teknis" class="group">
					<summary
						class="text-diamond-300 hover:text-diamond-100 cursor-pointer text-[13px] font-medium transition"
					>
						{t('Detail teknis untuk pemeriksa', 'Technical details for auditors')}
					</summary>
					<p class="tw-caption mt-3">
						{t(
							'Tiap insight ditandatangani secara digital dan disambungkan ke insight sebelumnya, sehingga perubahan sekecil apa pun akan ketahuan.',
							'Every insight is digitally signed and linked to the previous insight, so even the smallest change gets caught.'
						)}
					</p>
					<dl class="mt-3 space-y-2">
						{#each barisTeknis as baris (baris.label)}
							<div class="border-line/60 flex flex-wrap gap-x-3 border-b pb-2 last:border-0">
								<dt class="tw-overline w-36 flex-none">{baris.label}</dt>
								<dd class="tw-data text-secondary min-w-0 flex-1 text-[12.5px] break-all">
									{baris.nilai}
								</dd>
							</div>
						{/each}
					</dl>
				</details>
			</div>
		{/if}

		<DisclaimerBar />
	</main>
</div>
