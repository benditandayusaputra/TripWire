<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { BellOff, BellRing, MonitorSmartphone, Radio, Send, X } from 'lucide-svelte';
	import { cabutPerangkat, kirimPushUji, type PerangkatPush } from '$lib/api/notifications';
	import { formatTanggalSaja } from '$lib/insight';
	import { namaPerangkat } from '$lib/notifikasi';
	import { pushStore } from '$lib/pwa.svelte';
	import { presenceStore } from '$lib/stores/presenceStore.svelte';

	let { perangkat, pushServer }: { perangkat: PerangkatPush[]; pushServer: boolean } = $props();

	let menguji = $state(false);
	let pesanUji = $state('');
	let mencabut = $state('');

	async function aktifkan() {
		await pushStore.aktifkan();
		if (pushStore.berlangganan) await invalidateAll();
	}

	async function matikan() {
		await pushStore.nonaktifkan();
		await invalidateAll();
	}

	async function uji() {
		if (menguji) return;
		menguji = true;
		pesanUji = '';
		try {
			const hasil = await kirimPushUji();
			pesanUji = hasil.devices
				? `Notifikasi uji terkirim ke ${hasil.delivered} dari ${hasil.devices} perangkat.`
				: 'Belum ada perangkat yang berlangganan.';
		} catch (galat) {
			pesanUji = galat instanceof Error ? galat.message : 'Notifikasi uji gagal dikirim.';
		} finally {
			menguji = false;
		}
	}

	async function cabut(item: PerangkatPush) {
		if (mencabut) return;
		mencabut = item.id;
		try {
			if (item.endpoint === pushStore.endpoint) await pushStore.nonaktifkan();
			else await cabutPerangkat(item.endpoint);
			await invalidateAll();
		} finally {
			mencabut = '';
		}
	}
</script>

<div class="space-y-4">
	<div class="saluran">
		<Radio
			class="size-4 flex-none {presenceStore.terhubung ? 'text-tier-low' : 'text-muted'}"
			aria-hidden="true"
		/>
		<div class="min-w-0 flex-1">
			<p class="text-ink text-[13.5px] font-medium">Langsung di aplikasi</p>
			<p class="tw-caption">Insight baru muncul di halaman ini tanpa muat ulang.</p>
		</div>
		<span class="tw-data text-[11px] {presenceStore.terhubung ? 'text-tier-low' : 'text-muted'}">
			{presenceStore.terhubung ? 'AKTIF' : 'MENYAMBUNG'}
		</span>
	</div>

	<div class="saluran items-start!">
		{#if pushStore.berlangganan}
			<BellRing class="text-tier-low mt-0.5 size-4 flex-none" aria-hidden="true" />
		{:else}
			<BellOff class="text-muted mt-0.5 size-4 flex-none" aria-hidden="true" />
		{/if}
		<div class="min-w-0 flex-1 space-y-2.5">
			<div>
				<p class="text-ink text-[13.5px] font-medium">Push di perangkat ini</p>
				<p data-testid="status-push" class="tw-caption">
					{#if !pushStore.didukung}
						Browser ini tidak mendukung Web Push.
					{:else if pushStore.berlangganan}
						Aktif, insight baru dikirim meski aplikasi sedang tertutup.
					{:else if pushStore.izin === 'denied'}
						Izin diblokir di pengaturan browser.
					{:else}
						Belum aktif, insight baru hanya tampil saat halaman ini terbuka.
					{/if}
				</p>
				{#if !pushServer}
					<p class="text-muted mt-1 text-[12px]">Server belum dikonfigurasi untuk Web Push.</p>
				{/if}
			</div>

			<div class="flex flex-wrap gap-2">
				{#if pushStore.didukung && !pushStore.berlangganan}
					<button
						type="button"
						data-testid="aktifkan-push"
						class="tw-primary px-3.5 py-2 text-[13px]"
						disabled={pushStore.sibuk}
						onclick={aktifkan}
					>
						<BellRing class="size-3.5" aria-hidden="true" />
						{pushStore.sibuk ? 'Memproses' : 'Aktifkan push'}
					</button>
				{:else if pushStore.berlangganan}
					<button
						type="button"
						data-testid="kirim-uji"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						disabled={menguji}
						onclick={uji}
					>
						<Send class="size-3.5" aria-hidden="true" />
						{menguji ? 'Mengirim' : 'Kirim uji'}
					</button>
					<button
						type="button"
						data-testid="matikan-push"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						disabled={pushStore.sibuk}
						onclick={matikan}
					>
						<BellOff class="size-3.5" aria-hidden="true" />
						Matikan
					</button>
				{/if}
			</div>

			{#if pushStore.pesan || pesanUji}
				<p data-testid="pesan-push" class="text-secondary text-[12.5px]" role="status">
					{pesanUji || pushStore.pesan}
				</p>
			{/if}
		</div>
	</div>

	<div class="border-line space-y-2 border-t pt-4">
		<p class="tw-overline flex items-center gap-2">
			<MonitorSmartphone class="size-3.5" aria-hidden="true" />
			Perangkat terdaftar
			<span data-testid="jumlah-perangkat" class="text-secondary ml-auto">{perangkat.length}</span>
		</p>

		{#if perangkat.length}
			<ul class="space-y-1.5">
				{#each perangkat as item (item.id)}
					<li data-testid="perangkat-push" class="perangkat">
						<div class="min-w-0 flex-1">
							<p class="text-ink truncate text-[13px]">
								{namaPerangkat(item.endpoint)}
								{#if item.endpoint === pushStore.endpoint}
									<span class="tw-data text-diamond-300 ml-1 text-[10.5px]">PERANGKAT INI</span>
								{/if}
							</p>
							<p class="tw-data text-muted text-[11px]">
								sejak {formatTanggalSaja(item.created_at)}
							</p>
						</div>
						<button
							type="button"
							data-testid="cabut-perangkat"
							class="cabut"
							aria-label="Cabut {namaPerangkat(item.endpoint)}"
							disabled={mencabut === item.id}
							onclick={() => cabut(item)}
						>
							<X class="size-3.5" aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-muted text-[12.5px]">Belum ada perangkat yang menerima push.</p>
		{/if}
	</div>
</div>

<style>
	.saluran {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.perangkat {
		display: flex;
		align-items: center;
		gap: 10px;
		border: 1px solid var(--edge-soft);
		border-radius: 12px;
		background: var(--color-void);
		padding: 8px 8px 8px 12px;
	}

	.cabut {
		display: grid;
		width: 28px;
		height: 28px;
		flex: none;
		place-items: center;
		border-radius: 8px;
		color: var(--color-muted);
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	@media (hover: hover) {
		.cabut:not(:disabled):hover {
			background: rgba(255, 255, 255, 0.06);
			color: var(--color-ink);
		}
	}
</style>
