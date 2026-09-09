import { createServer } from 'node:http';

const port = Number(process.env.SECTORS_STUB_PORT ?? 8899);

const laporan = {
	antm: {
		symbol: 'ANTM.JK',
		company_name: 'Aneka Tambang Tbk.',
		sub_sector: 'Basic Materials',
		overview: { market_cap: 44_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 41_000_000_000_000, net_income: 3_800_000_000_000 }
	},
	ptba: {
		symbol: 'PTBA.JK',
		company_name: 'Bukit Asam Tbk.',
		sub_sector: 'Energy',
		overview: { market_cap: 32_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 38_000_000_000_000, net_income: 4_600_000_000_000 }
	}
};

const emiten = [
	{ symbol: 'ANTM.JK', company_name: 'Aneka Tambang Tbk.' },
	{ symbol: 'PTBA.JK', company_name: 'Bukit Asam Tbk.' },
	{ symbol: 'BBCA.JK', company_name: 'Bank Central Asia Tbk.' },
	{ symbol: 'MDKA.JK', company_name: 'Merdeka Copper Gold Tbk.' },
	{ symbol: 'INCO.JK', company_name: 'Vale Indonesia Tbk.' },
	{ symbol: 'BRMS.JK', company_name: 'Bumi Resources Minerals Tbk.' },
	{ symbol: 'ADRO.JK', company_name: 'Alamtri Resources Indonesia Tbk.' },
	{ symbol: 'ITMG.JK', company_name: 'Indo Tambangraya Megah Tbk.' },
	{ symbol: 'TLKM.JK', company_name: 'Telkom Indonesia (Persero) Tbk' },
	{ symbol: 'BBRI.JK', company_name: 'Bank Rakyat Indonesia (Persero) Tbk' }
];

let panggilanUpstream = 0;

function balas(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(payload);
}

createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${port}`);
	const path = url.pathname;

	if (path === '/__stub/stats') {
		return balas(res, 200, { upstream_calls: panggilanUpstream });
	}

	if (path === '/__stub/reset') {
		panggilanUpstream = 0;
		return balas(res, 200, { ok: true });
	}

	if (!req.headers.authorization) {
		return balas(res, 401, { error: 'kunci api tidak dikirim' });
	}

	panggilanUpstream += 1;

	if (path === '/companies/') {
		return balas(res, 200, emiten);
	}

	const cocok = path.match(/^\/company\/report\/([a-z0-9]+)\/$/i);
	if (cocok) {
		const kode = cocok[1].toLowerCase();

		if (kode === 'brms') {
			return balas(res, 500, { error: 'upstream sengaja gagal untuk uji circuit breaker' });
		}

		const data = laporan[kode];
		if (!data) {
			return balas(res, 404, { error: 'emiten tidak ada di Sectors' });
		}

		return balas(res, 200, data);
	}

	return balas(res, 404, { error: 'rute stub tidak dikenal' });
}).listen(port, '127.0.0.1', () => {
	process.stdout.write(`sectors stub siap di http://127.0.0.1:${port}\n`);
});
