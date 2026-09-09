export type User = {
	id: string;
	email: string;
	email_verified_at: string | null;
	role: string;
	tier: string;
	is_active: boolean;
	totp_enabled: boolean;
	full_name: string;
	locale: string;
	theme_preference: string;
	timezone: string;
	avatar_url?: string;
	last_login_at: string | null;
};
