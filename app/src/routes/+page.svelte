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
			teks: 'Riwayat suspensi saham, transaksi orang dalam, dan perubahan pemegang saham besar digabung jadi satu skor risiko. Setiap angkanya bisa kamu telusuri.'
		},
		{
			icon: Radar,
			judul: 'Market Intelligence',
			teks: 'Kinerja perusahaan dibandingkan dengan rata rata sektornya. Khusus saham tambang, ada analisis produksi, harga komoditas, dan izin tambang yang segera berakhir.'
		},
		{
			icon: FileCheck2,
			judul: 'Bisa dicek keasliannya',
			teks: 'Setiap insight diberi segel digital begitu dibuat, jadi isinya tidak bisa diubah diam diam. Siapa pun bisa mengecek keasliannya tanpa perlu akun.'
		}
	];

	const contoh = [
		{
			skor: 91,
			ticker: 'BRPT',
			judul: 'Beberapa orang dalam menjual saham tiga hari sebelum suspensi'
		},
		{ skor: 72, ticker: 'ANTM', judul: 'Kepemilikan berubah 5,4% tanpa pengumuman resmi' },
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
					TripWire memantau saham IDX pilihanmu setiap hari, membaca tanda bahaya dari data Sectors,
					lalu mengabari kamu begitu ada yang perlu diperhatikan.
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
									<SignatureBadge />
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
