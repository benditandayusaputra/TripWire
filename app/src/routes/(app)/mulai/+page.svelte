<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import {
		ArrowLeft,
		ArrowRight,
		BellRing,
		CalendarDays,
		Check,
		LoaderCircle,
		Search,
		ShieldAlert,
		Sunrise,
		X
	} from 'lucide-svelte';
	import LogoEmiten from '$lib/components/watchlist/LogoEmiten.svelte';
	import { pushStore } from '$lib/pwa.svelte';
	import { formatHarga, formatUbah, type SahamPasar } from '$lib/watchlist';
	import { t } from '$lib/bahasa.svelte';

	let { data, form } = $props();

	const BATAS = 5;

	let langkah = $state(1);
	let pilihan = $state<string[]>([]);
	let kondisi = $state('harian');
	let cari = $state('');
	let semua = $state<SahamPasar[]>([]);
	let mengirim = $state(false);

	const LANGKAH = $derived([
		t('Pilih saham', 'Pick stocks'),
		t('Cara dikabari', 'How to be alerted'),
		t('Notifikasi', 'Notifications')
	]);

	const PILIHAN_KONDISI = $derived([
		{
			kunci: 'harian',
			ikon: Sunrise,
			judul: t('Setiap hari', 'Every day'),
			isi: t(
				'TripWire memindai saham pilihanmu tiap hari dan mengabari setiap ada insight baru.',
				'TripWire scans your stocks every day and alerts you whenever there is a new insight.'
			)
		},
		{
			kunci: 'mingguan',
			ikon: CalendarDays,
			judul: t('Seminggu sekali', 'Once a week'),
			isi: t(
				'Pemindaian setiap Senin, cocok untuk investor jangka panjang yang tidak ingin sering dikabari.',
				'A scan every Monday, suited to long term investors who prefer fewer alerts.'
			)
		},
		{
			kunci: 'penting',
			ikon: ShieldAlert,
			judul: t('Hanya saat penting', 'Only when it matters'),
			isi: t(
				'Kabar hanya datang kalau Red Flag Score mencapai 61, tingkat Tinggi, atau lebih.',
				'Alerts only arrive when the Red Flag Score reaches 61, the High level, or more.'
			)
		}
	]);

	const kenal = $derived(
		new Map([...data.teratas, ...semua].map((saham) => [saham.ticker, saham]))
	);
	const hasilCari = $derived.by(() => {
		const kata = cari.trim().toLowerCase();
		if (kata.length < 2) return [];
		return semua
			.filter(
				(saham) =>
					saham.ticker.toLowerCase().includes(kata) ||
					saham.company_name.toLowerCase().includes(kata)
			)
			.slice(0, 6);
	});
	const ringkasKondisi = $derived(
		PILIHAN_KONDISI.find((satu) => satu.kunci === kondisi)?.judul.toLowerCase() ?? ''
	);

	onMount(() => {
		pushStore.periksa();
	});

	$effect(() => {
		let batal = false;
		Promise.resolve(data.semua).then((daftar) => {
			if (!batal) semua = daftar ?? [];
		});
		return () => (batal = true);
	});

	let wadah = $state<HTMLElement>();

	function pindah(arah: number) {
		langkah += arah;
		if (wadah && wadah.getBoundingClientRect().top < 0) {
			wadah.scrollIntoView({
				block: 'start',
				behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
			});
		}
	}

	function ubahPilihan(kode: string) {
		if (pilihan.includes(kode)) pilihan = pilihan.filter((satu) => satu !== kode);
		else if (pilihan.length < BATAS) pilihan = [...pilihan, kode];
	}
</script>

<svelte:head>
	<title>{t('Mulai pakai TripWire', 'Get started with TripWire')}</title>
</svelte:head>

<section
	bind:this={wadah}
	class="wizard mx-auto max-w-3xl space-y-5"
	data-testid="mulai-wizard"
	data-langkah={langkah}
