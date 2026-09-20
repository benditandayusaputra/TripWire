import { redirect, type Handle } from '@sveltejs/kit';
import { apiBaseUrl } from '$lib/api/client';
import type { User } from '$lib/api/auth';

const PROTECTED_GROUPS = ['/(app)', '/(admin)'];

async function currentUser(cookie: string): Promise<User | null> {
	if (!cookie.includes('tw_access=')) return null;

	try {
		const response = await fetch(`${apiBaseUrl}/account/me`, {
			headers: { cookie, Accept: 'application/json' }
		});
		if (!response.ok) return null;

		const payload = (await response.json()) as { user: User };
		return payload.user;
	} catch {
		return null;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id ?? '';
	const guarded = PROTECTED_GROUPS.some((group) => routeId.startsWith(group));

	if (guarded) {
		event.locals.user = await currentUser(event.request.headers.get('cookie') ?? '');

		if (!event.locals.user) {
			redirect(303, `/login?next=${encodeURIComponent(event.url.pathname)}`);
		}

		if (routeId.startsWith('/(admin)') && event.locals.user.role !== 'admin') {
			redirect(303, '/dashboard');
		}
	}

	return resolve(event);
};
