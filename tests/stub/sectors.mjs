import { createServer } from 'node:http';

const port = Number(process.env.SECTORS_STUB_PORT ?? 8899);

const HARI = 86_400_000;
const hariLalu = (jumlah) => new Date(Date.now() - jumlah * HARI).toISOString().slice(0, 10);
const hariDepan = (jumlah) => new Date(Date.now() + jumlah * HARI).toISOString().slice(0, 10);

const laporan = {
	antm: {
		symbol: 'ANTM.JK',
		company_name: 'Aneka Tambang Tbk.',
		sub_sector: 'Basic Materials',
		overview: { market_cap: 44_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 41_000_000_000_000, net_income: 3_800_000_000_000 },
		valuation: { pe: 14.5, pb: 1.8, roe: 0.12, net_profit_margin: 0.09 },
		ownership: {
			free_float_pct: 35,
			shareholders_history: [
				{ date: hariLalu(1), top_holder_name: 'Inalum', top_holder_percentage: 52.0 },
				{ date: hariLalu(31), top_holder_name: 'Inalum', top_holder_percentage: 47.0 },
				{ date: hariLalu(95), top_holder_name: 'Inalum', top_holder_percentage: 45.0 }
			]
		},
		filings: [
			{
				date: hariLalu(5),
				holder_name: 'Direktur Utama',
				transaction_type: 'sell',
				transaction_value: 5_000_000_000
			},
			{
				date: hariLalu(12),
				holder_name: 'Komisaris',
				transaction_type: 'sell',
				transaction_value: 3_000_000_000
			},
			{
				date: hariLalu(20),
				holder_name: 'Direktur Keuangan',
				transaction_type: 'buy',
				transaction_value: 2_000_000_000
			},
			{
				date: hariLalu(120),
				holder_name: 'Pemegang Saham Mayor',
				transaction_type: 'sell',
				transaction_value: 9_000_000_000
			}
		]
	},
	ptba: {
		symbol: 'PTBA.JK',
		company_name: 'Bukit Asam Tbk.',
		sub_sector: 'Energy',
		overview: { market_cap: 32_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 38_000_000_000_000, net_income: 4_600_000_000_000 },
		valuation: { pe: 8.2, pb: 1.4, roe: 0.21, net_profit_margin: 0.12 },
		ownership: {
			free_float_pct: 40,
			shareholders_history: [
				{ date: hariLalu(1), top_holder_name: 'Mind ID', top_holder_percentage: 30.0 },
				{ date: hariLalu(31), top_holder_name: 'Mind ID', top_holder_percentage: 29.5 },
				{ date: hariLalu(95), top_holder_name: 'Mind ID', top_holder_percentage: 28.5 }
			]
		},
		filings: [
			{
				date: hariLalu(15),
				holder_name: 'Direktur Operasi',
				transaction_type: 'sell',
				transaction_value: 1_000_000_000
			},
			{
				date: hariLalu(60),
				holder_name: 'Komisaris Independen',
				transaction_type: 'buy',
				transaction_value: 9_000_000_000
			}
		]
	},
	mdka: {
		symbol: 'MDKA.JK',
		company_name: 'Merdeka Copper Gold Tbk.',
		sub_sector: 'Basic Materials',
		overview: { market_cap: 51_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 24_000_000_000_000, net_income: 400_000_000_000 },
		valuation: { pe: 41.0, pb: 3.9, roe: 0.03, net_profit_margin: 0.02 },
		ownership: {
			free_float_pct: 12,
			shareholders_history: [
				{ date: hariLalu(1), top_holder_name: 'Saratoga', top_holder_percentage: 61.0 },
				{ date: hariLalu(31), top_holder_name: 'Saratoga', top_holder_percentage: 56.0 },
				{ date: hariLalu(95), top_holder_name: 'Saratoga', top_holder_percentage: 55.0 }
			]
		},
		filings: [
			{
				date: hariLalu(3),
				holder_name: 'Pemegang Saham Mayor A',
				transaction_type: 'sell',
				transaction_value: 4_000_000_000
			},
			{
				date: hariLalu(25),
				holder_name: 'Pemegang Saham Mayor B',
				transaction_type: 'sell',
				transaction_value: 4_000_000_000
			}
		]
	},
	itmg: {
		symbol: 'ITMG.JK',
		company_name: 'Indo Tambangraya Megah Tbk.',
		sub_sector: 'Energy',
		overview: { market_cap: 29_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 30_000_000_000_000, net_income: 5_100_000_000_000 },
		valuation: { pe: 5.4, pb: 1.1, roe: 0.24, net_profit_margin: 0.17 },
		ownership: {
			free_float_pct: 30,
			shareholders_history: [
				{ date: hariLalu(1), top_holder_name: 'Banpu Minerals', top_holder_percentage: 62.0 },
				{ date: hariLalu(31), top_holder_name: 'Banpu Minerals', top_holder_percentage: 50.0 },
				{ date: hariLalu(95), top_holder_name: 'Banpu Minerals', top_holder_percentage: 50.0 }
			]
		},
		filings: [2, 4, 6, 8, 10].map((hari, urutan) => ({
			date: hariLalu(hari),
			holder_name: `Pemegang Saham Mayor ${urutan + 1}`,
			transaction_type: 'sell',
			transaction_value: 1_000_000_000
		}))
	},
	tlkm: {
		symbol: 'TLKM.JK',
		company_name: 'Telkom Indonesia (Persero) Tbk',
		sub_sector: 'Telecommunication',
		overview: { market_cap: 270_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 149_000_000_000_000, net_income: 23_000_000_000_000 },
		valuation: { pe: 11.8, pb: 2.1, roe: 0.17, net_profit_margin: 0.15 },
		ownership: { free_float_pct: 48, shareholders_history: [] },
		filings: []
	},
	bbca: {
		symbol: 'BBCA.JK',
		company_name: 'Bank Central Asia Tbk.',
		sub_sector: 'Banks',
		overview: { market_cap: 1_100_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 105_000_000_000_000, net_income: 48_000_000_000_000 },
		valuation: { pe: 12.0, pb: 2.4, roe: 0.18, net_profit_margin: 0.35 },
		ownership: { free_float_pct: 45, shareholders_history: [] },
		filings: []
	},
	adro: {
		symbol: 'ADRO.JK',
		company_name: 'Alamtri Resources Indonesia Tbk.',
		sub_sector: 'Coal',
		overview: { market_cap: 78_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 98_000_000_000_000, net_income: 13_000_000_000_000 },
		valuation: { pe: 9.1, pb: 1.2, roe: 0.16, net_profit_margin: 0.14 },
		ownership: { free_float_pct: 38, shareholders_history: [] },
		filings: []
	},
	inco: {
		symbol: 'INCO.JK',
		company_name: 'Vale Indonesia Tbk.',
		sub_sector: 'Metals & Minerals',
		overview: { market_cap: 41_000_000_000_000, listing_board: 'Utama' },
		financials: { revenue: 17_000_000_000_000, net_income: 2_100_000_000_000 },
		valuation: { pe: 19.4, pb: 1.5, roe: 0.08, net_profit_margin: 0.12 },
		ownership: { free_float_pct: 22, shareholders_history: [] },
		filings: []
	}
};

