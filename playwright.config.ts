import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const apiPort = process.env.APP_PORT ?? '8080';
const apiURL = `http://127.0.0.1:${apiPort}`;
const appURL = 'http://127.0.0.1:5173';
const stubPort = process.env.SECTORS_STUB_PORT ?? '8899';
const stubURL = `http://127.0.0.1:${stubPort}`;

export default defineConfig({
	testDir: './tests',
	testIgnore: '**/helpers/**',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: appURL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'api',
			testMatch: /.*\.api\.spec\.ts/,
			use: { baseURL: apiURL }
		},
		{
			name: 'browser',
			testMatch: /.*\.browser\.spec\.ts/,
			use: { baseURL: appURL }
		}
	],
	webServer: [
		{
			command: 'node tests/stub/sectors.mjs',
			url: `${stubURL}/__stub/stats`,
			reuseExistingServer: !process.env.CI,
			timeout: 30_000
		},
		{
			command: 'go run ./cmd/api',
			cwd: 'api',
			env: {
				REGISTER_RATE_LIMIT: '500',
				REDIS_URL: 'redis://127.0.0.1:6379/1',
				SECTORS_API_BASE_URL: stubURL,
				SECTORS_API_KEY: 'kunci-stub-untuk-test',
				SECTORS_CACHE_TTL: '2s',
				SECTORS_FAILURE_LIMIT: '3',
				SECTORS_CIRCUIT_COOLDOWN: '5s'
			},
			url: `${apiURL}/health`,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		},
		{
			command: 'npm run dev',
			cwd: 'app',
			url: appURL,
			reuseExistingServer: !process.env.CI,
			timeout: 120_000
		}
	]
});
