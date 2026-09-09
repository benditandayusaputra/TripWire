<script lang="ts">
	import { ArrowRight, BadgeCheck, ListChecks, MailWarning, Sparkles } from 'lucide-svelte';
	import DisclaimerBar from '$lib/components/DisclaimerBar.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let { data } = $props();

	const emailTerverifikasi = $derived(Boolean(data.user?.email_verified_at));

	const sapaan = $derived.by(() => {
		const jam = new Date().getHours();
		if (jam < 11) return 'Selamat pagi';
		if (jam < 15) return 'Selamat siang';
		if (jam < 19) return 'Selamat sore';
		return 'Selamat malam';
	});

	const panelAkun = $derived([
		{ label: 'Email', nilai: data.user?.email ?? '', gaya: 'tw-data break-all' },
		{
			label: 'Status email',
			nilai: emailTerverifikasi ? 'Terverifikasi' : 'Belum verifikasi',
			gaya: ''
		},
		{ label: 'Paket', nilai: data.user?.tier ?? 'free', gaya: 'capitalize' }
	]);
</script>

<svelte:head>
	<title>Dashboard TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">{sapaan}</p>
		<h1 data-testid="dashboard-heading" class="tw-title text-ink">
			{data.user?.full_name}
		</h1>
		<p class="tw-caption">Sesi kamu aktif. Feed insight menyusul setelah watchlist terisi.</p>
	</header>

	<DisclaimerBar />

	{#if !emailTerverifikasi}
		<div
			data-testid="email-belum-verifikasi"
			class="rounded-glass border-diamond-700 bg-diamond-900/40 flex items-start gap-3 border px-4 py-3.5"
		>
			<MailWarning class="text-diamond-300 mt-0.5 size-4 flex-none" aria-hidden="true" />
			<p class="text-secondary text-[13.5px]">
				Email kamu belum diverifikasi. Cek kotak masuk untuk mengaktifkan notifikasi insight.
			</p>
		</div>
	{/if}

	<div class="grid gap-4 sm:grid-cols-3">
		{#each panelAkun as item (item.label)}
			<div class="tw-card space-y-2 p-5">
				<p class="tw-overline">{item.label}</p>
				<p class="text-ink text-[15px] {item.gaya}">
					{item.nilai}
				</p>
			</div>
		{/each}
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<a href="/watchlist" class="tw-card group hover:border-diamond-700 space-y-3 p-6 transition">
			<ListChecks class="text-diamond-300 size-5" aria-hidden="true" />
			<h2 class="tw-heading text-ink flex items-center gap-2">
				Atur watchlist
				<ArrowRight class="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
			</h2>
			<p class="tw-caption">
				Tambah emiten yang mau dipantau dan tentukan kondisi pemicunya, harian, mingguan, atau
				periodik custom.
			</p>
		</a>

		<div class="tw-card space-y-3 p-6">
			<BadgeCheck class="text-tier-low size-5" aria-hidden="true" />
			<h2 class="tw-heading text-ink">Insight yang bisa dibuktikan</h2>
			<p class="tw-caption">
				Tiap insight ditandatangani Ed25519 dan diikat hash chain. Halaman verifikasi terbuka untuk
				publik, jadi klaimnya bisa dicek tanpa akun.
			</p>
			<p class="text-muted flex items-center gap-2 text-[12px]">
				<Mark size={6} color="var(--color-tier-low)" />
				Ed25519 dan SHA-256
			</p>
		</div>
	</div>

	<div class="tw-glass flex items-center gap-3 px-4 py-3.5">
		<Sparkles class="text-diamond-300 size-4 flex-none" aria-hidden="true" />
		<p class="tw-caption">
			Feed insight, notifikasi realtime, dan detail skor menyusul di fase berikutnya.
		</p>
	</div>
</section>
