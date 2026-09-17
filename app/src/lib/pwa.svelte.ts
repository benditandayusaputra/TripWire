import { berlanggananPush, kunciPublikPush } from '$lib/api/notifications';

function base64UrlKeBytes(nilai: string): Uint8Array<ArrayBuffer> {
	const padded = nilai.padEnd(nilai.length + ((4 - (nilai.length % 4)) % 4), '=');
	const mentah = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));

	const bytes = new Uint8Array(new ArrayBuffer(mentah.length));
	for (let i = 0; i < mentah.length; i += 1) bytes[i] = mentah.charCodeAt(i);

	return bytes;
}

function bytesKeBase64Url(buffer: ArrayBuffer | null): string {
	if (!buffer) return '';

	const bytes = new Uint8Array(buffer);
	let biner = '';
	for (const byte of bytes) biner += String.fromCharCode(byte);

	return btoa(biner).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class PushStore {
	didukung = $state(false);
	izin = $state<NotificationPermission>('default');
	berlangganan = $state(false);
	sibuk = $state(false);
	pesan = $state('');

	async periksa() {
		this.didukung =
			typeof navigator !== 'undefined' &&
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			'Notification' in window;

		if (!this.didukung) return;

		this.izin = Notification.permission;

		const registrasi = await navigator.serviceWorker.getRegistration();
		const langganan = await registrasi?.pushManager.getSubscription();
		this.berlangganan = Boolean(langganan);
	}

	async aktifkan() {
		if (!this.didukung || this.sibuk) return;

		this.sibuk = true;
		this.pesan = '';

		try {
			this.izin = await Notification.requestPermission();
			if (this.izin !== 'granted') {
				this.pesan = 'Izin notifikasi ditolak browser.';
				return;
			}

			const { public_key, enabled } = await kunciPublikPush();
			if (!enabled || !public_key) {
				this.pesan = 'Web push belum dikonfigurasi di server ini.';
				return;
			}

			const registrasi = await navigator.serviceWorker.ready;
			const langganan = await registrasi.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: base64UrlKeBytes(public_key)
			});

			await berlanggananPush({
				endpoint: langganan.endpoint,
				p256dh: bytesKeBase64Url(langganan.getKey('p256dh')),
				auth: bytesKeBase64Url(langganan.getKey('auth'))
			});

			this.berlangganan = true;
			this.pesan = 'Notifikasi push aktif di perangkat ini.';
		} catch (galat) {
			this.pesan = galat instanceof Error ? galat.message : 'Gagal mengaktifkan notifikasi push.';
		} finally {
			this.sibuk = false;
		}
	}
}

export const pushStore = new PushStore();
