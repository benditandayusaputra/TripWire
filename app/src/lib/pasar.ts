import type { SahamPasar } from '$lib/watchlist';

export type TitikIndeks = { date: string; price: number };

export type SeriIndeks = { code: string; series: TitikIndeks[] };

export type ArusAsing = {
	ticker: string;
	company_name: string;
	net_foreign_inflow: number;
	foreign_buy_idr: number;
	foreign_sell_idr: number;
};

export type RingkasanAsing = { date: string; top_buy: ArusAsing[]; top_sell: ArusAsing[] };

export type SahamAktif = SahamPasar & {
	last_close_price: number;
	daily_close_change: number;
	market_cap: number;
};

export type SektorPasar = {
	nama: string;
	ubah: number;
	kapitalisasi: number;
	jumlah: number;
	naik: number;
	turun: number;
};

export type RingkasanPasar = {
	naik: number;
	turun: number;
	tetap: number;
	kapitalisasi: number;
	ubah: number;
	sebaran: number[];
	sektor: SektorPasar[];
	naikTertinggi: SahamAktif[];
	turunTerdalam: SahamAktif[];
	terbesar: SahamAktif[];
	peta: SahamAktif[];
};

export type Kotak = { x: number; y: number; w: number; h: number };

export const KAPITALISASI_PENGGERAK = 1e12;
const JUMLAH_PENGGERAK = 8;
const JUMLAH_PETA = 40;

export const kelompokUbah = (ubah: number) =>
	ubah === 0
		? 3
		: ubah < 0
			? ubah <= -0.05
				? 0
				: ubah <= -0.02
					? 1
					: 2
			: ubah >= 0.05
				? 6
				: ubah >= 0.02
					? 5
					: 4;

const aktif = (saham: SahamPasar): saham is SahamAktif =>
	(saham.last_close_price ?? 0) > 0 &&
	saham.daily_close_change !== null &&
	saham.daily_close_change > -1 &&
	(saham.market_cap ?? 0) > 0;

export function ringkasPasar(semua: SahamPasar[]): RingkasanPasar | null {
	const saham = semua.filter(aktif);
	if (!saham.length) return null;

	let naik = 0;
	let turun = 0;
	let kapitalisasi = 0;
	let kapitalisasiLalu = 0;
	const sebaran = Array.from({ length: 7 }, () => 0);
	const perSektor = new Map<string, SektorPasar & { lalu: number }>();

	for (const satu of saham) {
		const lalu = satu.market_cap / (1 + satu.daily_close_change);
		const arah = Math.sign(satu.daily_close_change);
		if (arah > 0) naik += 1;
		if (arah < 0) turun += 1;
		kapitalisasi += satu.market_cap;
		kapitalisasiLalu += lalu;
		sebaran[kelompokUbah(satu.daily_close_change)] += 1;

		if (!satu.sector) continue;
		const sektor = perSektor.get(satu.sector) ?? {
			nama: satu.sector,
			ubah: 0,
			kapitalisasi: 0,
			jumlah: 0,
			naik: 0,
			turun: 0,
			lalu: 0
		};
		sektor.kapitalisasi += satu.market_cap;
		sektor.lalu += lalu;
		sektor.jumlah += 1;
		if (arah > 0) sektor.naik += 1;
		if (arah < 0) sektor.turun += 1;
		perSektor.set(satu.sector, sektor);
	}

	const menurutUbah = saham
		.filter((satu) => satu.market_cap >= KAPITALISASI_PENGGERAK)
		.sort((a, b) => b.daily_close_change - a.daily_close_change);
	const menurutKapitalisasi = [...saham].sort((a, b) => b.market_cap - a.market_cap);

	return {
		naik,
		turun,
		tetap: saham.length - naik - turun,
		kapitalisasi,
		ubah: kapitalisasi / kapitalisasiLalu - 1,
		sebaran,
		sektor: [...perSektor.values()]
			.map(({ lalu, ...sektor }) => ({ ...sektor, ubah: sektor.kapitalisasi / lalu - 1 }))
			.sort((a, b) => b.ubah - a.ubah),
		naikTertinggi: menurutUbah
			.filter((satu) => satu.daily_close_change > 0)
			.slice(0, JUMLAH_PENGGERAK),
		turunTerdalam: menurutUbah
			.filter((satu) => satu.daily_close_change < 0)
			.reverse()
			.slice(0, JUMLAH_PENGGERAK),
		terbesar: menurutKapitalisasi.slice(0, JUMLAH_PENGGERAK),
		peta: menurutKapitalisasi.slice(0, JUMLAH_PETA)
	};
}

export function squarify<T>(isi: { bobot: number; data: T }[], kotak: Kotak) {
	const total = isi.reduce((jumlah, satu) => jumlah + Math.max(0, satu.bobot), 0);
	const hasil: (Kotak & { data: T })[] = [];
	if (total <= 0 || kotak.w <= 0 || kotak.h <= 0) return hasil;

	const skala = (kotak.w * kotak.h) / total;
	const antre = isi
		.filter((satu) => satu.bobot > 0)
		.sort((a, b) => b.bobot - a.bobot)
		.map((satu) => ({ data: satu.data, luas: satu.bobot * skala }));
	let { x, y, w, h } = kotak;

	const terburuk = (baris: typeof antre, sisi: number) => {
		const jumlah = baris.reduce((total, satu) => total + satu.luas, 0);
		const luas = baris.map((satu) => satu.luas);
		return Math.max(
			(sisi * sisi * Math.max(...luas)) / (jumlah * jumlah),
			(jumlah * jumlah) / (sisi * sisi * Math.min(...luas))
		);
	};

	const tata = (baris: typeof antre) => {
		const jumlah = baris.reduce((total, satu) => total + satu.luas, 0);
		if (w >= h) {
			const lebar = jumlah / h;
			let atas = y;
			for (const satu of baris) {
				hasil.push({ x, y: atas, w: lebar, h: satu.luas / lebar, data: satu.data });
				atas += satu.luas / lebar;
			}
			x += lebar;
			w -= lebar;
		} else {
			const tinggi = jumlah / w;
			let kiri = x;
			for (const satu of baris) {
				hasil.push({ x: kiri, y, w: satu.luas / tinggi, h: tinggi, data: satu.data });
				kiri += satu.luas / tinggi;
			}
			y += tinggi;
			h -= tinggi;
		}
	};

	let baris: typeof antre = [];
	for (const satu of antre) {
		const sisi = Math.min(w, h);
		if (baris.length && terburuk([...baris, satu], sisi) > terburuk(baris, sisi)) {
			tata(baris);
			baris = [];
		}
		baris.push(satu);
	}
	if (baris.length) tata(baris);
	return hasil;
}

export function garisBantu(bawah: number, atas: number, jumlah = 4) {
	const kasar = (atas - bawah || Math.abs(atas) || 1) / jumlah;
	const pangkat = 10 ** Math.floor(Math.log10(kasar));
	const langkah = [1, 2, 2.5, 5, 10]
		.map((kali) => kali * pangkat)
		.reduce((terbaik, calon) =>
			Math.abs(calon - kasar) < Math.abs(terbaik - kasar) ? calon : terbaik
		);
	const hasil: number[] = [];
	for (let nilai = Math.ceil(bawah / langkah) * langkah; nilai <= atas; nilai += langkah) {
		hasil.push(Number(nilai.toPrecision(12)));
	}
	return hasil;
}
