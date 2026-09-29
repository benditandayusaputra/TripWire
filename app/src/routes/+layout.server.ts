import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	bahasa: locals.bahasa,
	tema: locals.tema
});
