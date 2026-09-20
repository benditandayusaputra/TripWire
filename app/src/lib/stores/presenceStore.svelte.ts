import { apiBaseUrl } from '$lib/api/client';
import type { RingkasanInsight } from '$lib/api/notifications';

const BATAS_ANTREAN = 20;

class PresenceStore {
	terhubung = $state(false);
	insightBaru = $state<RingkasanInsight[]>([]);

	private sumber: EventSource | null = null;

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
		};

		this.sumber = sumber;
	}

	putus() {
		this.sumber?.close();
		this.sumber = null;
		this.terhubung = false;
	}

	bersihkan() {
		this.insightBaru = [];
	}
}

export const presenceStore = new PresenceStore();
