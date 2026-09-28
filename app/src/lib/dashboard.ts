import { formatAngka, type HargaKomoditas, type Insight, type MetrikSektor } from '$lib/insight';

export type Kondisi = {
	id: string;
	condition_type: string;
	config: Record<string, number> | null;
	is_active: boolean;
};

export type ItemWatchlist = {
	id: string;
	ticker: string;
	company_name: string;
	created_at: string;
	conditions: Kondisi[];
};

export type Kutipan = {
	ticker: string;
	last_close_price: number;
	latest_close_date?: string;
	daily_close_change: number | null;
	market_cap: number | null;
	market_cap_rank: number | null;
	high_52w: number | null;
	low_52w: number | null;
	sector?: string;
	sub_sector?: string;
	indices: string[];
};

export type TitikSkor = { id: string; skor: number; waktu: string };

export type Baris = {
	ticker: string;
	nama: string;
	kutipan: Kutipan | null;
	redFlag: Insight | null;
	pasar: Insight | null;
	skor: number | null;
	skorLalu: number | null;
	riwayat: TitikSkor[];
	ambang: number | null;
	kondisiAktif: Kondisi[];
	sektor: string | null;
};

const HARI_MS = 86_400_000;

const SEKTOR: Record<string, string> = {
	'Basic Materials': 'Barang baku',
	Energy: 'Energi',
	Financials: 'Keuangan',
	Infrastructures: 'Infrastruktur',
	'Consumer Non-Cyclicals': 'Konsumen primer',
	'Consumer Cyclicals': 'Konsumen non primer',
	Healthcare: 'Kesehatan',
	Industrials: 'Perindustrian',
	'Properties & Real Estate': 'Properti',
	Technology: 'Teknologi',
	'Transportation & Logistic': 'Transportasi dan logistik'
};

export const labelSektor = (nama: string) => SEKTOR[nama] ?? nama;

function kelompok<T>(daftar: T[], kunci: (item: T) => string) {
	const peta = new Map<string, T[]>();
	for (const item of daftar) {
		const nama = kunci(item);
		peta.set(nama, [...(peta.get(nama) ?? []), item]);
	}
	return peta;
}

export function susunBaris(
	items: ItemWatchlist[],
	insights: Insight[],
	kutipan: Record<string, Kutipan>
): Baris[] {
	const perTicker = kelompok(insights, (insight) => insight.ticker);

	return items.map((item) => {
		const semua = perTicker.get(item.ticker) ?? [];
		const merah = semua.filter((i) => i.insight_type === 'red_flag' && i.score !== null);
		const pasar = semua.find((i) => i.insight_type === 'market_intelligence') ?? null;
		const kondisiAktif = item.conditions.filter((k) => k.is_active);
		const ambang = kondisiAktif.map((k) => k.config?.min_score ?? 0).filter((nilai) => nilai > 0);
		const quote = kutipan[item.ticker] ?? null;

		return {
			ticker: item.ticker,
			nama: item.company_name || semua[0]?.company_name || '',
			kutipan: quote,
			redFlag: merah[0] ?? null,
			pasar,
			skor: merah[0]?.score ?? null,
			skorLalu: merah[1]?.score ?? null,
			riwayat: merah
				.map((i) => ({ id: i.id, skor: i.score as number, waktu: i.generated_at }))
				.reverse(),
			ambang: ambang.length ? Math.min(...ambang) : null,
			kondisiAktif,
			sektor: quote?.sector || pasar?.payload?.sector_snapshot?.sector || null
		};
	});
}

export type StatusBursa = { buka: boolean; label: string; detail: string };

const menitKe = (jam: number, menit = 0) => jam * 60 + menit;
const jamWib = (menit: number) =>
	`${String(Math.floor(menit / 60)).padStart(2, '0')}.${String(menit % 60).padStart(2, '0')} WIB`;

export function statusBursa(sekarang: Date): StatusBursa {
	const wib = new Date(sekarang.getTime() + 7 * 3_600_000);
	const hari = wib.getUTCDay();
	const menit = wib.getUTCHours() * 60 + wib.getUTCMinutes();
	const jumat = hari === 5;
	const akhirSesi1 = jumat ? menitKe(11, 30) : menitKe(12);
	const awalSesi2 = jumat ? menitKe(14) : menitKe(13, 30);

	if (hari === 0 || hari === 6)
		return { buka: false, label: 'Bursa tutup', detail: 'Buka Senin 09.00 WIB' };
	if (menit < menitKe(8, 45))
		return {
			buka: false,
			label: 'Belum dibuka',
			detail: `Pra pembukaan ${jamWib(menitKe(8, 45))}`
		};
	if (menit < menitKe(9))
		return { buka: true, label: 'Pra pembukaan', detail: `Sesi I mulai ${jamWib(menitKe(9))}` };
	if (menit < akhirSesi1)
		return { buka: true, label: 'Sesi I berjalan', detail: `Sampai ${jamWib(akhirSesi1)}` };
	if (menit < awalSesi2)
		return { buka: false, label: 'Istirahat siang', detail: `Sesi II mulai ${jamWib(awalSesi2)}` };
	if (menit < menitKe(15, 50))
		return { buka: true, label: 'Sesi II berjalan', detail: `Sampai ${jamWib(menitKe(15, 50))}` };
	if (menit < menitKe(16, 2))
		return { buka: true, label: 'Pra penutupan', detail: 'Harga penutupan sedang dibentuk' };
	if (menit < menitKe(16, 15))
		return { buka: true, label: 'Pasca penutupan', detail: `Sampai ${jamWib(menitKe(16, 15))}` };
	return {
		buka: false,
		label: 'Bursa tutup',
		detail: jumat ? 'Buka Senin 09.00 WIB' : 'Buka besok 09.00 WIB'
	};
}

