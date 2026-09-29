import type { Notifikasi } from '$lib/api/notifications';
import { lokal, t } from '$lib/bahasa.svelte';
import { labelSinyal } from '$lib/insight';
import { tierDariSkor } from '$lib/skor';

export const TIER_URUT = ['critical', 'high', 'moderate', 'low'] as const;

const kunciHari = (waktu: string | Date) =>
	new Date(waktu).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export function labelHari(tanggal: string, sekarang = new Date()): string {
	const hariIni = kunciHari(sekarang);
	const kemarin = kunciHari(new Date(sekarang.getTime() - 86_400_000));
	if (tanggal === hariIni) return t('Hari ini', 'Today');
	if (tanggal === kemarin) return t('Kemarin', 'Yesterday');
	return new Date(`${tanggal}T12:00:00+07:00`).toLocaleDateString(lokal(), {
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
	return new Date(waktu).toLocaleTimeString(lokal(), {
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
		const tier = tierDariSkor(item.score).label;
		return t(`Risiko tata kelola ${tier.toLowerCase()}`, `${tier} governance risk`);
	}
	if (item.subtype === 'mining_deep_dive') {
		return t('Analisis tambang diperbarui', 'Mining analysis updated');
	}
	return t('Perbandingan dengan sektor diperbarui', 'Sector comparison updated');
}

export function penjelasanNotifikasi(item: {
	insight_type?: string;
	subtype?: string;
	signals?: string[];
}): string {
	if (item.insight_type === 'red_flag') {
		const sinyal = (item.signals ?? []).map((kunci) => labelSinyal(kunci).toLowerCase());
		if (sinyal.length > 1) {
			const daftar = `${sinyal.slice(0, -1).join(', ')} ${t('dan', 'and')} ${sinyal.at(-1)}`;
			const awal = `${daftar.charAt(0).toUpperCase()}${daftar.slice(1)}`;
			return t(
				`${awal} muncul berdekatan, bobot skornya ikut naik.`,
				`${awal} showed up close together, so they weigh more in the score.`
			);
		}
		if (sinyal.length === 1)
			return t(`Sinyal yang aktif: ${sinyal[0]}.`, `Active signal: ${sinyal[0]}.`);
		return t(
			'Gabungan suspensi saham, transaksi orang dalam, dan perubahan pemegang saham.',
			'A mix of trading suspensions, insider transactions, and shareholder changes.'
		);
	}
	if (item.subtype === 'mining_deep_dive') {
		return t(
			'Produksi, harga komoditas, cadangan, dan izin tambang terbaru.',
			'Latest production, commodity prices, reserves, and mining permits.'
		);
	}
	return t(
		'Valuasi dan pertumbuhan perusahaan dibanding rata rata sektornya.',
		"The company's valuation and growth compared with its sector average."
	);
}

export function selisihSkor(skor?: number | null, sebelumnya?: number | null) {
	if (skor === null || skor === undefined || sebelumnya === null || sebelumnya === undefined) {
		return null;
	}
	const selisih = Math.round(skor) - Math.round(sebelumnya);
	const awal = Math.round(sebelumnya);
	if (selisih === 0) {
		return {
			selisih,
			teks: t('tetap', 'steady'),
			label: t(`tetap dari ${awal}`, `unchanged from ${awal}`)
		};
	}
	const jarak = Math.abs(selisih);
	return {
		selisih,
		teks: `${selisih > 0 ? '▲' : '▼'} ${jarak}`,
		label: t(
			`${selisih > 0 ? 'naik' : 'turun'} ${jarak} poin dari ${awal}`,
			`${selisih > 0 ? 'up' : 'down'} ${jarak} ${jarak === 1 ? 'point' : 'points'} from ${awal}`
		)
	};
}

const LAYANAN_PUSH: [RegExp, string, string][] = [
	[/(^|\.)fcm\.googleapis\.com$/, 'Chrome, Opera, atau Android', 'Chrome, Opera, or Android'],
	[/(^|\.)notify\.windows\.com$/, 'Edge di Windows', 'Edge on Windows'],
	[/(^|\.)push\.services\.mozilla\.com$/, 'Firefox', 'Firefox'],
	[/(^|\.)push\.apple\.com$/, 'Safari di Mac, iPhone, atau iPad', 'Safari on Mac, iPhone, or iPad']
];

export function namaPerangkat(endpoint: string): string {
	let host = '';
	try {
		host = new URL(endpoint).hostname;
	} catch {
		return t('Perangkat tidak dikenal', 'Unknown device');
	}
	const layanan = LAYANAN_PUSH.find(([pola]) => pola.test(host));
	return layanan ? t(layanan[1], layanan[2]) : host;
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
