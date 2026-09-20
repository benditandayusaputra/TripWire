import { execFileSync } from 'node:child_process';
import 'dotenv/config';

const koneksi = {
	host: process.env.DB_POSTGRES_HOST ?? 'localhost',
	port: process.env.DB_POSTGRES_PORT ?? '5432',
	name: process.env.DB_POSTGRES_NAME ?? 'tripwire',
	user: process.env.DB_POSTGRES_USERNAME ?? '',
	password: process.env.DB_POSTGRES_PASSWORD ?? ''
};

export function kueri(sql: string): string {
	const keluaran = execFileSync(
		'psql',
		['-h', koneksi.host, '-p', koneksi.port, '-U', koneksi.user, '-d', koneksi.name, '-tAc', sql],
		{ env: { ...process.env, PGPASSWORD: koneksi.password }, encoding: 'utf8' }
	);

	return keluaran.trim();
}
