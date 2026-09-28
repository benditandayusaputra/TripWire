<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { ArrowDown, ArrowUp, ArrowUpRight } from 'lucide-svelte';
	import SkorBadge from '$lib/components/SkorBadge.svelte';
	import { arahHarga, formatHarga, posisiRentang, selisihSkor, type Baris } from '$lib/dashboard';
	import { tierDariSkor } from '$lib/skor';

	let {
		baris,
		pilihan,
		onpilih
	}: { baris: Baris[]; pilihan: string | null; onpilih: (ticker: string) => void } = $props();

	type Kunci = 'ticker' | 'ubah' | 'skor' | 'delta';
	let urut = $state<{ kunci: Kunci; arah: 1 | -1 }>({ kunci: 'skor', arah: -1 });

	const nilaiUrut: Record<Kunci, (satu: Baris) => number | string | null> = {
		ticker: (satu) => satu.ticker,
		ubah: (satu) => satu.kutipan?.daily_close_change ?? null,
		skor: (satu) => satu.skor,
		delta: (satu) => selisihSkor(satu)?.nilai ?? null
	};

	const terurut = $derived.by(() => {
		const ambil = nilaiUrut[urut.kunci];
		return [...baris].sort((a, b) => {
			const kiri = ambil(a);
			const kanan = ambil(b);
			if (kiri === null || kanan === null) {
				return kiri === kanan ? a.ticker.localeCompare(b.ticker) : kiri === null ? 1 : -1;
			}
			const beda =
				typeof kiri === 'string' ? kiri.localeCompare(String(kanan)) : kiri - Number(kanan);
			return beda * urut.arah || a.ticker.localeCompare(b.ticker);
		});
	});

	function urutkan(kunci: Kunci) {
		urut =
			urut.kunci === kunci
				? { kunci, arah: urut.arah === 1 ? -1 : 1 }
				: { kunci, arah: kunci === 'ticker' ? 1 : -1 };
	}

	const klikBaris: Attachment<HTMLElement> = (node) => {
		const dengar = (event: MouseEvent) => {
			const sasaran = event.target as HTMLElement;
			if (sasaran.closest('a, button')) return;
			const ticker = sasaran.closest<HTMLElement>('tr[data-ticker]')?.dataset.ticker;
			if (ticker) onpilih(ticker);
		};
		node.addEventListener('click', dengar);
		return () => node.removeEventListener('click', dengar);
	};

	function jalurTren(nilai: number[]) {
		if (nilai.length === 0) return '';
		const y = (skor: number) => (20 - (skor / 100) * 17).toFixed(1);
		if (nilai.length === 1) return `M1 ${y(nilai[0])} H63`;
		const langkah = 62 / (nilai.length - 1);
		return nilai
			.map((skor, i) =>
				i === 0 ? `M1 ${y(skor)}` : `H${(1 + i * langkah).toFixed(1)} V${y(skor)}`
			)
			.join(' ')
			.concat(' H63');
	}
</script>

