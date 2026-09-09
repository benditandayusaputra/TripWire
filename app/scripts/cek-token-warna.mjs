import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PREFIKS = [
	'text', 'bg', 'border', 'from', 'to', 'via', 'ring', 'fill',
	'stroke', 'divide', 'outline', 'accent', 'caret', 'shadow', 'decoration'
];

const css = readFileSync('src/app.css', 'utf8');
const token = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]));
const akar = new Set([...token].map((nama) => nama.split('-')[0]));

function berkas(dir) {
	return readdirSync(dir).flatMap((entri) => {
		const jalur = join(dir, entri);
		if (statSync(jalur).isDirectory()) return berkas(jalur);
		return /\.(svelte|ts)$/.test(entri) ? [jalur] : [];
	});
}

const pola = new RegExp(`\\b(?:${PREFIKS.join('|')})-([a-z]+(?:-[a-z0-9]+)*)(?:/\\d+)?\\b`, 'g');
const temuan = new Map();

for (const jalur of berkas('src')) {
	const isi = readFileSync(jalur, 'utf8');
	for (const [, nama] of isi.matchAll(pola)) {
		if (!akar.has(nama.split('-')[0]) || token.has(nama)) continue;
		if (!temuan.has(nama)) temuan.set(nama, new Set());
		temuan.get(nama).add(jalur);
	}
}

if (temuan.size === 0) {
	console.log('Semua kelas warna mengacu ke token yang terdefinisi di app.css');
	process.exit(0);
}

console.error('Kelas warna tanpa token, kelasnya akan hilang diam diam tanpa error:');
for (const [nama, jalur] of [...temuan].sort()) {
	console.error(`  ${nama.padEnd(22)} ${[...jalur].sort().join(', ')}`);
}
process.exit(1);
