import { apiBaseUrl } from '$lib/api/client';
import type { RingkasanInsight } from '$lib/api/notifications';

const BATAS_ANTREAN = 20;
const JEDA_SAMBUNG_ULANG = 3000;
const BATAS_PULIH = 3;

class PresenceStore {
	terhubung = $state(false);
	insightBaru = $state<RingkasanInsight[]>([]);

	private sumber: EventSource | null = null;
	private jedaUlang: ReturnType<typeof setTimeout> | undefined;
	private percobaanPulih = 0;

	get jumlahBaru() {
		return this.insightBaru.length;
	}

	sambung() {
		if (this.sumber || typeof window === 'undefined') return;

		const sumber = new EventSource(`${apiBaseUrl}/stream`, { withCredentials: true });

		sumber.onmessage = (pesan) => {
			let event: { type?: string; data?: unknown };
			try {
				event = JSON.parse(pesan.data);
			} catch {
				return;
			}

			if (event.type === 'presence') {
				this.terhubung = true;
				this.percobaanPulih = 0;
				return;
			}

			if (event.type === 'insight' && event.data) {
				this.terhubung = true;
				this.insightBaru = [event.data as RingkasanInsight, ...this.insightBaru].slice(
					0,
					BATAS_ANTREAN
				);
			}
		};

		sumber.onerror = () => {
			this.terhubung = false;
			if (sumber.readyState !== EventSource.CLOSED || this.sumber !== sumber) return;
			if (this.percobaanPulih >= BATAS_PULIH) return;
			this.percobaanPulih += 1;
			this.sumber = null;
			this.jedaUlang = setTimeout(() => this.pulihkan(), JEDA_SAMBUNG_ULANG);
		};

		this.sumber = sumber;
	}

	private async pulihkan() {
		const segar = await fetch(`${apiBaseUrl}/auth/refresh`, {
			method: 'POST',
			credentials: 'include',
			headers: { Accept: 'application/json' }
		}).catch(() => null);
		if (segar?.ok) this.sambung();
	}

	putus() {
		clearTimeout(this.jedaUlang);
		this.sumber?.close();
		this.sumber = null;
		this.terhubung = false;
	}

	bersihkan() {
		this.insightBaru = [];
	}
}

export const presenceStore = new PresenceStore();
