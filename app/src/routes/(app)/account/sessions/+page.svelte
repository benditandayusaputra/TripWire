<script lang="ts">
	import { enhance } from '$app/forms';
	import { LogOut, MonitorSmartphone, TriangleAlert } from 'lucide-svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { formatTanggal, waktuRelatif } from '$lib/insight';

	let { data, form } = $props();

	const lain = $derived(data.sessions.filter((sesi) => !sesi.current).length);
</script>

<svelte:head>
	<title>Perangkat yang login TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">Akun</p>
		<h1 class="tw-title text-ink">Perangkat yang login</h1>
		<p class="tw-caption">
			Satu baris adalah satu perangkat dengan sesi aktif. Cabut yang tidak kamu kenali.
		</p>
	</header>

	{#if form?.error}
		<p
			data-testid="sesi-error"
			role="alert"
			class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	<ul data-testid="daftar-sesi" class="space-y-3">
		{#each data.sessions as sesi (sesi.id)}
			<li
				data-testid="sesi"
				data-current={sesi.current}
				class="tw-card flex flex-wrap items-center justify-between gap-4 p-5"
			>
				<div class="flex min-w-0 items-start gap-3">
					<MonitorSmartphone class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
					<div class="min-w-0">
						<p class="text-ink truncate text-[14px]">
							{sesi.device_label ?? 'Perangkat tidak dikenal'}
						</p>
						<p class="tw-data text-muted mt-1 text-[12px]">
							{sesi.ip_address ?? 'IP tidak tercatat'} · aktif {waktuRelatif(
								sesi.last_used_at ?? sesi.issued_at
							)}
						</p>
						<p class="tw-overline mt-1">Berlaku sampai {formatTanggal(sesi.expires_at)} WIB</p>
					</div>
				</div>

				{#if sesi.current}
					<span
						data-testid="sesi-ini"
						class="tw-overline text-tier-low inline-flex items-center gap-2"
					>
						<Mark size={7} color="var(--color-tier-low)" />
						Perangkat ini
					</span>
				{:else}
					<form method="POST" action="?/cabut" use:enhance>
						<input type="hidden" name="session_id" value={sesi.id} />
						<button type="submit" data-testid="cabut-sesi" class="tw-ghost text-[13px]">
							<LogOut class="size-3.5" aria-hidden="true" />
							Cabut
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	{#if lain > 0}
		<form method="POST" action="?/cabutLainnya" use:enhance>
			<button type="submit" data-testid="cabut-semua" class="tw-ghost">
				<LogOut class="size-4" aria-hidden="true" />
				Cabut semua perangkat lain ({lain})
			</button>
		</form>
	{/if}
</section>
