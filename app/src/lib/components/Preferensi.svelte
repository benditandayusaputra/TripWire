<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { Monitor, Moon, Sun } from 'lucide-svelte';
	import { bahasa, gantiBahasa, gantiTema, t, type Bahasa, type Tema } from '$lib/bahasa.svelte';

	const id = $props.id();
	const NAMA_BAHASA: [Bahasa, string][] = [
		['id', 'Indonesia'],
		['en', 'English']
	];

	let tombol: HTMLButtonElement;
	let panel: HTMLDivElement;
	let tema = $state(
		((browser ? document.documentElement.dataset.tema : page.data.tema) ?? 'dark') as Tema
	);

	const pilihanTema = $derived([
		{ nilai: 'dark' as const, label: t('Gelap', 'Dark'), ikon: Moon },
		{ nilai: 'light' as const, label: t('Terang', 'Light'), ikon: Sun },
		{ nilai: 'system' as const, label: t('Sistem', 'System'), ikon: Monitor }
	]);
	const IkonTema = $derived(pilihanTema.find((satu) => satu.nilai === tema)?.ikon ?? Moon);

	function pilihTema(nilai: Tema) {
		tema = nilai;
		gantiTema(nilai);
	}

	function posisikan(event: ToggleEvent) {
		if (event.newState !== 'open') return;
		const kotak = tombol.getBoundingClientRect();
		panel.style.top = `${kotak.bottom + 8}px`;
		panel.style.right = `${Math.max(12, innerWidth - kotak.right)}px`;
	}
</script>

<button
	bind:this={tombol}
	type="button"
	popovertarget="preferensi-{id}"
	data-testid="tombol-preferensi"
	aria-label={t('Tema dan bahasa', 'Theme and language')}
	class="pemicu"
	{@attach (tombol) => {
		tombol.dataset.siap = '';
	}}
>
	<IkonTema class="size-3.5" aria-hidden="true" />
	<span class="tw-data">{bahasa().toUpperCase()}</span>
</button>

<div
	bind:this={panel}
	id="preferensi-{id}"
	popover
	ontoggle={posisikan}
	data-testid="panel-preferensi"
	class="panel"
>
	<fieldset>
		<legend class="tw-overline">{t('Tema', 'Theme')}</legend>
		<div class="segmen tiga">
			{#each pilihanTema as satu (satu.nilai)}
				<label>
					<input
						type="radio"
						name="tema-{id}"
						value={satu.nilai}
						checked={tema === satu.nilai}
						onchange={() => pilihTema(satu.nilai)}
					/>
					<satu.ikon class="size-3.5" aria-hidden="true" />
					{satu.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset>
		<legend class="tw-overline">{t('Bahasa', 'Language')}</legend>
		<div class="segmen">
			{#each NAMA_BAHASA as [kode, nama] (kode)}
				<label lang={kode}>
					<input
						type="radio"
						name="bahasa-{id}"
						value={kode}
						checked={bahasa() === kode}
						onchange={() => gantiBahasa(kode)}
					/>
					{nama}
				</label>
			{/each}
		</div>
	</fieldset>
</div>

<style>
	.pemicu {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--edge);
		border-radius: var(--radius-glass);
		padding: 6px 10px;
		font-size: 12px;
		color: var(--color-secondary);
		transition:
			border-color 0.2s ease,
			color 0.2s ease,
			background 0.2s ease;
	}

	.pemicu:hover,
	.pemicu:has(+ .panel:popover-open) {
		border-color: var(--color-diamond-700);
		background: rgba(74, 158, 255, 0.06);
		color: var(--color-ink);
	}

	.panel {
		position: fixed;
		inset: auto;
		margin: 0;
		width: 264px;
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-glass-lg);
		background: var(--color-raised);
		padding: 14px;
		color: var(--color-ink);
		box-shadow: 0 24px 56px -24px var(--bayang);
	}

	.panel:popover-open {
		display: grid;
		gap: 14px;
	}

	fieldset {
		display: grid;
		gap: 8px;
	}

	.segmen {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
		border: 1px solid var(--edge);
		border-radius: 12px;
		background: color-mix(in srgb, var(--color-void) 60%, transparent);
		padding: 3px;
	}

	.segmen.tiga {
		grid-template-columns: repeat(3, 1fr);
	}

	label {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border-radius: 9px;
		padding: 7px 6px;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease;
	}

	label:hover {
		color: var(--color-ink);
	}

	label:has(input:checked) {
		background: var(--color-base);
		color: var(--color-ink);
		box-shadow: inset 0 0 0 1px var(--edge-strong);
	}

	label:has(input:focus-visible) {
		outline: 2px solid var(--color-diamond-300);
		outline-offset: 2px;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
</style>
