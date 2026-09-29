import { panggilApi } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, request, depends }) => {
	depends('tripwire:notifikasi');

	const { payload } = await panggilApi(
		'/notifications?limit=1',
		{},
		request.headers.get('cookie') ?? ''
	).catch(() => ({ payload: null }));

	return { user: locals.user, unread: (payload?.unread ?? 0) as number };
};