>
	<header class="space-y-2">
		<p class="tw-overline">{t('Langkah awal', 'Getting started')}</p>
		<h1 class="tw-title text-ink">
			{t('Siapkan TripWire dalam tiga langkah', 'Set up TripWire in three steps')}
		</h1>
		<p class="text-secondary text-[14.5px] leading-relaxed">
			{t(
				'Pilih saham yang mau dijaga, tentukan seberapa sering kamu ingin dikabari, lalu izinkan notifikasi. Setelah itu TripWire langsung memindai saham pilihanmu dengan data Sectors.',
				'Pick the stocks to watch, decide how often you want alerts, then allow notifications. TripWire then scans your stocks right away with Sectors data.'
			)}
		</p>
	</header>

	<ol class="langkah" aria-label={t('Langkah', 'Steps')}>
		{#each LANGKAH as judul, urutan (judul)}
			<li
				class:aktif={langkah === urutan + 1}
				class:selesai={langkah > urutan + 1}
				aria-current={langkah === urutan + 1 ? 'step' : undefined}
			>
				<span class="nomor">
					{#if langkah > urutan + 1}
						<Check class="size-3.5" aria-hidden="true" />
					{:else}
						{urutan + 1}
					{/if}
				</span>
				<span class="hidden sm:inline">{judul}</span>
			</li>
		{/each}
	</ol>

	<div class="panel">
		{#if langkah === 1}
			<div class="space-y-4">
				<div>
					<h2 class="tw-heading text-ink">
						{t('Saham apa yang mau dijaga?', 'Which stocks should we watch?')}
					</h2>
					<p class="text-secondary mt-1 text-[13.5px]">
						{t(
							`Pilih sampai ${BATAS} saham. Mulai dari saham terbesar di BEI, atau cari kode lain.`,
							`Pick up to ${BATAS} stocks. Start with the largest on the IDX, or search for another ticker.`
						)}
					</p>
				</div>

				<label class="kolom-cari">
					<Search class="text-muted size-4 flex-none" aria-hidden="true" />
					<span class="sr-only">{t('Cari kode atau nama saham', 'Search ticker or company')}</span>
					<input
						type="search"
						bind:value={cari}
						data-testid="mulai-cari"
						placeholder={t(
							'Cari kode atau nama saham, misal ANTM',
							'Search a ticker or company, e.g. ANTM'
						)}
						autocomplete="off"
					/>
				</label>

				{#if hasilCari.length}
					<ul class="hasil" aria-label={t('Hasil pencarian', 'Search results')}>
						{#each hasilCari as saham (saham.ticker)}
							{@const sudah = data.dipantau.includes(saham.ticker)}
							<li>
								<button
									type="button"
									data-testid="mulai-hasil-item"
									data-ticker={saham.ticker}
									aria-pressed={pilihan.includes(saham.ticker)}
									disabled={sudah}
									onclick={() => ubahPilihan(saham.ticker)}
								>
									<LogoEmiten kode={saham.ticker} ukuran={28} />
									<span class="tw-data text-ink text-[13px] font-semibold">{saham.ticker}</span>
									<span class="text-muted min-w-0 flex-1 truncate text-[12.5px]"
										>{saham.company_name}</span
									>
									{#if sudah}
										<span class="text-muted text-[12px]"
											>{t('Sudah dipantau', 'Already watched')}</span
										>
									{:else if pilihan.includes(saham.ticker)}
										<Check class="text-diamond-300 size-4" aria-hidden="true" />
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{:else if cari.trim().length >= 2 && semua.length}
					<p class="text-muted text-[13px]">
						{t('Tidak ada saham yang cocok.', 'No matching stock.')}
					</p>
				{/if}

				<ul class="kartu" aria-label={t('Saham terbesar di BEI', 'Largest stocks on the IDX')}>
					{#each data.teratas as saham (saham.ticker)}
						{@const ubah = formatUbah(saham.daily_close_change)}
						{@const sudah = data.dipantau.includes(saham.ticker)}
						<li>
							<button
								type="button"
								data-testid="mulai-saham-item"
								data-ticker={saham.ticker}
								aria-pressed={pilihan.includes(saham.ticker)}
								disabled={sudah}
								onclick={() => ubahPilihan(saham.ticker)}
							>
								<LogoEmiten kode={saham.ticker} ukuran={34} />
								<span class="min-w-0 flex-1 text-left">
									<span class="tw-data text-ink block text-[14px] font-semibold"
										>{saham.ticker}</span
									>
									<span class="text-muted block truncate text-[12px]">{saham.company_name}</span>
								</span>
								<span class="text-right">
									<span class="tw-data text-ink block text-[13px]"
										>{formatHarga(saham.last_close_price)}</span
									>
									<span
										class="tw-data block text-[11.5px] {ubah.arah > 0
											? 'text-naik'
											: ubah.arah < 0
												? 'text-turun'
												: 'text-muted'}">{ubah.teks}</span
									>
								</span>
								<span class="centang" aria-hidden="true">
									{#if pilihan.includes(saham.ticker) || sudah}
										<Check class="size-3.5" />
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{:else if langkah === 2}
			<fieldset class="space-y-4">
				<legend class="tw-heading text-ink">
					{t('Seberapa sering kamu ingin dikabari?', 'How often do you want alerts?')}
				</legend>
				<p class="text-secondary text-[13.5px]">
					{t(
						'Bisa diubah kapan saja per saham dari tab Pemantauan di watchlist.',
						'You can change this per stock any time from the Monitoring tab in your watchlist.'
					)}
				</p>
				<div class="grid gap-3 sm:grid-cols-3">
					{#each PILIHAN_KONDISI as satu (satu.kunci)}
						{@const Ikon = satu.ikon}
						<label class="opsi" class:aktif={kondisi === satu.kunci}>
							<input
								type="radio"
								name="kondisi-pilihan"
								value={satu.kunci}
								bind:group={kondisi}
								data-testid="mulai-kondisi-{satu.kunci}"
								class="sr-only"
							/>
							<Ikon class="text-diamond-300 size-5" aria-hidden="true" />
							<span class="text-ink text-[14px] font-semibold">{satu.judul}</span>
							<span class="text-secondary text-[12.5px] leading-relaxed">{satu.isi}</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{:else}
			<div class="space-y-4">
				<div>
					<h2 class="tw-heading text-ink">{t('Izinkan notifikasi', 'Allow notifications')}</h2>
					<p class="text-secondary mt-1 text-[13.5px] leading-relaxed">
						{t(
							'Dengan notifikasi push, kabar tanda bahaya sampai ke perangkat ini walau TripWire sedang tidak dibuka. Tanpa izin pun semua kabar tetap masuk ke menu Notifikasi.',
							'With push notifications, red flag alerts reach this device even when TripWire is closed. Without permission, every alert still lands in the Alerts menu.'
						)}
					</p>
				</div>

				<div
					class="izin"
					data-testid="mulai-izin"
					data-status={pushStore.berlangganan ? 'aktif' : pushStore.izin}
				>
					<BellRing class="text-diamond-300 size-5 flex-none" aria-hidden="true" />
					<div class="min-w-0 flex-1 text-[13px]">
						{#if !pushStore.didukung}
							<p class="text-secondary">
								{t(
									'Browser ini belum mendukung notifikasi push. Kabar tetap tersedia di menu Notifikasi.',
									'This browser does not support push notifications yet. Alerts stay available in the Alerts menu.'
								)}
							</p>
						{:else if pushStore.berlangganan}
							<p class="text-tier-low font-medium">
								{t(
									'Notifikasi push aktif di perangkat ini.',
									'Push alerts are on for this device.'
								)}
							</p>
						{:else}
							<p class="text-secondary">
								{pushStore.pesan ||
									t(
										'Browser akan menanyakan izin setelah tombol ditekan.',
										'Your browser will ask for permission after you press the button.'
									)}
							</p>
						{/if}
					</div>
					{#if pushStore.didukung && !pushStore.berlangganan}
						<button
							type="button"
							class="tw-ghost flex-none px-3 py-1.5 text-[13px]"
							disabled={pushStore.sibuk}
							onclick={() => pushStore.aktifkan()}
						>
							{#if pushStore.sibuk}
								<LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
							{/if}
							{t('Izinkan notifikasi', 'Allow notifications')}
						</button>
					{/if}
				</div>

				<dl class="ringkas">
					<div>
						<dt>{t('Saham', 'Stocks')}</dt>
						<dd class="tw-data" data-testid="mulai-terpilih">{pilihan.join(', ')}</dd>
					</div>
					<div>
						<dt>{t('Pemindaian', 'Scanning')}</dt>
						<dd>{ringkasKondisi}</dd>
					</div>
				</dl>
			</div>
		{/if}

		{#if pilihan.length}
			<div class="terpilih" aria-live="polite">
				<span class="text-muted text-[12px]">
					{t(`${pilihan.length} dari ${BATAS} dipilih`, `${pilihan.length} of ${BATAS} selected`)}
				</span>
				{#each pilihan as kode (kode)}
					<span class="chip">
						<span class="tw-data">{kode}</span>
						{#if langkah === 1}
							<button
								type="button"
								aria-label={t(`Batalkan ${kode}`, `Remove ${kode}`)}
								onclick={() => ubahPilihan(kode)}
							>
								<X class="size-3" aria-hidden="true" />
							</button>
						{/if}
					</span>
				{/each}
				{#if langkah === 1 && pilihan.some((kode) => !kenal.has(kode))}
					<span class="text-muted text-[12px]">{t('Memuat data saham', 'Loading stock data')}</span>
				{/if}
			</div>
		{/if}

		{#if form?.error}
			<p role="alert" class="text-tier-critical mt-4 text-[13px]">{form.error}</p>
		{/if}

		<form
			method="POST"
			action="?/selesai"
			class="navigasi"
			use:enhance={() => {
				mengirim = true;
				return async ({ update }) => {
					await update();
					mengirim = false;
				};
			}}
		>
			{#each pilihan as kode (kode)}
				<input type="hidden" name="ticker" value={kode} />
			{/each}
			<input type="hidden" name="kondisi" value={kondisi} />

			{#if langkah > 1}
				<button type="button" class="tw-ghost px-3.5 py-2 text-[13.5px]" onclick={() => pindah(-1)}>
					<ArrowLeft class="size-4" aria-hidden="true" />
					{t('Kembali', 'Back')}
				</button>
			{:else}
				<a href="/dashboard" class="lewati" data-testid="mulai-lewati">
					{t('Lewati, atur sendiri nanti', 'Skip, I will set it up later')}
				</a>
			{/if}

			{#if langkah < 3}
				<button
					type="button"
					class="tw-primary px-4 py-2 text-[13.5px]"
					data-testid="mulai-lanjut"
					disabled={pilihan.length === 0}
					onclick={() => pindah(1)}
				>
					{t('Lanjut', 'Continue')}
					<ArrowRight class="size-4" aria-hidden="true" />
				</button>
			{:else}
				<button
					type="submit"
					class="tw-primary px-4 py-2 text-[13.5px]"
					data-testid="mulai-selesai"
					disabled={mengirim || pilihan.length === 0}
				>
					{#if mengirim}
						<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
					{/if}
					{t('Mulai pantau', 'Start watching')}
				</button>
			{/if}
		</form>
	</div>

	<p class="text-muted text-center text-[12px]">
		{t(
			'Informasi dan analisis, bukan rekomendasi beli atau jual.',
			'Information and analysis, not a buy or sell recommendation.'
		)}
	</p>
</section>

<style>
	.wizard {
		scroll-margin-top: 84px;
	}

	.panel {
		border: 1px solid var(--edge);
		border-radius: 22px;
		background: var(--color-base);
		padding: 18px;
	}

	@media (min-width: 640px) {
		.panel {
			padding: 24px;
		}
	}

	.langkah {
		display: flex;
		gap: 8px;
	}

	.langkah li {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
		border-top: 2px solid var(--edge);
		padding-top: 10px;
		font-size: 13px;
		color: var(--color-muted);
	}

	.langkah li.aktif {
		border-color: var(--color-diamond-500);
		color: var(--color-ink);
	}

	.langkah li.selesai {
		border-color: var(--color-diamond-700);
		color: var(--color-secondary);
	}

	.nomor {
		display: grid;
		width: 22px;
		height: 22px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 11.5px;
	}

	.aktif .nomor {
		border-color: var(--color-diamond-500);
		background: color-mix(in srgb, var(--color-diamond-500) 16%, transparent);
		color: var(--color-diamond-300);
	}

	.kolom-cari {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge);
		border-radius: 14px;
		background: var(--color-void);
		padding: 10px 12px;
	}

	.kolom-cari:focus-within {
		border-color: var(--color-diamond-500);
	}

	.kolom-cari input {
		width: 100%;
		background: transparent;
		font-size: 14px;
		color: var(--color-ink);
		outline: none;
	}

	.hasil {
		display: grid;
		gap: 4px;
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		padding: 6px;
	}

	.hasil button {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		border-radius: 10px;
		padding: 7px 8px;
		text-align: left;
	}

	.hasil button:hover:not(:disabled),
	.hasil button[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-diamond-500) 10%, transparent);
	}

	.kartu {
		display: grid;
		gap: 8px;
	}

	@media (min-width: 640px) {
		.kartu {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.kartu button {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 14px;
		padding: 10px 12px;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.kartu button:hover:not(:disabled) {
		border-color: var(--color-diamond-700);
	}

	.kartu button[aria-pressed='true'] {
		border-color: var(--color-diamond-500);
		background: color-mix(in srgb, var(--color-diamond-500) 8%, transparent);
	}

	.kartu button:disabled,
	.hasil button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.centang {
		display: grid;
		width: 20px;
		height: 20px;
		flex: none;
		place-items: center;
		border: 1px solid var(--edge);
		border-radius: 6px;
		color: var(--color-diamond-300);
	}

	[aria-pressed='true'] .centang {
		border-color: var(--color-diamond-500);
		background: color-mix(in srgb, var(--color-diamond-500) 18%, transparent);
	}

	.opsi {
		display: flex;
		cursor: pointer;
		flex-direction: column;
		gap: 8px;
		border: 1px solid var(--edge);
		border-radius: 16px;
		padding: 14px;
		transition:
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.opsi:hover {
		border-color: var(--color-diamond-700);
	}

	.opsi.aktif {
		border-color: var(--color-diamond-500);
		background: color-mix(in srgb, var(--color-diamond-500) 8%, transparent);
	}

	.opsi:focus-within {
		outline: 2px solid var(--color-diamond-300);
		outline-offset: 2px;
	}

	.izin {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		border: 1px solid var(--edge);
		border-radius: 16px;
		padding: 14px;
	}

	.ringkas {
		display: grid;
		gap: 10px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--kilau) 4%, transparent);
		padding: 12px 14px;
		font-size: 13px;
	}

	.ringkas div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.ringkas dt {
		color: var(--color-muted);
	}

	.ringkas dd {
		color: var(--color-ink);
	}

	.terpilih {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: 16px;
		border-top: 1px solid var(--edge-soft);
		padding-top: 12px;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: 1px solid color-mix(in srgb, var(--color-diamond-500) 35%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-diamond-500) 10%, transparent);
		padding: 2px 6px 2px 9px;
		font-size: 12px;
		color: var(--color-diamond-100);
	}

	.chip button {
		display: grid;
		width: 16px;
		height: 16px;
		place-items: center;
		border-radius: 999px;
	}

	.navigasi {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 20px;
	}

	.lewati {
		font-size: 13px;
		color: var(--color-secondary);
	}

	.lewati:hover {
		color: var(--color-ink);
	}
</style>
