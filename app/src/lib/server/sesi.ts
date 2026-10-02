import { getRequestEvent } from '$app/server';

function cookieRequestIni() {
	try {
		return getRequestEvent().locals.cookieBaru;
	} catch {
		return undefined;
	}
}

export function pecahSetCookie(response: Response) {
	const hasil = new Map<string, string>();
	for (const baris of response.headers.getSetCookie()) {
		const pasangan = baris.split(';')[0];
		const pemisah = pasangan.indexOf('=');
		if (pemisah > 0)
			hasil.set(pasangan.slice(0, pemisah).trim(), pasangan.slice(pemisah + 1).trim());
	}
	return hasil;
}

export function gabungCookie(header: string, baru = cookieRequestIni()) {
	if (!baru?.size) return header;
	const peta = new Map<string, string>();
	for (const bagian of header.split(';')) {
		const pemisah = bagian.indexOf('=');
		if (pemisah > 0) peta.set(bagian.slice(0, pemisah).trim(), bagian.slice(pemisah + 1).trim());
	}
	for (const [nama, nilai] of baru) {
		if (nilai) peta.set(nama, nilai);
		else peta.delete(nama);
	}
	return [...peta].map(([nama, nilai]) => `${nama}=${nilai}`).join('; ');
}
