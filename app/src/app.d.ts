import type { User } from '$lib/api/auth';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
		}
	}
}

export {};
