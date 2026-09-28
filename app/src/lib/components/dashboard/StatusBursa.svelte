<script lang="ts">
	import { onMount } from 'svelte';
	import { statusBursa } from '$lib/dashboard';

	let sekarang = $state(new Date());

	onMount(() => {
		sekarang = new Date();
		const detak = setInterval(() => (sekarang = new Date()), 15_000);
		return () => clearInterval(detak);
	});

	const status = $derived(statusBursa(sekarang));
	const jam = $derived(
		sekarang.toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Asia/Jakarta'
		})
	);
	const tanggal = $derived(
		sekarang.toLocaleDateString('id-ID', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'Asia/Jakarta'
		})
	);
</script>

<div
	data-testid="status-bursa"
	data-buka={status.buka}
	title="Jadwal perdagangan reguler BEI, belum memperhitungkan hari libur bursa"
	class="border-line bg-base/70 flex items-center gap-3.5 rounded-2xl border px-4 py-3"
>
	<span class="titik" class:buka={status.buka} aria-hidden="true"></span>
	<div class="min-w-0">
		<p class="text-ink text-[13.5px] leading-tight font-medium">
			<span class="tw-data text-muted mr-1 text-[11px] tracking-widest">IDX</span>
			{status.label}
		</p>
		<p class="text-muted mt-0.5 text-[12px] leading-tight">{status.detail}</p>
	</div>
	<div class="border-line ml-auto border-l pl-3.5 text-right">
		<p class="tw-data text-ink text-[15px] leading-tight">
			{jam} <span class="text-muted text-[11px]">WIB</span>
		</p>
		<p class="text-muted mt-0.5 text-[11.5px] leading-tight capitalize">{tanggal}</p>
	</div>
</div>

<style>
	.titik {
		width: 9px;
		height: 9px;
		flex: none;
		border-radius: 999px;
		background: var(--color-muted);
		opacity: 0.6;
	}

	.titik.buka {
		background: var(--color-naik);
		opacity: 1;
		animation: denyut 2s ease-out infinite;
	}

	@keyframes denyut {
		0% {
			box-shadow: 0 0 0 0 rgba(31, 175, 122, 0.6);
		}
		70%,
		100% {
			box-shadow: 0 0 0 7px rgba(31, 175, 122, 0);
		}
	}
</style>
