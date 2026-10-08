<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { BellOff, BellRing, MonitorSmartphone, Radio, Send, X } from 'lucide-svelte';
	import { cabutPerangkat, kirimPushUji, type PerangkatPush } from '$lib/api/notifications';
	import { t } from '$lib/bahasa.svelte';
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
				? t(
						`Notifikasi uji terkirim ke ${hasil.delivered} dari ${hasil.devices} perangkat.`,
						`Test alert sent to ${hasil.delivered} of ${hasil.devices} ${hasil.devices === 1 ? 'device' : 'devices'}.`
					)
				: t('Belum ada perangkat yang berlangganan.', 'No devices are subscribed yet.');
		} catch (galat) {
			pesanUji =
				galat instanceof Error
					? galat.message
					: t('Notifikasi uji gagal dikirim.', "Couldn't send the test alert.");
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
			<p class="text-ink text-[13.5px] font-medium">
				{t('Langsung di aplikasi', 'Live in the app')}
			</p>
			<p class="tw-caption">
				{t(
					'Insight baru muncul di halaman ini tanpa muat ulang.',
					'New insights show up on this page without reloading.'
				)}
			</p>
		</div>
		<span class="tw-data text-[11px] {presenceStore.terhubung ? 'text-tier-low' : 'text-muted'}">
			{presenceStore.terhubung ? t('AKTIF', 'ACTIVE') : t('MENYAMBUNG', 'CONNECTING')}
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
				<p class="text-ink text-[13.5px] font-medium">
					{t('Notifikasi di HP atau browser ini', 'Push on this device')}
				</p>
				<p data-testid="status-push" class="tw-caption">
					{#if !pushStore.didukung}
						{t('Browser ini tidak mendukung Web Push.', "This browser doesn't support Web Push.")}
					{:else if pushStore.berlangganan}
						{t(
							'Aktif, insight baru dikirim meski aplikasi sedang tertutup.',
							'On. New insights are sent even when the app is closed.'
						)}
					{:else if pushStore.izin === 'denied'}
						{t(
							'Izin diblokir di pengaturan browser.',
							'Permission is blocked in your browser settings.'
						)}
					{:else}
						{t(
							'Belum aktif, insight baru hanya tampil saat halaman ini terbuka.',
							'Off. New insights only show up while this page is open.'
						)}
					{/if}
				</p>
				{#if !pushServer}
					<p class="text-muted mt-1 text-[12px]">
						{t(
							'Server belum dikonfigurasi untuk Web Push.',
							"The server isn't set up for Web Push yet."
						)}
					</p>
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
						{pushStore.sibuk ? t('Memproses', 'Processing') : t('Aktifkan push', 'Turn on push')}
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
						{menguji ? t('Mengirim', 'Sending') : t('Kirim uji', 'Send test')}
					</button>
					<button
						type="button"
						data-testid="matikan-push"
						class="tw-ghost px-3 py-1.5 text-[13px]"
						disabled={pushStore.sibuk}
						onclick={matikan}
					>
						<BellOff class="size-3.5" aria-hidden="true" />
						{t('Matikan', 'Turn off')}
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
			{t('Perangkat terdaftar', 'Registered devices')}
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
									<span class="tw-data text-diamond-300 ml-1 text-[10.5px]"
										>{t('PERANGKAT INI', 'THIS DEVICE')}</span
									>
								{/if}
							</p>
							<p class="tw-data text-muted text-[11px]">
								{t('sejak', 'since')}
								{formatTanggalSaja(item.created_at)}
							</p>
						</div>
						<button
							type="button"
							data-testid="cabut-perangkat"
							class="cabut"
							aria-label={t(
								`Cabut ${namaPerangkat(item.endpoint)}`,
								`Remove ${namaPerangkat(item.endpoint)}`
							)}
							disabled={mencabut === item.id}
							onclick={() => cabut(item)}
						>
							<X class="size-3.5" aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-muted text-[12.5px]">
				{t('Belum ada perangkat yang menerima push.', 'No devices are receiving push yet.')}
			</p>
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
			background: color-mix(in srgb, var(--cahaya) 6%, transparent);
			color: var(--color-ink);
		}
	}
</style>
