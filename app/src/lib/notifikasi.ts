import type { Notifikasi } from '$lib/api/notifications';
import { labelSinyal } from '$lib/insight';
import { tierDariSkor } from '$lib/skor';

export const TIER_URUT = ['critical', 'high', 'moderate', 'low'] as const;

const kunciHari = (waktu: string | Date) =>
	new Date(waktu).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export function labelHari(tanggal: string, sekarang = new Date()): string {
	const hariIni = kunciHari(sekarang);
	const kemarin = kunciHari(new Date(sekarang.getTime() - 86_400_000));
	if (tanggal === hariIni) return 'Hari ini';
	if (tanggal === kemarin) return 'Kemarin';
	return new Date(`${tanggal}T12:00:00+07:00`).toLocaleDateString('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'short',
		timeZone: 'Asia/Jakarta'
	});
}

export function kelompokPerHari(daftar: Notifikasi[], sekarang = new Date()) {
	const kelompok: { tanggal: string; label: string; isi: Notifikasi[] }[] = [];
	for (const item of daftar) {
		const tanggal = kunciHari(item.sent_at);
		const terakhir = kelompok.at(-1);
		if (terakhir?.tanggal === tanggal) terakhir.isi.push(item);
		else kelompok.push({ tanggal, label: labelHari(tanggal, sekarang), isi: [item] });
	}
	return kelompok;
}

export function jamWib(waktu: string): string {
	return new Date(waktu).toLocaleTimeString('id-ID', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Asia/Jakarta'
	});
}

export function judulNotifikasi(item: {
	insight_type?: string;
	subtype?: string;
	score?: number | null;
}): string {
	if (item.insight_type === 'red_flag') {
		return `Risiko tata kelola ${tierDariSkor(item.score).label.toLowerCase()}`;
	}
	if (item.subtype === 'mining_deep_dive') return 'Analisis tambang diperbarui';
	return 'Perbandingan dengan sektor diperbarui';
}

export function penjelasanNotifikasi(item: {
	insight_type?: string;
	subtype?: string;
	signals?: string[];
}): string {
	if (item.insight_type === 'red_flag') {
		const sinyal = (item.signals ?? []).map((kunci) => labelSinyal(kunci).toLowerCase());
		if (sinyal.length > 1) {
			const daftar = `${sinyal.slice(0, -1).join(', ')} dan ${sinyal.at(-1)}`;
			return `${daftar.charAt(0).toUpperCase()}${daftar.slice(1)} muncul berdekatan, bobot skornya ikut naik.`;
		}
		if (sinyal.length === 1) return `Sinyal yang aktif: ${sinyal[0]}.`;
		return 'Gabungan suspensi saham, transaksi orang dalam, dan perubahan pemegang saham.';
	}
	if (item.subtype === 'mining_deep_dive') {
		return 'Produksi, harga komoditas, cadangan, dan izin tambang terbaru.';
	}
	return 'Valuasi dan pertumbuhan perusahaan dibanding rata rata sektornya.';
}

export function selisihSkor(skor?: number | null, sebelumnya?: number | null) {
	if (skor === null || skor === undefined || sebelumnya === null || sebelumnya === undefined) {
		return null;
	}
	const selisih = Math.round(skor) - Math.round(sebelumnya);
	if (selisih === 0)
		return { selisih, teks: 'tetap', label: `tetap dari ${Math.round(sebelumnya)}` };
	return {
		selisih,
		teks: `${selisih > 0 ? '▲' : '▼'} ${Math.abs(selisih)}`,
		label: `${selisih > 0 ? 'naik' : 'turun'} ${Math.abs(selisih)} poin dari ${Math.round(sebelumnya)}`
	};
}

const LAYANAN_PUSH: [RegExp, string][] = [
	[/(^|\.)fcm\.googleapis\.com$/, 'Chrome, Opera, atau Android'],
	[/(^|\.)notify\.windows\.com$/, 'Edge di Windows'],
	[/(^|\.)push\.services\.mozilla\.com$/, 'Firefox'],
	[/(^|\.)push\.apple\.com$/, 'Safari di Mac, iPhone, atau iPad']
];

export function namaPerangkat(endpoint: string): string {
	let host = '';
	try {
		host = new URL(endpoint).hostname;
	} catch {
		return 'Perangkat tidak dikenal';
	}
	return LAYANAN_PUSH.find(([pola]) => pola.test(host))?.[1] ?? host;
}

export function tautanFilter(
	sekarang: URLSearchParams,
	ubah: Record<string, string | null>
): string {
	const hasil = new URLSearchParams(sekarang);
	for (const [kunci, nilai] of Object.entries(ubah)) {
		if (nilai) hasil.set(kunci, nilai);
		else hasil.delete(kunci);
	}
	const teks = hasil.toString();
	return teks ? `?${teks}` : '/notifications';
}
