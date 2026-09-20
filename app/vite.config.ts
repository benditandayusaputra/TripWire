import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

type SumberCSP = NonNullable<
	NonNullable<Parameters<typeof sveltekit>[0]>['csp']
>['directives'] extends infer D
	? D extends Record<string, (infer S)[] | undefined>
		? S
		: never
	: never;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '..', '');
	const apiOrigin = new URL(env.PUBLIC_API_URL ?? 'http://127.0.0.1:8080').origin as SumberCSP;
	const pengembangan = mode !== 'production';

	const sumberDev: SumberCSP[] = pengembangan
		? (['ws:', 'http://localhost:*', 'http://127.0.0.1:*'] as SumberCSP[])
		: [];

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter(),
				csp: {
					mode: 'auto',
					directives: {
						'default-src': ['self'],
						'script-src': ['self'],
						'style-src': ['self', 'unsafe-inline'],
						'img-src': ['self', 'data:', 'blob:', apiOrigin],
						'font-src': ['self', 'data:'],
						'connect-src': ['self', apiOrigin, ...sumberDev],
						'worker-src': ['self'],
						'manifest-src': ['self'],
						'base-uri': ['self'],
						'object-src': ['none'],
						'frame-ancestors': ['none'],
						'form-action': ['self']
					}
				}
			})
		],
		envDir: '..',
		server: {
			port: 5173,
			strictPort: true
		}
	};
});
