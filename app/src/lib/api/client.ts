import { env } from '$env/dynamic/public';

export class HttpError extends Error {
	constructor(
		public status: number,
		message: string,
		public body: Record<string, unknown> | null = null
	) {
		super(message);
		this.name = 'HttpError';
	}

	get fields(): Record<string, string> {
		const fields = this.body?.fields;
		return typeof fields === 'object' && fields !== null ? (fields as Record<string, string>) : {};
	}
}

export const apiBaseUrl = env.PUBLIC_API_URL ?? 'http://127.0.0.1:8080';

const CSRF_COOKIE = 'tw_csrf';

function csrfToken(): string {
	if (typeof document === 'undefined') return '';
	const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : '';
}

async function send(path: string, init: RequestInit, fetcher: typeof fetch): Promise<Response> {
	const method = (init.method ?? 'GET').toUpperCase();
	const headers = new Headers(init.headers);
	headers.set('Accept', 'application/json');
	if (init.body) headers.set('Content-Type', 'application/json');
	if (method !== 'GET' && method !== 'HEAD') {
		const token = csrfToken();
		if (token) headers.set('X-CSRF-Token', token);
	}

	return fetcher(`${apiBaseUrl}${path}`, {
		credentials: 'include',
		...init,
		headers
	});
}

export async function request<T>(
	path: string,
	init: RequestInit = {},
	fetcher: typeof fetch = fetch
): Promise<T> {
	let response = await send(path, init, fetcher);

	if (response.status === 401 && path !== '/auth/refresh' && !path.startsWith('/auth/login')) {
		const refreshed = await send('/auth/refresh', { method: 'POST' }, fetcher);
		if (refreshed.ok) {
			response = await send(path, init, fetcher);
		}
	}

	const payload = response.status === 204 ? null : await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			(payload && typeof payload.error === 'string' && payload.error) ||
			`Permintaan ke ${path} gagal`;
		throw new HttpError(response.status, message, payload);
	}

	return payload as T;
}
