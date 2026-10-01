import { browser } from '$app/environment';
import { page } from '$app/state';

export type Bahasa = 'id' | 'en';
export type Tema = 'dark' | 'light' | 'system';

export const BAHASA: Bahasa[] = ['id', 'en'];
export const TEMA: Tema[] = ['dark', 'light', 'system'];

const SETAHUN = 60 * 60 * 24 * 365;

function dariCookie(nama: string, daftar: string[]) {
	const nilai = browser ? document.cookie.match(new RegExp(`(?:^|; )${nama}=([^;]*)`))?.[1] : '';
	return nilai && daftar.includes(nilai) ? nilai : null;
}

const pilihan = $state({ bahasa: dariCookie('tw_bahasa', BAHASA) as Bahasa | null });

const temaCookie = dariCookie('tw_tema', TEMA);
if (temaCookie) document.documentElement.dataset.tema = temaCookie;

export function bahasa(): Bahasa {
	if (pilihan.bahasa) return pilihan.bahasa;
	try {
		return (page.data.bahasa as Bahasa | undefined) ?? 'id';
	} catch {
		return 'id';
	}
}

export function teks(kode: Bahasa, id: string, en: string) {
	return kode === 'en' ? en : id;
}

export function t(id: string, en: string) {
	return teks(bahasa(), id, en);
}

export function lokal() {
	return bahasa() === 'en' ? 'en-US' : 'id-ID';
}

function simpan(nama: string, nilai: string) {
	document.cookie = `${nama}=${nilai}; path=/; max-age=${SETAHUN}; samesite=lax`;
}

export function gantiBahasa(kode: Bahasa) {
	pilihan.bahasa = kode;
	document.documentElement.lang = kode;
	simpan('tw_bahasa', kode);
}

export function gantiTema(tema: Tema) {
	document.documentElement.dataset.tema = tema;
	simpan('tw_tema', tema);
}
