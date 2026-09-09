
import { build, files, version } from '$service-worker';

const pekerja = self as unknown as ServiceWorkerGlobalScope;

const CACHE_ASET = `tripwire-aset-${version}`;
const CACHE_HALAMAN = `tripwire-halaman-${version}`;
const HALAMAN_OFFLINE = '/offline';

const ASET_PRACACHE = [...build, ...files];

pekerja.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const aset = await caches.open(CACHE_ASET);
			await aset.addAll(ASET_PRACACHE);

			const halaman = await caches.open(CACHE_HALAMAN);
			await halaman.add(HALAMAN_OFFLINE).catch(() => undefined);

			await pekerja.skipWaiting();
		})()
	);
});

pekerja.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const nama of await caches.keys()) {
				if (nama !== CACHE_ASET && nama !== CACHE_HALAMAN) await caches.delete(nama);
			}
			await pekerja.clients.claim();
		})()
	);
});

pekerja.addEventListener('fetch', (event) => {
	const permintaan = event.request;
	if (permintaan.method !== 'GET') return;

	const url = new URL(permintaan.url);
	if (url.origin !== pekerja.location.origin) return;

	if (ASET_PRACACHE.includes(url.pathname)) {
		event.respondWith(layaniDariCache(permintaan));
		return;
	}

	if (permintaan.mode === 'navigate') {
		event.respondWith(layaniNavigasi(permintaan));
	}
});

async function layaniDariCache(permintaan: Request): Promise<Response> {
	const cache = await caches.open(CACHE_ASET);
	const tersimpan = await cache.match(permintaan);
	if (tersimpan) return tersimpan;

	const jaringan = await fetch(permintaan);
	if (jaringan.ok) cache.put(permintaan, jaringan.clone());
	return jaringan;
}

async function layaniNavigasi(permintaan: Request): Promise<Response> {
	const cache = await caches.open(CACHE_HALAMAN);

	try {
		const jaringan = await fetch(permintaan);
		if (jaringan.ok) cache.put(permintaan, jaringan.clone());
		return jaringan;
	} catch {
		const tersimpan = await cache.match(permintaan);
		if (tersimpan) return tersimpan;

		const cadangan = await cache.match(HALAMAN_OFFLINE);
		if (cadangan) return cadangan;

		return new Response('Sedang offline dan halaman ini belum tersimpan.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

pekerja.addEventListener('push', (event) => {
	if (!event.data) return;

	let isi: { title?: string; body?: string; url?: string; tag?: string } = {};
	try {
		isi = event.data.json();
	} catch {
		isi = { body: event.data.text() };
	}

	event.waitUntil(
		pekerja.registration.showNotification(isi.title ?? 'TripWire', {
			body: isi.body ?? 'Ada insight baru di watchlist kamu.',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: isi.tag ?? 'tripwire-insight',
			data: { url: isi.url ?? '/notifications' }
		})
	);
});

pekerja.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const tujuan = (event.notification.data?.url as string) ?? '/notifications';

	event.waitUntil(
		(async () => {
			const klien = await pekerja.clients.matchAll({ type: 'window', includeUncontrolled: true });

			for (const satu of klien) {
				if (satu.url.includes(tujuan)) return satu.focus();
			}

			return pekerja.clients.openWindow(tujuan);
		})()
	);
});
