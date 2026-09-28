export type Lilin = {
	buka: number;
	tinggi: number;
	rendah: number;
	tutup: number;
	volume: number;
};

export type JenisKejadian = 'awal' | 'orang-dalam' | 'kepemilikan' | 'notifikasi' | 'anjlok' | 'suspensi' | 'buka';

export type Kejadian = { hari: number; jenis: JenisKejadian; teks: string };

export const TICKER = 'SIMU';
export const BATAS = 86;
export const HARI_NOTIFIKASI = 30;
export const HARI_ANJLOK = 34;
export const SUSPENSI = { mulai: 35, selesai: 38 };
export const JUMLAH_HARI = 44;

const JANGKAR: [number, number][] = [
	[0, 1180],
	[12, 1240],
	[19, 1265],
	[25, 1300],
	[33, 1340]
];

const SETELAH_KABAR: Record<number, number> = { 34: 1045, 39: 905, 40: 830, 41: 790, 42: 815, 43: 780 };
const BUKA_KHUSUS: Record<number, number> = { 34: 1320, 39: 1000 };
const LONJAKAN_VOLUME: Record<number, number> = { 12: 1.9, 19: 2.3, 25: 1.8, 30: 1.6, 34: 6.5, 39: 4.2, 40: 3 };

function acak(benih: number) {
	return () => (benih = (benih * 16807) % 2147483647) / 2147483647;
}

const fraksi = (harga: number) => Math.round(harga / 5) * 5;

function hariBursa(jumlah: number) {
	const hasil: Date[] = [];
	const hari = new Date(Date.UTC(2026, 5, 1));
	while (hasil.length < jumlah) {
		if (hari.getUTCDay() % 6 !== 0) hasil.push(new Date(hari));
		hari.setUTCDate(hari.getUTCDate() + 1);
	}
	return hasil;
}

function tutupAcuan(hari: number, acakan: () => number) {
	if (hari in SETELAH_KABAR) return SETELAH_KABAR[hari];
	const ke = JANGKAR.findIndex(([h]) => h >= hari);
	const [h1, p1] = JANGKAR[ke];
	if (h1 === hari) return p1;
	const [h0, p0] = JANGKAR[ke - 1];
	return p0 + ((p1 - p0) * (hari - h0)) / (h1 - h0) + (acakan() - 0.5) * 34;
}

export const tanggal = hariBursa(JUMLAH_HARI);

export const lilin: (Lilin | null)[] = (() => {
	const acakan = acak(11);
	let tutupKemarin = 1175;
	return tanggal.map((_, hari) => {
		if (hari >= SUSPENSI.mulai && hari <= SUSPENSI.selesai) return null;
		const tutup = fraksi(tutupAcuan(hari, acakan));
		const buka = BUKA_KHUSUS[hari] ?? fraksi(tutupKemarin + (acakan() - 0.5) * 18);
		const tinggi = fraksi(Math.max(buka, tutup) + 3 + acakan() * 12);
		const rendah = hari === HARI_ANJLOK ? tutup : fraksi(Math.min(buka, tutup) - 3 - acakan() * 12);
		const volume = Math.round((18 + acakan() * 14) * (LONJAKAN_VOLUME[hari] ?? 1)) * 1000;
		tutupKemarin = tutup;
		return { buka, tinggi, rendah, tutup, volume };
	});
})();

export const langkahSkor: [number, number][] = [
	[0, 6],
	[12, 22],
	[19, 54],
	[25, 75],
	[HARI_NOTIFIKASI, 91],
	[SUSPENSI.mulai, 100]
];

export function skorPada(hari: number) {
	return langkahSkor.findLast(([mulai]) => hari >= mulai)?.[1] ?? 0;
}

export const kejadian: Kejadian[] = [
	{ hari: 0, jenis: 'awal', teks: 'Harga naik pelan. Skor masih 6 dari suspensi rutin dua tahun lalu.' },
	{ hari: 12, jenis: 'orang-dalam', teks: 'Dua orang dalam menjual saham dalam 30 hari. Skor naik ke 22.' },
	{
		hari: 19,
		jenis: 'kepemilikan',
		teks: 'Pemegang saham besar melepas 6,5 poin kepemilikan. Dua sinyal berdekatan, skor dikali 1,3.'
	},
	{ hari: 25, jenis: 'orang-dalam', teks: 'Orang dalam yang menjual bertambah jadi empat. Skor 75, Tinggi.' },
	{
		hari: HARI_NOTIFIKASI,
		jenis: 'notifikasi',
		teks: 'Skor 91 melewati batas 86. Notifikasi terkirim, harga masih terlihat baik baik saja.'
	},
	{ hari: HARI_ANJLOK, jenis: 'anjlok', teks: 'SIMU mengumumkan gagal bayar. Harga turun 22% dalam sehari.' },
	{ hari: SUSPENSI.mulai, jenis: 'suspensi', teks: 'Bursa menghentikan sementara perdagangan SIMU selama empat hari.' },
	{
		hari: 39,
		jenis: 'buka',
		teks: 'Dibuka lagi, harga terus turun sampai 42% di bawah puncak. Kamu sudah dikabari 4 hari bursa sebelum kabar itu.'
	}
];

export function kejadianPada(hari: number) {
	return kejadian.findLast((item) => hari >= item.hari) ?? kejadian[0];
}

export const subSkor = [
	{ kunci: 'orang-dalam', nama: 'Transaksi orang dalam', bobot: 0.4, nilai: 100 },
	{ kunci: 'kepemilikan', nama: 'Perubahan kepemilikan', bobot: 0.3, nilai: 80 },
	{ kunci: 'suspensi', nama: 'Riwayat suspensi', bobot: 0.3, nilai: 20 }
] as const;

export const PENGALI_POLA_SILANG = 1.3;
