import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

const HEADER_MASUK = ['accept', 'content-type', 'cookie', 'x-csrf-token', 'last-event-id'];
const HEADER_BUANG = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

const teruskan: RequestHandler = async ({ request, params, url }) => {
	const headers = new Headers();
	for (const nama of HEADER_MASUK) {
		const isi = request.headers.get(nama);
		if (isi) headers.set(nama, isi);
	}

	const tanpaBody = request.method === 'GET' || request.method === 'HEAD';
	const response = await fetch(
		`${env.PUBLIC_API_URL ?? 'http://127.0.0.1:8080'}/${params.path}${url.search}`,
		{
			method: request.method,
			headers,
			body: tanpaBody ? undefined : await request.arrayBuffer(),
			signal: request.signal
		}
	);

	const keluar = new Headers(response.headers);
	for (const nama of HEADER_BUANG) keluar.delete(nama);

	return new Response(response.body, { status: response.status, headers: keluar });
};

export const GET = teruskan;
export const POST = teruskan;
export const PUT = teruskan;
export const PATCH = teruskan;
export const DELETE = teruskan;
