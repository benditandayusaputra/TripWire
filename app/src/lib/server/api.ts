import type { Cookies } from '@sveltejs/kit';
import { apiBaseUrl } from '$lib/api/client';

type HasilApi = {
	response: Response;
	payload: Record<string, any> | null;
};

export async function panggilApi(
	path: string,
	init: RequestInit = {},
	cookieHeader = ''
): Promise<HasilApi> {
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	if (cookieHeader) headers.set('cookie', cookieHeader);

	const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
	const payload = response.status === 204 ? null : await response.json().catch(() => null);

	return { response, payload };
}

export function teruskanCookie(response: Response, cookies: Cookies) {
	for (const baris of response.headers.getSetCookie()) {
		const bagian = baris.split(';');
		const pemisah = bagian[0].indexOf('=');
		if (pemisah < 0) continue;

		const nama = bagian[0].slice(0, pemisah).trim();
		const nilai = bagian[0].slice(pemisah + 1).trim();

		const opsi: Parameters<Cookies['set']>[2] = { path: '/', httpOnly: false, secure: false };
		for (const atribut of bagian.slice(1)) {
			const [kunci, isi = ''] = atribut.split('=');
			const kunciBersih = kunci.trim().toLowerCase();

			if (kunciBersih === 'httponly') opsi.httpOnly = true;
			else if (kunciBersih === 'secure') opsi.secure = true;
			else if (kunciBersih === 'partitioned') opsi.partitioned = true;
			else if (kunciBersih === 'path') opsi.path = isi.trim();
			else if (kunciBersih === 'domain') opsi.domain = isi.trim();
			else if (kunciBersih === 'samesite')
				opsi.sameSite = isi.trim().toLowerCase() as 'strict' | 'lax' | 'none';
			else if (kunciBersih === 'max-age') opsi.maxAge = Number(isi.trim());
			else if (kunciBersih === 'expires') opsi.expires = new Date(isi.trim());
		}

		if (nilai === '') cookies.delete(nama, { path: opsi.path });
		else cookies.set(nama, nilai, opsi);
	}
}

export function pesanGalat(payload: Record<string, any> | null, bawaan: string) {
	return typeof payload?.error === 'string' ? payload.error : bawaan;
}
