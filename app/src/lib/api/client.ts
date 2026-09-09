import { env } from '$env/dynamic/public';

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public body?: unknown
	) {
		super(message);
		this.name = 'HttpError';
	}
}

const baseUrl = env.PUBLIC_API_URL ?? 'http://localhost:8080';

export async function request<T>(
	path: string,
	init: RequestInit = {},
	fetcher: typeof fetch = fetch
): Promise<T> {
	const response = await fetcher(`${baseUrl}${path}`, {
		credentials: 'include',
		...init,
		headers: {
			Accept: 'application/json',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers
		}
	});

	const payload = response.status === 204 ? null : await response.json().catch(() => null);

	if (!response.ok) {
		throw new HttpError(response.status, `Permintaan ke ${path} gagal`, payload);
	}

	return payload as T;
}
