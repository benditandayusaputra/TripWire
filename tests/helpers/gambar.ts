import { randomFillSync } from 'node:crypto';
import { deflateSync } from 'node:zlib';

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipe: string, isi: Buffer): Buffer {
	const panjang = Buffer.alloc(4);
	panjang.writeUInt32BE(isi.length);

	const badan = Buffer.concat([Buffer.from(tipe, 'ascii'), isi]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(badan));

	return Buffer.concat([panjang, badan, crc]);
}

export function pngPersegi(sisi: number, warna: [number, number, number]): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(sisi, 0);
	header.writeUInt32BE(sisi, 4);
	header[8] = 8;
	header[9] = 2;

	const baris = Buffer.alloc(sisi * 3);
	for (let x = 0; x < sisi; x += 1) {
		baris[x * 3] = warna[0];
		baris[x * 3 + 1] = warna[1];
		baris[x * 3 + 2] = warna[2];
	}

	const mentah = Buffer.concat(
		Array.from({ length: sisi }, () => Buffer.concat([Buffer.from([0]), baris]))
	);

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(mentah)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

export function pngAcak(sisi: number): Buffer {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(sisi, 0);
	header.writeUInt32BE(sisi, 4);
	header[8] = 8;
	header[9] = 2;

	const mentah = Buffer.concat(
		Array.from({ length: sisi }, () => {
			const baris = Buffer.alloc(sisi * 3 + 1);
			randomFillSync(baris, 1);
			return baris;
		})
	);

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(mentah)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

export function bukanGambar(ukuran = 2048): Buffer {
	return Buffer.from('berkas ini teks biasa yang mengaku gambar '.repeat(ukuran).slice(0, ukuran));
}
