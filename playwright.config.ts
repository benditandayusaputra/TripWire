import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const apiPort = process.env.APP_PORT ?? '8080';
const apiURL = `http://127.0.0.1:${apiPort}`;
const appURL = 'http://127.0.0.1:5173';

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
			command: 'go run ./cmd/api',
			cwd: 'api',
			env: { REGISTER_RATE_LIMIT: '500' },
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
