import type { User } from '$lib/api/auth';
import type { Bahasa, Tema } from '$lib/bahasa.svelte';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			bahasa: Bahasa;
			tema: Tema;
			cookieBaru?: Map<string, string>;
		}
	}
}

export {};