export function insightPerHari(insights: Insight[], sekarang: Date, jumlahHari = 7) {
	const hariIni = Math.floor((sekarang.getTime() + 7 * 3_600_000) / HARI_MS);
	const hitung = Array.from({ length: jumlahHari }, () => 0);
	for (const insight of insights) {
		const hari = Math.floor((new Date(insight.generated_at).getTime() + 7 * 3_600_000) / HARI_MS);
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

export function aktivitasOrangDalam(baris: Baris[], batas = 6): AktivitasOrangDalam[] {
	return baris
		.flatMap((satu) =>
			(satu.redFlag?.payload.supporting_data?.insider_transactions ?? []).map((t) => ({
				ticker: satu.ticker,
				tanggal: t.date,
				nama: t.holder_name,
				jenis: t.transaction_type,
				nilai: t.transaction_value,
				sebelum: t.share_pct_before,
				sesudah: t.share_pct_after,
				sumber: t.source_url
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

export function agendaEmiten(baris: Baris[], sekarang: Date, batas = 6): Agenda[] {
	const kini = sekarang.toISOString();
	const semua: Agenda[] = baris.flatMap((satu) => [
		...(satu.pasar?.payload.license_radar?.expiring_soon ?? []).map((izin) => ({
			ticker: satu.ticker,
			tanggal: izin.expires_at,
			jenis: 'lisensi' as const,
			judul: `Izin ${izin.license_id} ${izin.expired ? 'sudah berakhir' : 'segera berakhir'}`,
			detail: [izin.license_type, izin.province].filter(Boolean).join(', '),
			akanDatang: izin.expires_at > kini
		})),
		...(satu.redFlag?.payload.supporting_data?.suspensions ?? []).map((s) => ({
			ticker: satu.ticker,
			tanggal: s.date,
			jenis: 'suspensi' as const,
			judul: 'Perdagangan dihentikan bursa',
			detail: s.reason,
			akanDatang: false
		})),
		...(satu.redFlag?.payload.supporting_data?.ownership_changes ?? []).map((p) => ({
			ticker: satu.ticker,
			tanggal: p.last_date,
			jenis: 'kepemilikan' as const,
			judul: `Kepemilikan ${p.holder_name} ${p.delta_pp >= 0 ? 'naik' : 'turun'}`,
			detail: `${formatAngka(p.share_pct_before)}% menjadi ${formatAngka(p.share_pct_after)}%`,
			akanDatang: false
		}))
	]);

	const datang = semua
		.filter((a) => a.akanDatang)
		.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
	const lalu = semua
		.filter((a) => !a.akanDatang)
		.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
	return [...datang, ...lalu].slice(0, batas);
}

export type BarisValuasi = {
	ticker: string;
	subSektor: string;
	metrik: Record<string, MetrikSektor>;
};

export function valuasiSektor(baris: Baris[]): BarisValuasi[] {
	return baris.flatMap((satu) => {
		const snapshot = satu.pasar?.payload.sector_snapshot;
		if (!snapshot?.metrics?.length) return [];
		return [
			{
				ticker: satu.ticker,
				subSektor: snapshot.sub_sector ?? '',
				metrik: Object.fromEntries(snapshot.metrics.map((m) => [m.key, m]))
			}
		];
	});
}

export type Komoditas = HargaKomoditas & { tickers: string[] };

export function komoditasTerpantau(baris: Baris[]): Komoditas[] {
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

export function sebaranSektor(baris: Baris[]) {
	const hitung = kelompok(baris, (satu) =>
		satu.sektor ? labelSektor(satu.sektor) : 'Belum diketahui'
	);
	return [...hitung]
		.map(([nama, anggota]) => ({ nama, tickers: anggota.map((a) => a.ticker) }))
		.sort((a, b) => b.tickers.length - a.tickers.length || a.nama.localeCompare(b.nama));
}

const persenDua = new Intl.NumberFormat('id-ID', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

export const formatHarga = (nilai: number) => formatAngka(nilai, 0);

export function arahHarga(fraksi: number | null | undefined) {
	if (fraksi === null || fraksi === undefined) return null;
	const persen = fraksi * 100;
	if (Math.abs(persen) < 0.005) return { teks: '0,00%', kelas: 'text-secondary', label: 'tetap' };
	const naik = persen > 0;
	return {
		teks: `${naik ? '▲' : '▼'} ${persenDua.format(Math.abs(persen))}%`,
		kelas: naik ? 'text-naik' : 'text-turun',
		label: `${naik ? 'naik' : 'turun'} ${persenDua.format(Math.abs(persen))} persen`
	};
}

export function selisihSkor(baris: Baris) {
	if (baris.skor === null || baris.skorLalu === null) return null;
	const selisih = Math.round(baris.skor) - Math.round(baris.skorLalu);
	if (selisih === 0) return { nilai: 0, teks: 'tetap' };
	return { nilai: selisih, teks: `${selisih > 0 ? '▲' : '▼'} ${Math.abs(selisih)}` };
}

export function posisiRentang(kutipan: Kutipan | null) {
	if (!kutipan || kutipan.low_52w === null || kutipan.high_52w === null) return null;
	const rentang = kutipan.high_52w - kutipan.low_52w;
	const posisi = rentang > 0 ? (kutipan.last_close_price - kutipan.low_52w) / rentang : 0.5;
	return {
		rendah: kutipan.low_52w,
		tinggi: kutipan.high_52w,
		posisi: Math.min(1, Math.max(0, posisi))
	};
}
