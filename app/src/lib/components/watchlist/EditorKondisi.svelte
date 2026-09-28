<script lang="ts">
	import { enhance } from '$app/forms';
	import { BellRing, CalendarClock, Plus, Power, Trash2, TriangleAlert } from 'lucide-svelte';
	import { tierDariSkor } from '$lib/skor';
	import {
		NAMA_HARI,
		NAMA_KONDISI,
		detailKondisi,
		jamCek,
		type ItemWatchlist
	} from '$lib/watchlist';

	let {
		item,
		jadwal,
		galat = ''
	}: { item: ItemWatchlist; jadwal: Record<string, string>; galat?: string } = $props();

	let jenis = $state('daily');
	let jam = $state(8);
	let hari = $state(1);
	let ambang = $state(60);

	const aksi = (nama: string) => `?emiten=${item.ticker}&/${nama}`;
	const berambang = $derived(jenis === 'recent_event' || jenis === 'geopolitical');
	const warnaAmbang = $derived(tierDariSkor(ambang));
	const penjelasan: Record<string, string> = {
		daily: 'Dicek di setiap putaran pemindaian terjadwal.',
		weekly: 'Dicek sekali seminggu di hari yang kamu pilih.',
		periodic_custom: 'Dicek saat jam putaran pemindaian cocok dengan kelipatan jam ini.',
		recent_event: 'Kabar hanya dikirim kalau skor insight baru mencapai ambang.',
		geopolitical: 'Sama seperti kejadian terbaru, untuk memantau dampak isu global.'
	};
</script>