const suspensi = {
	antm: [
		{ date: hariLalu(10), reason: 'Dugaan pelanggaran keterbukaan informasi' },
		{ date: hariLalu(200), reason: 'Unusual Market Activity (UMA)' }
	],
	ptba: [
		{ date: hariLalu(400), reason: 'Keterlambatan penyampaian laporan keuangan' },
		{ date: hariLalu(1500), reason: 'Dugaan pelanggaran ketentuan pencatatan' }
	],
	itmg: [5, 100, 300, 700].map((hari) => ({
		date: hariLalu(hari),
		reason: 'Dugaan pelanggaran ketentuan bursa',
		severity_tier: 3
	})),
	mdka: [],
	bbca: [],
	adro: [],
	inco: []
};

const tambang = {
	adro: {
		symbol: 'ADRO.JK',
		company_type: 'mine_owner',
		production: { yoy_change_pct: 8.0, unit: 'juta ton' },
		commodity: { name: 'Coal', price_yoy_change_pct: -6.0 },
		reserves: { reserve_life_years: 14 },
		licenses: [
			{
				license_id: 'IUP-ADRO-01',
				commodity: 'Coal',
				status: 'aktif',
				expires_at: hariDepan(200)
			},
			{
				license_id: 'IUP-ADRO-02',
				commodity: 'Coal',
				status: 'aktif',
				expires_at: hariDepan(900)
			}
		],
		mine_sites: [
			{
				name: 'Tutupan',
				commodity: 'Coal',
				region: 'Kalimantan Selatan',
				latitude: -2.15,
				longitude: 115.42
			},
			{
				name: 'Wara',
				commodity: 'Coal',
				region: 'Kalimantan Selatan',
				latitude: -2.31,
				longitude: 115.36
			}
		]
	},
	inco: {
		symbol: 'INCO.JK',
		company_type: 'trading',
		production: { yoy_change_pct: 20.0, unit: 'ribu ton' },
		commodity: { name: 'Nickel', price_yoy_change_pct: 10.0 },
		reserves: { reserve_life_years: 25 },
		licenses: [
			{
				license_id: 'IUPK-INCO-01',
				commodity: 'Nickel',
				status: 'aktif',
				expires_at: hariDepan(30)
			}
		],
		mine_sites: [
			{
				name: 'Sorowako',
				commodity: 'Nickel',
				region: 'Sulawesi Selatan',
				latitude: -2.53,
				longitude: 121.36
			}
		]
	}
};

