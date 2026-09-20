<script lang="ts">
	import { ArrowRight, FileCheck2, Radar, ShieldAlert } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import SignatureBadge from '$lib/components/SignatureBadge.svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import Wordmark from '$lib/components/Wordmark.svelte';

	const pilar = [
		{
			icon: ShieldAlert,
			judul: 'Red Flag Detector',
			teks: 'Riwayat suspensi, klaster transaksi insider, dan perubahan konsentrasi kepemilikan digabung jadi satu skor yang bisa ditelusuri per komponen.'
		},
		{
			icon: Radar,
			judul: 'Market Intelligence',
			teks: 'Fundamental dibanding rata rata sektor, dengan mode mendalam untuk emiten tambang sampai radar kedaluwarsa lisensi.'
		},
		{
			icon: FileCheck2,
			judul: 'Insight terverifikasi',
			teks: 'Tiap insight disegel Ed25519 dan diikat hash chain, jadi klaim integritasnya bisa dicek siapa pun, bukan cuma dipercaya.'
		}
	];

	const contoh = [
		{ skor: 91, ticker: 'BRPT', judul: 'Klaster transaksi insider tiga hari sebelum suspensi' },
		{ skor: 72, ticker: 'ANTM', judul: 'Perubahan kepemilikan 5,4% tanpa keterbukaan informasi' },
		{ skor: 12, ticker: 'BBCA', judul: 'Skor turun setelah laporan audit tahunan bersih' }
	];
</script>

<svelte:head>
	<title>TripWire</title>
	<meta name="description" content="Red flag detector dan market intelligence untuk saham IDX" />
</svelte:head>

<div class="mx-auto max-w-5xl px-6 py-8">
	<header class="flex items-center justify-between">
		<Wordmark />
		<nav class="flex items-center gap-2">
			<a href="/verify-insight" data-testid="nav-verifikasi" class="tw-ghost text-[14px]">
				Verifikasi insight
			</a>
			<a href="/login" class="tw-ghost text-[14px]">Masuk</a>
			<a href="/register" class="tw-primary text-[14px]">Daftar</a>
		</nav>
	</header>

	<main class="space-y-16 py-16 sm:py-24">
		<section class="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
			<div class="space-y-7">
				<p class="tw-overline">Sectors Hackathon 2026</p>

				<h1 class="tw-display text-ink">Red flag terdeteksi sebelum jadi berita.</h1>

				<p class="text-secondary max-w-xl text-[17px] leading-relaxed">
					TripWire memantau watchlist saham IDX kamu, membaca sinyal tata kelola dari data Sectors,
					lalu mengirim peringatan begitu kondisi yang kamu tentukan terpenuhi.
				</p>

				<div class="flex flex-wrap gap-3">
					<a href="/register" class="tw-primary">
						Mulai pantau gratis
						<ArrowRight class="size-4" aria-hidden="true" />
					</a>
					<a href="/login" class="tw-ghost">Sudah punya akun</a>
				</div>
			</div>

			<div class="tw-card space-y-4 p-6">
				<div class="flex items-center justify-between">
					<span class="tw-overline">Insight terbaru</span>
					<span class="tw-overline">Contoh</span>
				</div>

				<ul class="space-y-2.5">
					{#each contoh as item (item.ticker)}
						<li class="tw-glass flex items-start gap-3.5 p-3.5">
							<SkorBadge skor={item.skor} showLabel={false} />
							<div class="min-w-0 space-y-1.5">
								<p class="text-ink text-[14px] leading-snug">{item.judul}</p>
								<p class="flex items-center gap-2">
									<span class="tw-data text-diamond-300 text-[12px] tracking-wider">
										{item.ticker}
									</span>
									<SignatureBadge compact />
								</p>
							</div>
						</li>
					{/each}
				</ul>

				<p class="text-muted flex items-center gap-2 text-[12px]">
					<Mark size={6} color="var(--color-muted)" />
					Kode emiten nyata dengan angka ilustratif untuk contoh tampilan.
				</p>
			</div>
		</section>

		<section class="grid gap-4 sm:grid-cols-3">
			{#each pilar as item (item.judul)}
				<article class="tw-card space-y-3 p-6">
					<item.icon class="text-diamond-300 size-5" aria-hidden="true" />
					<h2 class="tw-heading text-ink">{item.judul}</h2>
					<p class="tw-caption">{item.teks}</p>
				</article>
			{/each}
		</section>

		<DisclaimerBar />
	</main>
</div>
