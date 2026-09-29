import { lokal, t } from '$lib/bahasa.svelte';
import { formatAngka, type HargaKomoditas, type Insight, type MetrikSektor } from '$lib/insight';
import {
	HARI_TREN,
	batasNotifikasi,
	penutupanTerbaru,
	ringkasTren,
	type Harian,
	type ItemWatchlist,
	type Kondisi,
	type Kutipan,
	type Penutupan,
	type Risiko
} from '$lib/watchlist';

export type Rentang52 = { rendah: number; tinggi: number; posisi: number };

export type VolumeRelatif = { terakhir: number; rataRata: number; rasio: number };

export type BarisDashboard = {
	item: ItemWatchlist;
	ticker: string;
	nama: string;
	kutipan: Kutipan | null;
	risiko: Risiko | null;
	skor: number | null;
	skorLalu: number | null;
	redFlag: Insight | null;
	pasar: Insight | null;
	kondisiAktif: Kondisi[];
	batas: number;
	sektor: string | null;
	seri: Harian[];
	tren: number[] | null;
	penutupan: Penutupan | null;
	bulan: number | null;
	kuartal: number | null;
	volume: VolumeRelatif | null;
	rentang: Rentang52 | null;
};

const HARI_MS = 86_400_000;
const GESER_WIB = 7 * 3_600_000;

export const formatDesimal = (nilai: number, digit = 2) =>
	new Intl.NumberFormat(lokal(), {
		minimumFractionDigits: digit,
		maximumFractionDigits: digit
	}).format(nilai);

export function formatPersen(pecahan: number | null | undefined, digit = 2) {
	if (pecahan === null || pecahan === undefined || Number.isNaN(pecahan)) {
		return { teks: '-', angka: '-', arah: 0 };
	}
	const arah = pecahan > 0 ? 1 : pecahan < 0 ? -1 : 0;
	const angka = `${formatDesimal(Math.abs(pecahan * 100), digit)}%`;
	return { teks: `${arah > 0 ? '▲' : arah < 0 ? '▼' : '■'} ${angka}`, angka, arah };
}

export const kelasArah = (arah: number) =>
	arah > 0 ? 'text-naik' : arah < 0 ? 'text-turun' : 'text-secondary';

export const kataArah = (arah: number) =>
	arah > 0 ? t('naik', 'up') : arah < 0 ? t('turun', 'down') : t('tetap', 'flat');

