import { page } from '$app/state';

export type Bahasa = 'id' | 'en';
export type Tema = 'dark' | 'light' | 'system';

export const BAHASA: Bahasa[] = ['id', 'en'];
export const TEMA: Tema[] = ['dark', 'light', 'system'];

const SETAHUN = 60 * 60 * 24 * 365;

const pilihan = $state<{ bahasa: Bahasa | null }>({ bahasa: null });

export function bahasa(): Bahasa {
	return pilihan.bahasa ?? (page.data.bahasa as Bahasa | undefined) ?? 'id';
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
