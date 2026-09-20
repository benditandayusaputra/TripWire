import { createHmac } from 'node:crypto';

const ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(rahasia: string): Buffer {
	const bersih = rahasia.replace(/=+$/, '').toUpperCase();

	let bit = 0;
	let nilai = 0;
	const keluaran: number[] = [];

	for (const huruf of bersih) {
		const indeks = ABJAD.indexOf(huruf);
		if (indeks < 0) continue;

		nilai = (nilai << 5) | indeks;
		bit += 5;

		if (bit >= 8) {
			keluaran.push((nilai >>> (bit - 8)) & 0xff);
			bit -= 8;
		}
	}

	return Buffer.from(keluaran);
}

export function kodeTOTP(rahasia: string, pergeseranDetik = 0): string {
	const langkah = Math.floor((Date.now() / 1000 + pergeseranDetik) / 30);

	const pesan = Buffer.alloc(8);
	pesan.writeUInt32BE(Math.floor(langkah / 2 ** 32), 0);
	pesan.writeUInt32BE(langkah >>> 0, 4);

	const hasil = createHmac('sha1', base32Decode(rahasia)).update(pesan).digest();
	const geser = hasil[hasil.length - 1] & 0x0f;
	const angka = hasil.readUInt32BE(geser) & 0x7fffffff;

	return String(angka % 1_000_000).padStart(6, '0');
}