export const tanggalBursa = (tanggal: string, tahun = false) =>
	new Date(`${tanggal.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lokal(), {
		day: 'numeric',
		month: 'short',
		...(tahun ? { year: 'numeric' } : {}),
		timeZone: 'UTC'
	});

function kelompok<T>(daftar: T[], kunci: (item: T) => string) {
	const peta = new Map<string, T[]>();
	for (const item of daftar) {
		const nama = kunci(item);
		peta.set(nama, [...(peta.get(nama) ?? []), item]);
	}
	return peta;
}

export function perubahanSejak(seri: Harian[], mundur: number) {
	if (seri.length < 2) return null;
	const awal = seri[Math.max(0, seri.length - 1 - mundur)].close;
	return awal > 0 ? seri[seri.length - 1].close / awal - 1 : null;
}

export function volumeRelatif(seri: Harian[]): VolumeRelatif | null {
	const terakhir = seri.at(-1)?.volume ?? 0;
	const sebelumnya = seri
		.slice(-21, -1)
		.map((bar) => bar.volume ?? 0)
		.filter((volume) => volume > 0);
	if (terakhir <= 0 || sebelumnya.length < 5) return null;
	const rataRata = sebelumnya.reduce((total, volume) => total + volume, 0) / sebelumnya.length;
	return { terakhir, rataRata, rasio: terakhir / rataRata };
}

export function rentang52(kutipan: Kutipan | null, harga: number | null): Rentang52 | null {
	if (!kutipan || kutipan.low_52w === null || kutipan.high_52w === null || harga === null) {
		return null;
	}
	const lebar = kutipan.high_52w - kutipan.low_52w;
	const posisi = lebar > 0 ? (harga - kutipan.low_52w) / lebar : 0.5;
	return {
		rendah: kutipan.low_52w,
		tinggi: kutipan.high_52w,
		posisi: Math.min(1, Math.max(0, posisi))
	};
}

export function susunBaris(
	items: ItemWatchlist[],
	kutipan: Record<string, Kutipan>,
	risiko: Record<string, Risiko>,
	insights: Insight[],
	harga: Record<string, Harian[]>
): BarisDashboard[] {
	const perTicker = kelompok(insights, (insight) => insight.ticker);

	return items.map((item) => {
		const semua = perTicker.get(item.ticker) ?? [];
		const redFlag = semua.find((insight) => insight.insight_type === 'red_flag') ?? null;
		const pasar = semua.find((insight) => insight.insight_type === 'market_intelligence') ?? null;
		const quote = kutipan[item.ticker] ?? null;
		const resiko = risiko[item.ticker] ?? null;
		const seri = harga[item.ticker] ?? [];
		const penutupan = penutupanTerbaru(quote, ringkasTren(seri));

		return {
			item,
			ticker: item.ticker,
			nama: item.company_name || semua[0]?.company_name || '',
			kutipan: quote,
			risiko: resiko,
			skor: resiko?.red_flag?.score ?? redFlag?.score ?? null,
			skorLalu: resiko?.previous_score ?? null,
			redFlag,
			pasar,
			kondisiAktif: item.conditions.filter((kondisi) => kondisi.is_active),
			batas: batasNotifikasi(item.conditions),
			sektor: quote?.sector || pasar?.payload?.sector_snapshot?.sector || null,
			seri,
			tren: seri.length > 1 ? seri.slice(-HARI_TREN).map((bar) => bar.close) : null,
			penutupan,
			bulan: perubahanSejak(seri, HARI_TREN - 1),
			kuartal: perubahanSejak(seri, seri.length),
			volume: volumeRelatif(seri),
			rentang: rentang52(quote, penutupan?.harga ?? null)
		};
	});
}

export type StatusBursa = { buka: boolean; label: string; detail: string };

const menitKe = (jam: number, menit = 0) => jam * 60 + menit;

function jamWib(menit: number) {
	const jam = String(Math.floor(menit / 60)).padStart(2, '0');
	const sisa = String(menit % 60).padStart(2, '0');
	return t(`${jam}.${sisa} WIB`, `${jam}:${sisa} WIB`);
}

export function statusBursa(sekarang: Date): StatusBursa {
	const wib = new Date(sekarang.getTime() + GESER_WIB);
	const hari = wib.getUTCDay();
	const menit = wib.getUTCHours() * 60 + wib.getUTCMinutes();
	const jumat = hari === 5;
	const akhirSesi1 = jumat ? menitKe(11, 30) : menitKe(12);
	const awalSesi2 = jumat ? menitKe(14) : menitKe(13, 30);
	const bukaSenin = t(`Buka Senin ${jamWib(menitKe(9))}`, `Opens Monday ${jamWib(menitKe(9))}`);

	if (hari === 0 || hari === 6) {
		return { buka: false, label: t('Bursa tutup', 'Market closed'), detail: bukaSenin };
	}
	if (menit < menitKe(8, 45)) {
		return {
			buka: false,
			label: t('Belum dibuka', 'Not open yet'),
			detail: t(`Pra pembukaan ${jamWib(menitKe(8, 45))}`, `Pre-opening ${jamWib(menitKe(8, 45))}`)
		};
	}
	if (menit < menitKe(9)) {
		return {
			buka: true,
			label: t('Pra pembukaan', 'Pre-opening'),
			detail: t(`Sesi I mulai ${jamWib(menitKe(9))}`, `Session I starts ${jamWib(menitKe(9))}`)
		};
	}
	if (menit < akhirSesi1) {
		return {
			buka: true,
			label: t('Sesi I berjalan', 'Session I open'),
			detail: t(`Sampai ${jamWib(akhirSesi1)}`, `Until ${jamWib(akhirSesi1)}`)
		};
	}
	if (menit < awalSesi2) {
		return {
			buka: false,
			label: t('Istirahat siang', 'Lunch break'),
			detail: t(`Sesi II mulai ${jamWib(awalSesi2)}`, `Session II starts ${jamWib(awalSesi2)}`)
		};
	}
	if (menit < menitKe(15, 50)) {
		return {
			buka: true,
			label: t('Sesi II berjalan', 'Session II open'),
			detail: t(`Sampai ${jamWib(menitKe(15, 50))}`, `Until ${jamWib(menitKe(15, 50))}`)
		};
	}
	if (menit < menitKe(16, 1)) {
		return {
			buka: true,
			label: t('Pra penutupan', 'Pre-closing'),
			detail: t('Harga penutupan sedang dibentuk', 'Closing price is being formed')
		};
	}
	if (menit < menitKe(16, 15)) {
		return {
			buka: true,
			label: t('Pasca penutupan', 'Post-closing'),
			detail: t(`Sampai ${jamWib(menitKe(16, 15))}`, `Until ${jamWib(menitKe(16, 15))}`)
		};
	}
	return {
		buka: false,
		label: t('Bursa tutup', 'Market closed'),
		detail: jumat
			? bukaSenin
			: t(`Buka besok ${jamWib(menitKe(9))}`, `Opens tomorrow ${jamWib(menitKe(9))}`)
	};
}

export function insightPerHari(insights: Insight[], sekarang: Date, jumlahHari = 7) {
	const hariIni = Math.floor((sekarang.getTime() + GESER_WIB) / HARI_MS);
	const hitung = Array.from({ length: jumlahHari }, () => 0);
	for (const insight of insights) {
		const hari = Math.floor((new Date(insight.generated_at).getTime() + GESER_WIB) / HARI_MS);
		const urutan = jumlahHari - 1 - (hariIni - hari);
		if (urutan >= 0 && urutan < jumlahHari) hitung[urutan] += 1;
	}
	return hitung;
}

export type AktivitasOrangDalam = {
	ticker: string;
	tanggal: string;
	nama: string;
	jenis: string;
	nilai: number;
	sebelum?: number;
	sesudah?: number;
	sumber?: string;
};

export function aktivitasOrangDalam(baris: BarisDashboard[], batas = 6): AktivitasOrangDalam[] {
	return baris
		.flatMap((satu) =>
			(satu.redFlag?.payload.supporting_data?.insider_transactions ?? []).map((transaksi) => ({
				ticker: satu.ticker,
				tanggal: transaksi.date,
				nama: transaksi.holder_name,
				jenis: transaksi.transaction_type,
				nilai: transaksi.transaction_value,
				sebelum: transaksi.share_pct_before,
				sesudah: transaksi.share_pct_after,
				sumber: transaksi.source_url
			}))
		)
		.sort((a, b) => b.tanggal.localeCompare(a.tanggal))
		.slice(0, batas);
}

export type Agenda = {
	ticker: string;
	tanggal: string;
	jenis: 'lisensi' | 'suspensi' | 'kepemilikan';
	judul: string;
	detail: string;
	akanDatang: boolean;
};

export function agendaEmiten(baris: BarisDashboard[], sekarang: Date, batas = 6): Agenda[] {
	const kini = sekarang.toISOString();
	const semua: Agenda[] = baris.flatMap((satu) => [
		...(satu.pasar?.payload.license_radar?.expiring_soon ?? []).map((izin) => ({
			ticker: satu.ticker,
			tanggal: izin.expires_at,
			jenis: 'lisensi' as const,
			judul: izin.expired
				? t(`Izin ${izin.license_id} sudah berakhir`, `Permit ${izin.license_id} has expired`)
				: t(`Izin ${izin.license_id} segera berakhir`, `Permit ${izin.license_id} expires soon`),
			detail: [izin.license_type, izin.province].filter(Boolean).join(', '),
			akanDatang: izin.expires_at > kini
		})),
		...(satu.redFlag?.payload.supporting_data?.suspensions ?? []).map((suspensi) => ({
			ticker: satu.ticker,
			tanggal: suspensi.date,
			jenis: 'suspensi' as const,
			judul: t('Perdagangan dihentikan bursa', 'Trading suspended by the exchange'),
			detail: suspensi.reason,
			akanDatang: false
		})),
		...(satu.redFlag?.payload.supporting_data?.ownership_changes ?? []).map((perubahan) => ({
			ticker: satu.ticker,
			tanggal: perubahan.last_date,
			jenis: 'kepemilikan' as const,
			judul:
				perubahan.delta_pp >= 0
					? t(`Kepemilikan ${perubahan.holder_name} naik`, `${perubahan.holder_name} stake up`)
					: t(`Kepemilikan ${perubahan.holder_name} turun`, `${perubahan.holder_name} stake down`),
			detail: t(
				`${formatAngka(perubahan.share_pct_before)}% menjadi ${formatAngka(perubahan.share_pct_after)}%`,
				`${formatAngka(perubahan.share_pct_before)}% to ${formatAngka(perubahan.share_pct_after)}%`
			),
			akanDatang: false
		}))
	]);

	const datang = semua
		.filter((agenda) => agenda.akanDatang)
		.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
	const lalu = semua
		.filter((agenda) => !agenda.akanDatang)
		.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
	return [...datang, ...lalu].slice(0, batas);
}

export type BarisValuasi = {
	ticker: string;
	subSektor: string;
	metrik: Record<string, MetrikSektor>;
};

export function valuasiSektor(baris: BarisDashboard[]): BarisValuasi[] {
	return baris.flatMap((satu) => {
		const snapshot = satu.pasar?.payload.sector_snapshot;
		if (!snapshot?.metrics?.length) return [];
		return [
			{
				ticker: satu.ticker,
				subSektor: snapshot.sub_sector ?? '',
				metrik: Object.fromEntries(snapshot.metrics.map((metrik) => [metrik.key, metrik]))
			}
		];
	});
}

export type Komoditas = HargaKomoditas & { tickers: string[] };

export function komoditasTerpantau(baris: BarisDashboard[]): Komoditas[] {
	const peta = new Map<string, Komoditas>();
	for (const satu of baris) {
		const harga = satu.pasar?.payload.commodity_price;
		if (!harga) continue;
		const ada = peta.get(harga.commodity);
		if (ada) ada.tickers.push(satu.ticker);
		else peta.set(harga.commodity, { ...harga, tickers: [satu.ticker] });
	}
	return [...peta.values()];
}

export function alokasiSektor(baris: BarisDashboard[]) {
	return [...kelompok(baris, (satu) => satu.sektor ?? '')]
		.map(([nama, anggota]) => ({ nama, tickers: anggota.map((satu) => satu.ticker) }))
		.sort((a, b) => b.tickers.length - a.tickers.length || a.nama.localeCompare(b.nama));
}
