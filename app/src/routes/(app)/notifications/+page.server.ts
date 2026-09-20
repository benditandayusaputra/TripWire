import { panggilApi } from '$lib/server/api';
import type { Notifikasi } from '$lib/api/notifications';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const cookie = request.headers.get('cookie') ?? '';
	const { payload } = await panggilApi('/notifications', {}, cookie);

	return {
		notifications: (payload?.notifications ?? []) as Notifikasi[],
		unread: (payload?.unread ?? 0) as number
	};
};
