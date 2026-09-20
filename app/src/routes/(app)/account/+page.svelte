<script lang="ts">
	import { enhance } from '$app/forms';
	import { ImagePlus, ShieldCheck, Trash2, TriangleAlert, UserRound } from 'lucide-svelte';

	let { data, form } = $props();

	let namaBerkas = $state('');

	const avatarURL = $derived(data.profil?.avatar_url ?? '');

	const inisial = $derived(
		(data.profil?.full_name ?? '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((bagian: string) => bagian[0]?.toUpperCase() ?? '')
			.join('')
	);

	function pilihBerkas(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		namaBerkas = input.files?.[0]?.name ?? '';
	}
</script>

<svelte:head>
	<title>Akun TripWire</title>
</svelte:head>

<section class="space-y-7">
	<header class="space-y-1.5">
		<p class="tw-overline">Akun</p>
		<h1 class="tw-title text-ink">Profil</h1>
		<p class="tw-caption">Foto profil dan identitas yang tampil di seluruh aplikasi.</p>
	</header>

	{#if form?.error}
		<p
			data-testid="avatar-error"
			role="alert"
			class="rounded-glass border-tier-critical/35 bg-tier-critical/10 text-tier-critical flex items-start gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
		>
			<TriangleAlert class="mt-0.5 size-4 flex-none" aria-hidden="true" />
			{form.error}
		</p>
	{/if}

	<div class="tw-card space-y-6 p-6">
		<div class="flex flex-wrap items-center gap-5">
			{#if avatarURL}
				<img
					src={avatarURL}
					alt="Foto profil {data.profil?.full_name}"
					data-testid="avatar-gambar"
					class="border-line size-20 rounded-full border object-cover"
				/>
			{:else}
				<span
					data-testid="avatar-inisial"
					class="border-line bg-raised text-diamond-100 font-display grid size-20 place-items-center rounded-full border text-xl font-semibold"
				>
					{inisial || '?'}
				</span>
			{/if}

			<div class="min-w-0">
				<p class="tw-heading text-ink">{data.profil?.full_name}</p>
				<p class="tw-data text-muted mt-1 text-[13px] break-all">{data.profil?.email}</p>
			</div>
		</div>

		<form
			method="POST"
			action="?/unggah"
			enctype="multipart/form-data"
			class="flex flex-wrap items-end gap-3"
			use:enhance={() =>
				async ({ update }) => {
					await update({ reset: false });
					namaBerkas = '';
				}}
		>
			<div class="min-w-[14rem] flex-1 space-y-1.5">
				<label for="file" class="text-secondary block text-[13.5px] font-medium">
					Ganti foto profil
				</label>
				<input
					id="file"
					name="file"
					type="file"
					accept="image/jpeg,image/png"
					required
					onchange={pilihBerkas}
					class="tw-field file:border-line file:bg-raised file:text-secondary p-2 file:mr-3 file:rounded-md file:border file:px-3 file:py-1 file:text-[13px]"
				/>
				<p class="text-muted text-[12.5px]">JPEG atau PNG, maksimal 2 MB.</p>
			</div>

			<button type="submit" data-testid="unggah-avatar" class="tw-primary">
				<ImagePlus class="size-4" aria-hidden="true" />
				Unggah
			</button>

			{#if avatarURL}
				<span class="contents">
					<button
						type="submit"
						formaction="?/hapus"
						data-testid="hapus-avatar"
						class="tw-ghost"
						formnovalidate
					>
						<Trash2 class="size-4" aria-hidden="true" />
						Hapus foto
					</button>
				</span>
			{/if}
		</form>

		{#if namaBerkas}
			<p data-testid="nama-berkas" class="tw-data text-muted text-[12.5px]">{namaBerkas}</p>
		{/if}
	</div>

	<a
		href="/account/security"
		class="tw-card group hover:border-diamond-700 flex items-start gap-3 p-6 transition"
	>
		<ShieldCheck class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
		<span>
			<span class="tw-heading text-ink block">Keamanan</span>
			<span class="tw-caption mt-1 block">
				Dua faktor, kode cadangan, dan authenticator yang terdaftar.
			</span>
		</span>
	</a>

	<p class="tw-caption flex items-center gap-2">
		<UserRound class="size-4" aria-hidden="true" />
		Kolom profil lain menyusul di fase berikutnya.
	</p>
</section>