<section aria-labelledby="judul-kondisi-{item.id}" class="space-y-3">
	<div class="flex items-center justify-between gap-3">
		<h3 id="judul-kondisi-{item.id}" class="tw-overline flex items-center gap-2">
			<CalendarClock class="size-3.5" aria-hidden="true" />
			Kondisi pemicu
		</h3>
		<span class="tw-data text-muted text-[11.5px]">
			{item.conditions.filter((k) => k.is_active).length} aktif dari {item.conditions.length}
		</span>
	</div>

	{#if galat}
		<p role="alert" class="text-tier-critical flex items-start gap-2 text-[12.5px]">
			<TriangleAlert class="mt-0.5 size-3.5 flex-none" aria-hidden="true" />
			{galat}
		</p>
	{/if}

	{#if item.conditions.length === 0}
		<p
			class="border-diamond-700 bg-diamond-900/40 text-secondary rounded-xl border px-3.5 py-3 text-[13px]"
		>
			Belum ada kondisi, jadi {item.ticker} belum ikut dipindai. Tambahkan minimal satu kondisi di bawah.
		</p>
	{:else}
		<ul data-testid="daftar-kondisi" class="space-y-2">
			{#each item.conditions as kondisi (kondisi.id)}
				{@const berikut = jadwal[kondisi.id]}
				<li
					data-testid="kondisi"
					data-condition-type={kondisi.condition_type}
					class="baris-kondisi"
					class:mati={!kondisi.is_active}
				>
					<span class="min-w-0 flex-1">
						<span class="flex flex-wrap items-baseline gap-x-2 text-[13.5px]">
							<span class="text-ink font-medium"
								>{NAMA_KONDISI[kondisi.condition_type] ?? kondisi.condition_type}</span
							>
							{#if detailKondisi(kondisi)}
								<span class="text-muted">{detailKondisi(kondisi)}</span>
							{/if}
						</span>
						<span class="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11.5px]">
							<span
								data-testid="status-kondisi"
								class="tw-overline {kondisi.is_active ? 'text-tier-low' : 'text-muted'}"
							>
								{kondisi.is_active ? 'Aktif' : 'Nonaktif'}
							</span>
							{#if kondisi.is_active && berikut}
								<span data-testid="cek-berikutnya" class="text-secondary tw-data"
									>cek berikutnya {jamCek(berikut)} WIB</span
								>
							{:else if kondisi.is_active}
								<span class="text-muted">belum terjadwal dalam 2 bulan</span>
							{/if}
						</span>
					</span>

					<span class="flex flex-none items-center gap-1.5">
						<form method="POST" action={aksi('ubahKondisi')} use:enhance>
							<input type="hidden" name="item_id" value={item.id} />
							<input type="hidden" name="condition_id" value={kondisi.id} />
							<input type="hidden" name="is_active" value={String(!kondisi.is_active)} />
							<button
								type="submit"
								data-testid="toggle-kondisi"
								class="tombol-kecil"
								aria-label="{kondisi.is_active ? 'Nonaktifkan' : 'Aktifkan'} kondisi {NAMA_KONDISI[
									kondisi.condition_type
								]}"
							>
								<Power class="size-3.5" aria-hidden="true" />
								{kondisi.is_active ? 'Nonaktifkan' : 'Aktifkan'}
							</button>
						</form>
						<form method="POST" action={aksi('hapusKondisi')} use:enhance>
							<input type="hidden" name="item_id" value={item.id} />
							<input type="hidden" name="condition_id" value={kondisi.id} />
							<button
								type="submit"
								data-testid="hapus-kondisi"
								class="tombol-kecil bahaya"
								aria-label="Hapus kondisi {NAMA_KONDISI[kondisi.condition_type]}"
							>
								<Trash2 class="size-3.5" aria-hidden="true" />
							</button>
						</form>
					</span>
				</li>
			{/each}
		</ul>
	{/if}

	<form method="POST" action={aksi('tambahKondisi')} class="tambah space-y-3" use:enhance>
		<input type="hidden" name="item_id" value={item.id} />

		<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
			<div class="space-y-1.5">
				<label for="condition_type-{item.id}" class="text-secondary block text-[12.5px] font-medium"
					>Jenis kondisi</label
				>
				<select
					id="condition_type-{item.id}"
					name="condition_type"
					bind:value={jenis}
					class="tw-field py-2 text-[13.5px]"
				>
					{#each Object.entries(NAMA_KONDISI) as [nilai, nama] (nilai)}
						<option value={nilai}>{nama}</option>
					{/each}
				</select>
			</div>

			{#if jenis === 'periodic_custom'}
				<div class="space-y-1.5">
					<label for="interval-{item.id}" class="text-secondary block text-[12.5px] font-medium"
						>Setiap berapa jam</label
					>
					<input
						id="interval-{item.id}"
						name="interval_hours"
						type="number"
						min="1"
						max="720"
						bind:value={jam}
						class="tw-field tw-data w-full py-2 text-[13.5px] sm:w-28"
					/>
				</div>
			{:else if jenis === 'weekly'}
				<div class="space-y-1.5">
					<label for="weekday-{item.id}" class="text-secondary block text-[12.5px] font-medium"
						>Hari</label
					>
					<select
						id="weekday-{item.id}"
						name="weekday"
						bind:value={hari}
						class="tw-field py-2 text-[13.5px] sm:w-32"
					>
						{#each NAMA_HARI.slice(1, 6) as nama, urutan (nama)}
							<option value={urutan + 1}>{nama}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		{#if berambang}
			<div class="space-y-1.5">
				<div class="flex items-baseline justify-between gap-3">
					<label for="ambang-{item.id}" class="text-secondary text-[12.5px] font-medium"
						>Kirim kabar mulai skor</label
					>
					<span class="tw-data text-[13px] font-semibold {warnaAmbang.text}"
						>{ambang}, {warnaAmbang.label}</span
					>
				</div>
				<input
					id="ambang-{item.id}"
					name="min_score"
					type="range"
					min="0"
					max="100"
					step="1"
					bind:value={ambang}
					class="ambang w-full"
					style="--warna:{warnaAmbang.color}; --isi:{ambang}%"
				/>
			</div>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-muted flex items-start gap-1.5 text-[12px] leading-snug">
				<BellRing class="mt-0.5 size-3 flex-none" aria-hidden="true" />
				{penjelasan[jenis]}
			</p>
			<button type="submit" data-testid="tambah-kondisi" class="tw-ghost px-3.5 py-2 text-[13px]">
				<Plus class="size-4" aria-hidden="true" />
				Tambah kondisi
			</button>
		</div>
	</form>
</section>

<style>
	.baris-kondisi {
		display: flex;
		align-items: center;
		gap: 12px;
		border: 1px solid var(--edge-soft);
		border-left: 2px solid var(--color-tier-low);
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.025);
		padding: 10px 12px;
		transition: border-color 0.2s ease;
	}

	.baris-kondisi.mati {
		border-left-color: var(--color-line);
	}

	.tombol-kecil {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: 9px;
		padding: 5px 9px;
		font-size: 12px;
		color: var(--color-secondary);
		transition:
			color 0.2s ease,
			border-color 0.2s ease;
	}

	@media (hover: hover) {
		.tombol-kecil:hover {
			border-color: var(--color-diamond-700);
			color: var(--color-ink);
		}

		.tombol-kecil.bahaya:hover {
			border-color: color-mix(in srgb, var(--color-tier-critical) 50%, transparent);
			color: var(--color-tier-critical);
		}
	}

	.tambah {
		border-top: 1px dashed var(--edge);
		padding-top: 14px;
	}

	.ambang {
		height: 6px;
		appearance: none;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--warna) var(--isi),
			rgba(180, 205, 255, 0.12) var(--isi)
		);
		cursor: pointer;
	}

	.ambang::-webkit-slider-thumb {
		width: 16px;
		height: 16px;
		appearance: none;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--warna);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--warna) 30%, transparent);
	}

	.ambang::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--warna);
	}
</style>
