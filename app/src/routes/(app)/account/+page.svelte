<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Check,
		ImagePlus,
		MonitorSmartphone,
		Save,
		ShieldCheck,
		Trash2,
		TriangleAlert
	} from 'lucide-svelte';
	import Field from '$lib/components/Field.svelte';

	let { data, form } = $props();

	let namaBerkas = $state('');
	let namaLengkap = $state('');
	let telepon = $state('');
	let bio = $state('');

	$effect(() => {
		namaLengkap = data.profil?.full_name ?? '';
		telepon = data.profil?.phone_number ?? '';
		bio = data.profil?.bio ?? '';
	});

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

	<div class="tw-card space-y-5 p-6">
		<h2 class="tw-heading text-ink">Data profil</h2>

		{#if form?.aksi === 'simpan' && form?.sukses}
			<p
				data-testid="profil-tersimpan"
				class="rounded-glass border-tier-low/35 bg-tier-low/10 text-tier-low flex items-center gap-2.5 border px-3.5 py-2.5 text-[13.5px]"
			>
				<Check class="size-4" aria-hidden="true" />
				Profil tersimpan.
			</p>
		{/if}

		<form method="POST" action="?/simpan" class="space-y-5" use:enhance>
			<div class="grid gap-5 sm:grid-cols-2">
				<Field
					id="full_name"
					label="Nama lengkap"
					bind:value={namaLengkap}
					error={form?.fields?.full_name}
					autocomplete="name"
					placeholder="Nama kamu"
				/>

				<Field
					id="phone_number"
					label="Nomor telepon"
					bind:value={telepon}
					error={form?.fields?.phone_number}
					autocomplete="tel"
					placeholder="08xxxxxxxxxx"
					required={false}
				/>
			</div>

			<div class="space-y-1.5">
				<label for="bio" class="text-secondary block text-[13.5px] font-medium">Bio</label>
				<textarea
					id="bio"
					name="bio"
					rows="3"
					bind:value={bio}
					placeholder="Sedikit tentang kamu"
					class="tw-field resize-y"></textarea>
				{#if form?.fields?.bio}
					<p class="text-tier-critical text-[12.5px]">{form.fields.bio}</p>
				{/if}
			</div>

			<div class="grid gap-5 sm:grid-cols-3">
				<div class="space-y-1.5">
					<label for="locale" class="text-secondary block text-[13.5px] font-medium">Bahasa</label>
					<select id="locale" name="locale" value={data.profil?.locale ?? 'id'} class="tw-field">
						<option value="id">Indonesia</option>
						<option value="en">English</option>
					</select>
				</div>

				<div class="space-y-1.5">
					<label for="theme_preference" class="text-secondary block text-[13.5px] font-medium">
						Tema
					</label>
					<select
						id="theme_preference"
						name="theme_preference"
						value={data.profil?.theme_preference ?? 'dark'}
						class="tw-field"
					>
						<option value="dark">Gelap</option>
						<option value="light">Terang</option>
						<option value="system">Ikut sistem</option>
					</select>
				</div>

				<div class="space-y-1.5">
					<label for="timezone" class="text-secondary block text-[13.5px] font-medium">
						Zona waktu
					</label>
					<select
						id="timezone"
						name="timezone"
						value={data.profil?.timezone ?? 'Asia/Jakarta'}
						class="tw-field"
					>
						<option value="Asia/Jakarta">Asia/Jakarta</option>
						<option value="Asia/Makassar">Asia/Makassar</option>
						<option value="Asia/Jayapura">Asia/Jayapura</option>
					</select>
				</div>
			</div>

			<button type="submit" data-testid="simpan-profil" class="tw-primary">
				<Save class="size-4" aria-hidden="true" />
				Simpan profil
			</button>
		</form>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<a
			href="/account/security"
			data-testid="tautan-keamanan"
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

		<a
			href="/account/sessions"
			data-testid="tautan-sesi"
			class="tw-card group hover:border-diamond-700 flex items-start gap-3 p-6 transition"
		>
			<MonitorSmartphone class="text-diamond-300 mt-0.5 size-5 flex-none" aria-hidden="true" />
			<span>
				<span class="tw-heading text-ink block">Perangkat yang login</span>
				<span class="tw-caption mt-1 block">
					Lihat sesi aktif dan cabut perangkat yang tidak kamu kenali.
				</span>
			</span>
		</a>
	</div>
</section>
