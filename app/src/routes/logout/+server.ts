import { redirect } from '@sveltejs/kit';
import { panggilApi, teruskanCookie } from '$lib/server/api';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const csrf = cookies.get('tw_csrf') ?? '';

	const { response } = await panggilApi(
		'/auth/logout',
		{ method: 'POST', headers: { 'X-CSRF-Token': csrf } },
		request.headers.get('cookie') ?? ''
	);

	teruskanCookie(response, cookies);

	for (const nama of ['tw_access', 'tw_refresh', 'tw_csrf']) {
		cookies.delete(nama, { path: '/' });
	}

	redirect(303, '/login');
};
