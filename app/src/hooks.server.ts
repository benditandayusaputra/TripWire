import { redirect, type Handle } from '@sveltejs/kit';
import { apiBaseUrl } from '$lib/api/client';
import type { User } from '$lib/api/auth';
import { BAHASA, TEMA, type Bahasa, type Tema } from '$lib/bahasa.svelte';

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

function pilih<T extends string>(nilai: string | undefined, daftar: T[]): T {
	return daftar.includes(nilai as T) ? (nilai as T) : daftar[0];
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.bahasa = pilih<Bahasa>(event.cookies.get('tw_bahasa'), BAHASA);
	event.locals.tema = pilih<Tema>(event.cookies.get('tw_tema'), TEMA);

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

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%bahasa%', event.locals.bahasa).replace('%tema%', event.locals.tema)
	});
};
