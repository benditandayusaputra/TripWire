import { execFileSync } from 'node:child_process';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = `http://127.0.0.1:${process.env.APP_PORT ?? '8080'}`;
const REDIS_DB_TEST = '1';

export function jawabanCaptcha(id: string) {
	return execFileSync('redis-cli', ['-n', REDIS_DB_TEST, 'GET', `captcha:${id}`], { encoding: 'utf8' }).trim();
}

export async function captchaBaru(request: APIRequestContext) {
	const response = await request.post(`${API_URL}/auth/captcha`);
	expect(response.status()).toBe(201);
	const { captcha_id } = (await response.json()) as { captcha_id: string };
	return { captcha_id, captcha_answer: jawabanCaptcha(captcha_id) };
}

export async function denganCaptcha<T extends object>(request: APIRequestContext, data: T) {
	return { ...data, ...(await captchaBaru(request)) };
}

export async function isiCaptcha(page: Page) {
	let jawaban = '';
	await expect
		.poll(async () => {
			const id = await page.locator('input[name="captcha_id"]').inputValue();
			jawaban = id ? jawabanCaptcha(id) : '';
			return jawaban;
		})
		.toMatch(/^\d{6}$/);
	await page.getByLabel('Kode captcha').fill(jawaban);
}
