import { lokal, t } from '$lib/bahasa.svelte';
import type { Kutipan } from '$lib/watchlist';

export type Pejabat = { name: string; position: string };

export type SahamPejabat = Pejabat & { share_amount: number | null; percentage: number | null };

export type PemegangSaham = {
	name: string;
	share_amount: number | null;
	share_value: number | null;
	percentage: number;
};

export type PelakuInstitusi = { name: string; change_amount: number };

export type Komposisi = {
	date: string;
	shares_outstanding: number | null;
	shareholders: number | null;
	shareholders_change: number | null;
	local: number;
	foreign: number;
	categories: { key: string; local: number; foreign: number }[];
};

export type ProfilEmiten = {
	ticker: string;
	company_name: string;
	quote: Kutipan | null;
	company: {
		listing_board?: string;
		listing_date?: string;
		sector?: string;
		sub_sector?: string;
		industry?: string;
		sub_industry?: string;
		address?: string;
		website?: string;
		phone?: string;
		email?: string;
		employees: number | null;
	};
	executives: Pejabat[];
	executive_holdings: SahamPejabat[];
	shareholders: PemegangSaham[];
	whale_investors: string[];
	conglomerates: string[];
	affiliates: string[];
	institutional: {
		date?: string;
		top_buyers: PelakuInstitusi[];
		top_sellers: PelakuInstitusi[];
		flow: { date: string; net_transaction: number }[];
	};
	composition: Komposisi | null;
};

export type Dewan = 'direksi' | 'komisaris' | 'lain';

const JABATAN: Record<string, string> = {
	'president director': 'Direktur Utama',
	'vice president director': 'Wakil Direktur Utama',
	director: 'Direktur',
	'independent director': 'Direktur Independen',
	'president commissioner': 'Komisaris Utama',
	'vice president commissioner': 'Wakil Komisaris Utama',
	commissioner: 'Komisaris',
	'independent commissioner': 'Komisaris Independen'
};

const KATEGORI: Record<string, [string, string]> = {
	individual: ['Perorangan', 'Individuals'],
	mutual_fund: ['Reksa dana', 'Mutual funds'],
	pension_fund: ['Dana pensiun', 'Pension funds'],
	insurance: ['Asuransi', 'Insurance'],
	corporate: ['Korporasi', 'Corporates'],
	financial_institutions: ['Lembaga keuangan', 'Financial institutions'],
	securities_companies: ['Perusahaan efek', 'Securities firms'],
	foundation: ['Yayasan', 'Foundations'],
	other: ['Lainnya', 'Others']
};

const PAPAN: Record<string, string> = {
	main: 'Utama',
	development: 'Pengembangan',
	acceleration: 'Akselerasi',
	'new economy': 'Ekonomi Baru',
	watchlist: 'Pemantauan Khusus'
};

export function dewan(posisi: string): Dewan {
	const teks = posisi.toLowerCase();
	if (/commissioner|komisaris/.test(teks)) return 'komisaris';
	if (/director|direktur|chief|ceo|cfo|coo/.test(teks)) return 'direksi';
	return 'lain';
}

export function pimpinan(posisi: string) {
	const teks = posisi.toLowerCase();
	return /president|utama/.test(teks) && !/vice|wakil/.test(teks);
}

export function labelJabatan(posisi: string) {
	return t(JABATAN[posisi.trim().toLowerCase()] ?? posisi, posisi);
}

export function labelKategori(kunci: string) {
	const [id, en] = KATEGORI[kunci] ?? [kunci, kunci];
	return t(id, en);
}

export function labelPapan(papan: string) {
	return t(PAPAN[papan.trim().toLowerCase()] ?? papan, papan);
}

export const publik = (nama: string) => nama.trim().toLowerCase() === 'public';

export const namaPemegang = (nama: string) => (publik(nama) ? t('Masyarakat', 'Public') : nama);

export function inisial(nama: string) {
	return nama
		.split(/\s+/)
		.filter((bagian) => /^[\p{L}]/u.test(bagian))
		.slice(0, 2)
		.map((bagian) => bagian[0].toUpperCase())
		.join('');
}

export function formatPersen(nilai: number | null | undefined) {
	if (nilai === null || nilai === undefined) return '-';
	const opsi = nilai >= 1 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 2 };
	return `${new Intl.NumberFormat(lokal(), opsi).format(nilai)}%`;
}

export function formatJumlah(nilai: number | null | undefined, bertanda = false) {
	if (nilai === null || nilai === undefined) return '-';
	const angka = new Intl.NumberFormat(lokal(), {
		notation: 'compact',
		maximumFractionDigits: 1,
		signDisplay: bertanda ? 'exceptZero' : 'auto'
	}).format(nilai);
	return `${angka} ${t('lembar', 'shares')}`;
}

export function tanggalPanjang(tanggal: string) {
	return new Date(`${tanggal.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lokal(), {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function bulanTahun(tanggal: string, bulan: 'long' | 'short' = 'long') {
	return new Date(`${tanggal.slice(0, 10)}T00:00:00Z`).toLocaleDateString(lokal(), {
		month: bulan,
		year: bulan === 'long' ? 'numeric' : '2-digit',
		timeZone: 'UTC'
	});
}
