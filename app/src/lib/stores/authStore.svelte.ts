import type { User } from '$lib/api/auth';

class AuthStore {
	user = $state<User | null>(null);

	get isAuthenticated() {
		return this.user !== null;
	}

	get isAdmin() {
		return this.user?.role === 'admin';
	}

	set(user: User | null) {
		this.user = user;
	}

	clear() {
		this.user = null;
	}
}

export const authStore = new AuthStore();
