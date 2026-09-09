import type { APIRequestContext, APIResponse } from '@playwright/test';

export const API_URL = `http://127.0.0.1:${process.env.APP_PORT ?? '8080'}`;

export function akunBaru(prefix: string) {
	const unik = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
	return {
		email: `${unik}@tripwire.test`,
		password: 'RahasiaKuat123',
		fullName: 'Penguji TripWire'
	};
}

export async function daftarLewatApi(request: APIRequestContext, akun: ReturnType<typeof akunBaru>) {
	const response = await request.post(`${API_URL}/auth/register`, {
		data: { email: akun.email, password: akun.password, full_name: akun.fullName }
	});

	if (!response.ok()) {
		throw new Error(`Registrasi gagal: ${response.status()} ${await response.text()}`);
	}

	return response.json() as Promise<{ verification_token: string; user: { id: string } }>;
}

export class SesiApi {
	private jar = new Map<string, string>();

	constructor(private request: APIRequestContext) {}

	cookie(name: string) {
		return this.jar.get(name) ?? '';
	}

	get header() {
		return [...this.jar].map(([nama, nilai]) => `${nama}=${nilai}`).join('; ');
	}

	async kirim(
		method: 'get' | 'post',
		path: string,
		options: { data?: unknown; headers?: Record<string, string> } = {}
	): Promise<APIResponse> {
		const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
		if (this.jar.size > 0) headers.Cookie = this.header;

		const response =
			method === 'get'
				? await this.request.get(`${API_URL}${path}`, { headers })
				: await this.request.post(`${API_URL}${path}`, { headers, data: options.data });

		this.serap(response);
		return response;
	}

	private serap(response: APIResponse) {
		for (const header of response.headersArray()) {
			if (header.name.toLowerCase() !== 'set-cookie') continue;

			for (const baris of header.value.split('\n')) {
				const pasangan = baris.split(';')[0];
				const pemisah = pasangan.indexOf('=');
				if (pemisah < 0) continue;

				const nama = pasangan.slice(0, pemisah).trim();
				const nilai = pasangan.slice(pemisah + 1).trim();

				if (nilai === '') this.jar.delete(nama);
				else this.jar.set(nama, nilai);
			}
		}
	}
}