{#snippet kepala(kunci: Kunci, label: string, kelas: string)}
	<th
		scope="col"
		class={kelas}
		aria-sort={urut.kunci === kunci ? (urut.arah === 1 ? 'ascending' : 'descending') : undefined}
	>
		<button
			type="button"
			onclick={() => urutkan(kunci)}
			class="hover:text-ink inline-flex items-center gap-1 uppercase transition {urut.kunci ===
			kunci
				? 'text-diamond-100'
				: ''}"
		>
			{label}
			{#if urut.kunci === kunci}
				{#if urut.arah === 1}
					<ArrowUp class="size-3" aria-hidden="true" />
				{:else}
					<ArrowDown class="size-3" aria-hidden="true" />
				{/if}
			{/if}
		</button>
	</th>
{/snippet}

<div class="-mx-2 overflow-x-auto px-2">
	<table
		data-testid="tabel-watchlist"
		class="w-full border-separate border-spacing-0 text-left"
		{@attach klikBaris}
	>
		<caption class="sr-only">
			Emiten di watchlist beserta harga penutupan terakhir dan Red Flag Score
		</caption>
		<thead>
			<tr class="tw-overline">
				{@render kepala('ticker', 'Emiten', 'text-left')}
				<th scope="col" class="text-right">Harga</th>
				{@render kepala('ubah', 'Ubah', 'hidden text-right sm:table-cell')}
				<th scope="col" class="hidden xl:table-cell">52 minggu</th>
				{@render kepala('skor', 'Skor', 'text-right')}
				{@render kepala('delta', 'Ubah skor', 'hidden text-right md:table-cell')}
				<th scope="col" class="hidden md:table-cell">Tren skor</th>
				<th scope="col" class="hidden w-8 sm:table-cell"><span class="sr-only">Insight</span></th>
			</tr>
		</thead>
		<tbody>
			{#each terurut as satu (satu.ticker)}
				{@const ubah = arahHarga(satu.kutipan?.daily_close_change)}
				{@const rentang = posisiRentang(satu.kutipan)}
				{@const selisih = selisihSkor(satu)}
				{@const dipilih = pilihan === satu.ticker}
				<tr data-testid="baris-watchlist" data-ticker={satu.ticker} class:dipilih>
					<td class="emiten">
						<button
							type="button"
							aria-pressed={dipilih}
							onclick={() => onpilih(satu.ticker)}
							class="flex max-w-[8.5rem] min-w-0 flex-col items-start text-left sm:max-w-[15rem]"
						>
							<span class="tw-data text-ink text-[14px] font-semibold tracking-wide"
								>{satu.ticker}</span
							>
							<span class="text-muted w-full truncate text-[12px]">{satu.nama}</span>
						</button>
					</td>
					<td class="text-right">
						{#if satu.kutipan}
							<span class="tw-data text-ink block text-[14px]"
								>{formatHarga(satu.kutipan.last_close_price)}</span
							>
							{#if ubah}
								<span class="tw-data block text-[11.5px] sm:hidden {ubah.kelas}">{ubah.teks}</span>
							{/if}
						{:else}
							<span class="text-muted text-[13px]" title="Harga muncul setelah pemindaian pertama"
								>-</span
							>
						{/if}
					</td>
					<td class="hidden text-right sm:table-cell">
						{#if ubah}
							<span class="tw-data text-[13px] {ubah.kelas}" aria-label={ubah.label}
								>{ubah.teks}</span
							>
						{:else}
							<span class="text-muted text-[13px]">-</span>
						{/if}
					</td>
					<td class="hidden xl:table-cell">
						{#if rentang}
							<span
								class="rentang"
								title="Rentang 52 minggu {formatHarga(rentang.rendah)} sampai {formatHarga(
									rentang.tinggi
								)}"
							>
								<span class="penanda" style="left:{rentang.posisi * 100}%"></span>
							</span>
						{:else}
							<span class="text-muted text-[13px]">-</span>
						{/if}
					</td>
					<td class="text-right">
						{#if satu.skor === null}
							<span class="text-muted text-[12px] whitespace-nowrap">Belum dinilai</span>
						{:else}
							<span class="sm:hidden"><SkorBadge skor={satu.skor} showLabel={false} /></span>
							<span class="hidden sm:inline"><SkorBadge skor={satu.skor} /></span>
						{/if}
					</td>
					<td class="hidden text-right md:table-cell">
						<span
							class="tw-data text-[12.5px] {selisih && selisih.nilai !== 0
								? 'text-ink'
								: 'text-muted'}"
						>
							{selisih?.teks ?? '-'}
						</span>
					</td>
					<td class="hidden md:table-cell">
						{#if satu.riwayat.length}
							<svg viewBox="0 0 64 22" class="h-5.5 w-16" aria-hidden="true">
								<path
									d={jalurTren(satu.riwayat.slice(-12).map((titik) => titik.skor))}
									fill="none"
									stroke={tierDariSkor(satu.skor).color}
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						{:else}
							<span class="text-muted text-[13px]">-</span>
						{/if}
					</td>
					<td class="hidden sm:table-cell">
						{#if satu.redFlag ?? satu.pasar}
							<a
								href="/insights/{(satu.redFlag ?? satu.pasar)?.id}"
								aria-label="Buka insight terbaru {satu.ticker}"
								class="text-muted hover:text-diamond-300 grid size-7 place-items-center rounded-lg transition hover:bg-white/5"
							>
								<ArrowUpRight class="size-4" aria-hidden="true" />
							</a>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	th {
		padding: 0 7px 10px;
		font-weight: 500;
		white-space: nowrap;
		border-bottom: 1px solid var(--edge-soft);
	}

	td {
		padding: 11px 7px;
		border-bottom: 1px solid rgba(180, 205, 255, 0.06);
		vertical-align: middle;
		white-space: nowrap;
		transition: background 0.15s ease;
	}

	th:first-child,
	td:first-child {
		padding-left: 10px;
	}

	@media (min-width: 640px) {
		th {
			padding: 0 10px 10px;
		}

		td {
			padding: 11px 10px;
		}

		th:first-child,
		td:first-child {
			padding-left: 12px;
		}
	}

	tbody tr {
		cursor: pointer;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	@media (hover: hover) {
		tbody tr:hover td {
			background: rgba(255, 255, 255, 0.025);
		}
	}

	tr.dipilih td {
		background: rgba(74, 158, 255, 0.07);
	}

	tr.dipilih td.emiten {
		box-shadow: inset 2px 0 0 var(--color-diamond-500);
	}

	td:first-child {
		border-radius: 10px 0 0 10px;
	}

	td:last-child {
		border-radius: 0 10px 10px 0;
	}

	.rentang {
		position: relative;
		display: block;
		width: 96px;
		height: 4px;
		border-radius: 999px;
		background: rgba(180, 205, 255, 0.14);
	}

	.penanda {
		position: absolute;
		top: 50%;
		width: 9px;
		height: 9px;
		border: 2px solid var(--color-base);
		border-radius: 999px;
		background: var(--color-ink);
		transform: translate(-50%, -50%);
	}
</style>
