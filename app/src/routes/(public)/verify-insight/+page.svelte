<script lang="ts">
	import {
		Check,
		CircleDashed,
		FingerprintPattern,
		Link2,
		Search,
		ShieldCheck,
		ShieldX,
		X
	} from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Preferensi from '$lib/components/Preferensi.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { formatTanggal, labelSubtype } from '$lib/insight';
	import { t } from '$lib/bahasa.svelte';

	let { data } = $props();

	type StatusBrowser = 'memeriksa' | 'cocok' | 'gagal' | 'tidak-didukung';

	let id = $state('');
	let tandaBrowser = $state<StatusBrowser>('memeriksa');
	let hashBrowser = $state<StatusBrowser>('memeriksa');

	const hasil = $derived(data.hasil);

	$effect(() => {
		id = data.id;
	});

	function dariHex(teks: string) {
		const bytes = new Uint8Array(teks.length / 2);
		for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(teks.slice(i * 2, i * 2 + 2), 16);
		return bytes;
	}

	function dariBase64(teks: string) {
		return Uint8Array.from(atob(teks), (huruf) => huruf.charCodeAt(0));
	}

	function keHex(buffer: ArrayBuffer) {
		return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	}

	async function periksaTanda(publik: string, digest: string, tanda: string) {
		try {
			const kunci = await crypto.subtle.importKey(
				'raw',
				dariBase64(publik),
				{ name: 'Ed25519' },
				false,
				['verify']
			);
			const cocok = await crypto.subtle.verify(
				{ name: 'Ed25519' },
				kunci,
				dariBase64(tanda),
				dariHex(digest)
			);
			return cocok ? 'cocok' : 'gagal';
		} catch (galat) {
			return galat instanceof DOMException && galat.name === 'NotSupportedError'
				? 'tidak-didukung'
				: 'gagal';
		}
	}

	async function periksaHash(sebelum: string, digest: string, tanda: string, kini: string) {
		try {
			const isi = new TextEncoder().encode(`${sebelum}\n${digest}\n${tanda}`);
			return keHex(await crypto.subtle.digest('SHA-256', isi)) === kini ? 'cocok' : 'gagal';
		} catch {
			return 'tidak-didukung';
		}
	}

	$effect(() => {
		if (!hasil) return;
		let batal = false;
		tandaBrowser = 'memeriksa';
		hashBrowser = 'memeriksa';
		Promise.all([
			periksaTanda(hasil.public_key, hasil.digest, hasil.signature),
			periksaHash(hasil.prev_hash ?? '', hasil.digest, hasil.signature, hasil.current_hash)
		]).then(([tanda, hash]) => {
			if (batal) return;
			tandaBrowser = tanda as StatusBrowser;
			hashBrowser = hash as StatusBrowser;
		});
		return () => (batal = true);
	});

	const pemeriksaan = $derived(
		hasil
			? [
					{
						kunci: 'tanda',
						judul: t('Tanda tangan Ed25519', 'Ed25519 signature'),
						isi: t(
							'Isi insight disegel dengan kunci privat TripWire saat dibuat.',
							"The insight content was sealed with TripWire's private key when it was created."
						),
						server: hasil.signature_valid,
						browser: tandaBrowser
					},
					{
						kunci: 'hash',
						judul: t('Hash rantai', 'Chain hash'),
						isi: t(
							'Hash saat ini dihitung dari hash sebelumnya, digest, dan tanda tangan.',
							'The current hash is computed from the previous hash, the digest, and the signature.'
						),
						server: hasil.hash_valid,
						browser: hashBrowser
					},
					{
						kunci: 'rantai',
						judul: t('Mata rantai sebelumnya', 'Previous link'),
						isi: hasil.prev_hash
							? t(
									'Insight sebelumnya yang dirujuk masih tersimpan, jadi rantainya utuh.',
									'The previous insight it points to is still stored, so the chain is intact.'
								)
							: t(
									'Ini mata rantai pertama, tidak ada insight sebelumnya.',
									'This is the first link, there is no earlier insight.'
								),
						server: hasil.chain_valid,
						browser: null
					}
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

	function pendek(nilai: string | null | undefined) {
		if (!nilai) return '-';
		return nilai.length > 18 ? `${nilai.slice(0, 10)}…${nilai.slice(-6)}` : nilai;
	}

	function teksBrowser(status: StatusBrowser) {
		if (status === 'cocok') return t('Cocok di browser kamu', 'Matches in your browser');
		if (status === 'gagal') return t('Gagal di browser kamu', 'Fails in your browser');
		if (status === 'tidak-didukung')
			return t('Browser ini belum bisa memeriksa', 'This browser cannot check it');
		return t('Memeriksa di browser', 'Checking in your browser');
	}
</script>

<svelte:head>
	<title>{t('Verifikasi insight TripWire', 'Verify a TripWire insight')}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
	<header class="flex items-center justify-between">
		<Wordmark />
		<div class="flex items-center gap-2">
			<Preferensi />
			<a href="/login" class="tw-ghost text-[14px]">{t('Masuk', 'Log in')}</a>
		</div>
	</header>

	<main class="space-y-6 py-10">
		<div class="space-y-3">
			<p class="tw-overline">{t('Verifikasi publik', 'Public verification')}</p>
			<h1 class="tw-display text-ink">
				{t('Cek keaslian sebuah insight.', 'Check whether an insight is authentic.')}
			</h1>
			<p class="text-secondary max-w-2xl leading-relaxed">
				{t(
					'Tempel ID insight untuk memastikan isinya asli dari TripWire dan belum diubah sejak dibuat. Tidak perlu akun. Tanda tangan dan hash rantainya juga diperiksa ulang langsung di browser kamu, jadi kamu tidak perlu sekadar percaya pada server kami.',
					"Paste an insight ID to confirm it really came from TripWire and hasn't been changed since it was created. No account needed. Its signature and chain hash are also re-checked right in your browser, so you don't have to just trust our server."
				)}
			</p>
		</div>

		<form method="GET" class="panel flex flex-wrap items-end gap-3">
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
			<section
				data-testid="verifikasi-hasil"
				data-valid={hasil.valid}
				class="panel hasil space-y-5"
				class:valid={hasil.valid}
			>
				<div class="flex flex-wrap items-center gap-4">
					<SkorBadge skor={hasil.score} size="lg" />
					<div class="min-w-0 flex-1">
						<p class="tw-data text-diamond-300 text-xl font-semibold tracking-wider">
							{hasil.ticker}
						</p>
						<p class="text-secondary text-[13px]">{labelSubtype(hasil.subtype)}</p>
						<p class="tw-overline mt-1">{formatTanggal(hasil.generated_at)} WIB</p>
					</div>
					{#if hasil.valid}
						<span class="status asli">
							<ShieldCheck class="size-4" aria-hidden="true" />
							{t('Asli', 'Authentic')}
						</span>
					{:else}
						<span class="status palsu">
							<ShieldX class="size-4" aria-hidden="true" />
							{t('Tidak cocok', 'Mismatch')}
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

				<ol class="rantai" aria-label={t('Rantai hash', 'Hash chain')}>
					<li class="mata">
						<span class="tw-overline text-[9.5px]">{t('Hash sebelumnya', 'Previous hash')}</span>
						<span class="tw-data text-secondary text-[12px]">
							{hasil.prev_hash ? pendek(hasil.prev_hash) : t('awal rantai', 'chain start')}
						</span>
					</li>
					<li class="sambung" aria-hidden="true"><Link2 class="size-4" /></li>
					<li class="mata utama">
						<span class="tw-overline text-[9.5px]">{t('Insight ini', 'This insight')}</span>
						<span class="tw-data text-ink text-[12px]">digest {pendek(hasil.digest)}</span>
						<span class="tw-data text-muted text-[11px]">sig {pendek(hasil.signature)}</span>
					</li>
					<li class="sambung" aria-hidden="true"><Link2 class="size-4" /></li>
					<li class="mata">
						<span class="tw-overline text-[9.5px]">{t('Hash saat ini', 'Current hash')}</span>
						<span class="tw-data text-secondary text-[12px]">{pendek(hasil.current_hash)}</span>
					</li>
				</ol>

				<ul class="grid gap-3 md:grid-cols-3">
					{#each pemeriksaan as cek (cek.kunci)}
						<li class="cek" data-testid="cek-{cek.kunci}" data-server={cek.server}>
							<p class="text-ink flex items-center gap-2 text-[13.5px] font-semibold">
								{#if cek.server}
									<Check class="text-tier-low size-4 flex-none" aria-hidden="true" />
								{:else}
									<X class="text-tier-critical size-4 flex-none" aria-hidden="true" />
								{/if}
								{cek.judul}
							</p>
							<p class="text-secondary mt-1.5 text-[12.5px] leading-relaxed">{cek.isi}</p>
							<p class="mt-2.5 text-[12px] {cek.server ? 'text-tier-low' : 'text-tier-critical'}">
								{cek.server
									? t('Cocok di server', 'Matches on the server')
									: t('Gagal di server', 'Fails on the server')}
							</p>
							{#if cek.browser}
								<p
									class="browser mt-1 flex items-center gap-1.5 text-[12px]"
									data-testid="cek-browser-{cek.kunci}"
									data-status={cek.browser}
								>
									<FingerprintPattern class="size-3.5" aria-hidden="true" />
									{teksBrowser(cek.browser)}
								</p>
							{/if}
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
							'Digest adalah SHA-256 dari ID, ticker, jenis, skor, waktu, hash sebelumnya, dan isi insight dalam JSON kanonik. Tanda tangan Ed25519 dibuat atas digest itu, lalu hash saat ini adalah SHA-256 dari hash sebelumnya, digest, dan tanda tangan.',
							'The digest is the SHA-256 of the ID, ticker, type, score, time, previous hash, and the insight content as canonical JSON. The Ed25519 signature is made over that digest, and the current hash is the SHA-256 of the previous hash, the digest, and the signature.'
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
			</section>
		{:else if !data.galat}
			<section class="grid gap-3 md:grid-cols-3" aria-label={t('Cara kerja', 'How it works')}>
				{#each [{ ikon: FingerprintPattern, judul: t('Disegel saat dibuat', 'Sealed on creation'), isi: t('Setiap insight ditandatangani Ed25519 begitu dihitung dari data Sectors.', 'Every insight is signed with Ed25519 as soon as it is computed from Sectors data.') }, { ikon: Link2, judul: t('Disambung jadi rantai', 'Linked into a chain'), isi: t('Hash setiap insight memuat hash insight sebelumnya, jadi menyisipkan atau mengubah catatan lama akan ketahuan.', 'Each insight hash includes the previous one, so inserting or editing old records gets caught.') }, { ikon: CircleDashed, judul: t('Diperiksa siapa saja', 'Checked by anyone'), isi: t('Tempel ID insight di atas. Server dan browser kamu sama sama menghitung ulang hasilnya.', 'Paste an insight ID above. Both the server and your browser recompute the result.') }] as langkah (langkah.judul)}
					{@const Ikon = langkah.ikon}
					<div class="panel">
						<Ikon class="text-diamond-300 size-5" aria-hidden="true" />
						<p class="text-ink mt-3 text-[14px] font-semibold">{langkah.judul}</p>
						<p class="text-secondary mt-1.5 text-[13px] leading-relaxed">{langkah.isi}</p>
					</div>
				{/each}
			</section>
		{/if}

		<DisclaimerBar />
	</main>
</div>

<style>
	.panel {
		border: 1px solid var(--edge);
		border-radius: 20px;
		background: var(--color-base);
		padding: 18px;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 20px;
		}
	}

	.hasil {
		border-color: color-mix(in srgb, var(--color-tier-critical) 35%, transparent);
	}

	.hasil.valid {
		border-color: color-mix(in srgb, var(--color-tier-low) 35%, transparent);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid;
		border-radius: 12px;
		padding: 7px 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.status.asli {
		border-color: color-mix(in srgb, var(--color-tier-low) 35%, transparent);
		background: color-mix(in srgb, var(--color-tier-low) 10%, transparent);
		color: var(--color-tier-low);
	}

	.status.palsu {
		border-color: color-mix(in srgb, var(--color-tier-critical) 35%, transparent);
		background: color-mix(in srgb, var(--color-tier-critical) 10%, transparent);
		color: var(--color-tier-critical);
	}

	.rantai {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	@media (min-width: 640px) {
		.rantai {
			flex-direction: row;
			align-items: stretch;
			gap: 8px;
		}
	}

	.mata {
		display: flex;
		min-width: 0;
		flex: 1 1 0;
		flex-direction: column;
		gap: 4px;
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		background: color-mix(in srgb, var(--kilau) 3%, transparent);
		padding: 10px 12px;
	}

	.mata.utama {
		border-color: color-mix(in srgb, var(--color-diamond-500) 40%, transparent);
		background: color-mix(in srgb, var(--color-diamond-500) 7%, transparent);
	}

	.sambung {
		display: grid;
		place-items: center;
		color: var(--color-muted);
		transform: rotate(90deg);
	}

	@media (min-width: 640px) {
		.sambung {
			transform: none;
		}
	}

	.cek {
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		padding: 12px 14px;
	}

	.browser {
		color: var(--color-muted);
	}

	.browser[data-status='cocok'] {
		color: var(--color-tier-low);
	}

	.browser[data-status='gagal'] {
		color: var(--color-tier-critical);
	}
</style>
