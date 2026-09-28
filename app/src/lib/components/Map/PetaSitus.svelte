<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import { labelKomoditas, type SitusTambang } from '$lib/insight';
	import { warnaKomoditas } from './warna';

	let { situs }: { situs: SitusTambang[] } = $props();

	let wadah: HTMLDivElement;

	onMount(() => {
		let batal = false;
		let peta: import('leaflet').Map | undefined;

		import('leaflet').then((L) => {
			if (batal) return;

			const gaya = getComputedStyle(document.documentElement);
			const titik = situs.filter((item) => item.latitude !== null && item.longitude !== null);

			peta = L.map(wadah, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; OpenStreetMap contributors',
				maxZoom: 18
			}).addTo(peta);

			const koordinat: [number, number][] = [];
			for (const item of titik) {
				const posisi: [number, number] = [item.latitude as number, item.longitude as number];
				const warna = gaya.getPropertyValue(warnaKomoditas(item.commodity).variabel).trim();
				L.circleMarker(posisi, {
					radius: 7,
					color: warna,
					weight: 2,
					fillColor: warna,
					fillOpacity: 0.45
				})
					.bindPopup(`${item.name} · ${labelKomoditas(item.commodity)}`)
					.addTo(peta);
				koordinat.push(posisi);
			}

			if (koordinat.length === 1) {
				peta.setView(koordinat[0], 8);
			} else {
				peta.fitBounds(koordinat, { padding: [34, 34], maxZoom: 9 });
			}
			setTimeout(() => peta?.invalidateSize(), 80);
		});

		return () => {
			batal = true;
			peta?.remove();
		};
	});
</script>

<div bind:this={wadah} data-testid="peta-situs" class="bg-void h-[212px] w-full"></div>