const subsektor = {
	banks: { pe: 15.0, pb: 2.0, roe: 0.15, net_profit_margin: 0.3 },
	coal: { pe: 8.0, pb: 1.1, roe: 0.18, net_profit_margin: 0.16 },
	'metals-minerals': { pe: 17.0, pb: 1.4, roe: 0.09, net_profit_margin: 0.11 },
	'basic-materials': { pe: 16.0, pb: 2.2, roe: 0.1, net_profit_margin: 0.08 },
	energy: { pe: 7.5, pb: 1.3, roe: 0.19, net_profit_margin: 0.15 },
	telecommunication: { pe: 13.0, pb: 2.5, roe: 0.16, net_profit_margin: 0.14 }
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

	const cocokLaporan = path.match(/^\/company\/report\/([a-z0-9]+)\/$/i);
	if (cocokLaporan) {
		const kode = cocokLaporan[1].toLowerCase();

		if (kode === 'brms') {
			return balas(res, 500, { error: 'upstream sengaja gagal untuk uji circuit breaker' });
		}

		const data = laporan[kode];
		if (!data) {
			return balas(res, 404, { error: 'emiten tidak ada di Sectors' });
		}

		return balas(res, 200, data);
	}

	const cocokSuspensi = path.match(/^\/idx-suspension\/([a-z0-9]+)\/$/i);
	if (cocokSuspensi) {
		const kode = cocokSuspensi[1].toLowerCase();
		const data = suspensi[kode];
		if (!data) {
			return balas(res, 404, { error: 'riwayat suspend tidak tersedia' });
		}
		return balas(res, 200, { symbol: `${kode.toUpperCase()}.JK`, suspensions: data });
	}

	const cocokTambang = path.match(/^\/company\/mining\/([a-z0-9]+)\/$/i);
	if (cocokTambang) {
		const data = tambang[cocokTambang[1].toLowerCase()];
		if (!data) {
			return balas(res, 404, { error: 'emiten bukan sektor tambang' });
		}
		return balas(res, 200, data);
	}

	const cocokSubsektor = path.match(/^\/subsector\/report\/([a-z0-9-]+)\/$/i);
	if (cocokSubsektor) {
		const slug = cocokSubsektor[1].toLowerCase();
		const valuation = subsektor[slug];
		if (!valuation) {
			return balas(res, 404, { error: 'sub sektor tidak dikenal' });
		}
		return balas(res, 200, { sub_sector: slug, valuation });
	}

	return balas(res, 404, { error: 'rute stub tidak dikenal' });
}).listen(port, '127.0.0.1', () => {
	process.stdout.write(`sectors stub siap di http://127.0.0.1:${port}\n`);
});
