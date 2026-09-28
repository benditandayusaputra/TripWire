<script lang="ts">
	import { enhance } from '$app/forms';
	import { LoaderCircle, Plus, Search } from 'lucide-svelte';
	import { request } from '$lib/api/client';

	let { besar = false }: { besar?: boolean } = $props();

	const id = $props.id();

	let kode = $state('');
	let saran = $state<{ code: string; name: string }[]>([]);
	let sibuk = $state(false);
	let pesan = $state('');
	let tunda: ReturnType<typeof setTimeout> | undefined;

	function cari() {
		clearTimeout(tunda);
		pesan = '';
		const kata = kode.trim();
		if (!kata) {
			saran = [];
			return;
		}
		tunda = setTimeout(async () => {
			try {
				const hasil = await request<{ tickers: { code: string; name: string }[] }>(
					`/tickers?q=${encodeURIComponent(kata)}&limit=8`
				);
				saran = hasil.tickers;
			} catch {
				saran = [];
			}
		}, 160);
	}
</script>

<form
	method="POST"
	action="/watchlist?/tambah"
	data-testid="tambah-emiten"
	class="flex flex-wrap items-start gap-2"
	use:enhance={() => {
		sibuk = true;
		return async ({ result, update }) => {
			sibuk = false;
			if (result.type === 'failure') {
				const galat = result.data as
					{ error?: string; fields?: Record<string, string> } | undefined;
				pesan = galat?.fields?.ticker ?? galat?.error ?? 'Emiten gagal ditambahkan';
				return;
			}
			await update();
			kode = '';
			saran = [];
		};
	}}
>
	<input type="hidden" name="data_display_pref" value="insight_only" />
	<div class="relative min-w-0 flex-1 {besar ? 'basis-64' : 'basis-44'}">
		<label for="kode-{id}" class="sr-only">Kode emiten untuk dipantau</label>
		<Search
			class="text-muted pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
			aria-hidden="true"
		/>
		<input
			id="kode-{id}"
			name="ticker"
			bind:value={kode}
			oninput={cari}
			list="saran-{id}"
			autocomplete="off"
			spellcheck="false"
			maxlength="12"
			required
			placeholder={besar ? 'Cari kode atau nama emiten' : 'Tambah emiten'}
			aria-invalid={pesan ? 'true' : undefined}
			aria-describedby={pesan ? `pesan-${id}` : undefined}
			class="tw-field tw-data pl-10 uppercase placeholder:normal-case {besar
				? ''
				: 'py-2! text-[14px]!'}"
		/>
		<datalist id="saran-{id}">
			{#each saran as emiten (emiten.code)}
				<option value={emiten.code}>{emiten.name}</option>
			{/each}
		</datalist>
	</div>
	<button
		type="submit"
		disabled={sibuk}
		aria-busy={sibuk}
		class="tw-primary {besar ? '' : 'px-3.5 py-2 text-[14px]'}"
	>
		{#if sibuk}
			<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
		{:else}
			<Plus class="size-4" aria-hidden="true" />
		{/if}
		{sibuk ? 'Menambah' : 'Pantau'}
	</button>
	{#if pesan}
		<p id="pesan-{id}" role="alert" class="text-tier-critical basis-full text-[12.5px]">{pesan}</p>
	{/if}
</form>
