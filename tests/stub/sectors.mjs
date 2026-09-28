import { createServer } from 'node:http';

const port = Number(process.env.SECTORS_STUB_PORT ?? 8899);

const HARI = 86_400_000;
const hariLalu = (jumlah) => new Date(Date.now() - jumlah * HARI).toISOString().slice(0, 10);
const waktuLalu = (jumlah) => new Date(Date.now() - jumlah * HARI).toISOString().slice(0, 19);
const hariDepan = (jumlah) => new Date(Date.now() + jumlah * HARI).toISOString().slice(0, 10);
const tahunIni = new Date().getUTCFullYear();

function pemegang(daftar) {
	return daftar.map(([name, persen]) => ({
		name,
		share_amount: 1_000_000,
		share_value: 1_000_000_000,
		share_percentage: String(persen / 100)
	}));
}

function laporanDasar({ symbol, nama, sector, subSector, industry, subIndustry, publik, lain = [] }) {
	return {
		symbol,
		company_name: nama,
		overview: {
			listing_board: 'Main',
			sector,
			sub_sector: subSector,
			industry,
			sub_industry: subIndustry,
			market_cap: 44_000_000_000_000,
			last_close_price: 1500,
			latest_close_date: hariLalu(1)
		},
		valuation: { last_close_price: 1500, historical_valuation: [] },
		financials: { historical_financials: [] },
		ownership: {
			major_shareholders: pemegang([...lain, ['Public', publik]]),
			top_transactions: null
		}
	};
}

const laporan = {
	ANTM: laporanDasar({
		symbol: 'ANTM.JK',
		nama: 'Aneka Tambang Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Diversified Metals & Minerals',
		publik: 35,
		lain: [['Inalum (Persero)', 65]]
	}),
	PTBA: laporanDasar({
		symbol: 'PTBA.JK',
		nama: 'Bukit Asam Tbk.',
		sector: 'Energy',
		subSector: 'Oil, Gas & Coal',
		industry: 'Coal',
		subIndustry: 'Coal Production',
		publik: 40,
		lain: [['MIND ID', 60]]
	}),
	MDKA: laporanDasar({
		symbol: 'MDKA.JK',
		nama: 'Merdeka Copper Gold Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Diversified Metals & Minerals',
		publik: 12,
		lain: [['Saratoga Investama Sedaya', 18]]
	}),
	ITMG: laporanDasar({
		symbol: 'ITMG.JK',
		nama: 'Indo Tambangraya Megah Tbk.',
		sector: 'Energy',
		subSector: 'Oil, Gas & Coal',
		industry: 'Coal',
		subIndustry: 'Coal Production',
		publik: 30,
		lain: [['Banpu Minerals', 62]]
	}),
	TLKM: laporanDasar({
		symbol: 'TLKM.JK',
		nama: 'Telkom Indonesia (Persero) Tbk',
		sector: 'Infrastructures',
		subSector: 'Telecommunication',
		industry: 'Telecommunication',
		subIndustry: 'Integrated Telecommunication',
		publik: 48,
		lain: [['Negara Republik Indonesia', 52]]
	}),
	BBCA: {
		...laporanDasar({
			symbol: 'BBCA.JK',
			nama: 'Bank Central Asia Tbk.',
			sector: 'Financials',
			subSector: 'Banks',
			industry: 'Banks',
			subIndustry: 'Banks',
			publik: 45,
			lain: [['PT Dwimuria Investama Andalan', 55]]
		}),
		valuation: {
			last_close_price: 7000,
			historical_valuation: [
				{ year: 2024, pe: 20, pb: 4, ps: 9, pe_peer_avg: 10, pb_peer_avg: 1, ps_peer_avg: 3 },
				{ year: 2025, pe: 12.0, pb: 2.4, ps: 5.1, pe_peer_avg: 15.0, pb_peer_avg: 2.0, ps_peer_avg: null }
			]
		},
		financials: {
			historical_financials: [
				{ year: 2024, revenue: 100_000_000_000_000, earnings: 45_000_000_000_000 },
				{ year: 2025, revenue: 105_000_000_000_000, earnings: 48_000_000_000_000 }
			]
		}
	},
	ADRO: laporanDasar({
		symbol: 'ADRO.JK',
		nama: 'Alamtri Resources Indonesia Tbk.',
		sector: 'Energy',
		subSector: 'Oil, Gas & Coal',
		industry: 'Coal',
		subIndustry: 'Coal Production',
		publik: 38,
		lain: [['Adaro Strategic Investments', 62]]
	}),
	INCO: laporanDasar({
		symbol: 'INCO.JK',
		nama: 'Vale Indonesia Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Nickel',
		publik: 22,
		lain: [['Vale Canada Limited', 44]]
	}),
	BBRI: laporanDasar({
		symbol: 'BBRI.JK',
		nama: 'Bank Rakyat Indonesia (Persero) Tbk',
		sector: 'Financials',
		subSector: 'Banks',
		industry: 'Banks',
		subIndustry: 'Banks',
		publik: 47,
		lain: [['Negara Republik Indonesia', 53]]
	})
};

function filing(hari, holder, jenis, nilai, sebelum, sesudah, holderType = 'insider') {
	return {
		title: `${holder} ${jenis}`,
		body: 'Data contoh stub Sectors untuk pengujian',
		source: `https://www.idx.co.id/stub/${encodeURIComponent(holder)}-${hari}.pdf`,
		timestamp: waktuLalu(hari),
		transaction_type: jenis,
		holder_type: holderType,
		holder_name: holder,
		transaction_value: nilai,
		share_percentage_before: sebelum,
		share_percentage_after: sesudah
	};
}

const filings = {
	ANTM: [
		filing(5, 'Direktur Utama', 'sell', 5_000_000_000, 0.5, 0.3),
		filing(12, 'Komisaris Utama', 'sell', 3_000_000_000, 0.4, 0.2),
		filing(20, 'Direktur Keuangan', 'buy', 4_000_000_000, 0.1, 0.35),
		filing(25, 'Inalum (Persero)', 'others', 0, 62.0, 67.0, 'institution'),
		filing(45, 'Inalum (Persero)', 'others', 0, 60.0, 62.0, 'institution'),
		filing(120, 'Pemegang Saham Lama', 'sell', 9_000_000_000, 8.0, 1.0, 'institution')
	],
	PTBA: [
		filing(15, 'Direktur Operasi', 'sell', 1_000_000_000, 0.05, 0.04),
		filing(60, 'Komisaris Independen', 'buy', 9_000_000_000, 0.02, 0.05),
		filing(70, 'MIND ID', 'others', 0, 65.0, 66.5, 'institution')
	],
	MDKA: [
		filing(3, 'Pemegang Saham Mayor A', 'sell', 4_000_000_000, 12.0, 10.0, 'institution'),
		filing(25, 'Pemegang Saham Mayor B', 'sell', 4_000_000_000, 9.0, 4.0, 'institution'),
		filing(40, 'Pemegang Saham Mayor B', 'sell', 0, 10.0, 9.0, 'institution')
	],
	ITMG: [
		...[2, 4, 6, 8, 10].map((hari, urutan) =>
			filing(hari, `Pemegang Saham Mayor ${urutan + 1}`, 'sell', 1_000_000_000, null, null)
		),
		filing(20, 'Banpu Minerals', 'others', 0, 50.0, 62.0, 'corporate-investor')
	],
	TLKM: [],
	BBCA: [],
	ADRO: [],
	INCO: []
};

let revisiBbri = 0;

function filingBbri() {
	revisiBbri += 1;
	return [
		filing(4, `Pemegang Saham Uji ${revisiBbri} ${Date.now()}`, 'sell', 1_000_000_000, 5.2, 5.0, 'institution')
	];
}

const suspensi = {
	ANTM: [
		[10, 'Sehubungan dengan dugaan pelanggaran ketentuan keterbukaan informasi'],
		[200, 'Terjadinya peningkatan harga kumulatif yang signifikan pada saham ANTM.JK']
	],
	PTBA: [
		[400, 'Keterlambatan penyampaian laporan keuangan'],
		[1500, 'Dugaan pelanggaran ketentuan pencatatan']
	],
	ITMG: [5, 100, 300, 700].map((hari) => [hari, 'Dugaan pelanggaran ketentuan bursa'])
};

const subsektor = {
	banks: {
		sector: 'Financials',
		sub_sector: 'Banks',
		growth: {
			weighted_avg_growth_data: {
				'2024': { avg_annual_earning_growth: 0.1, avg_annual_revenue_growth: 0.1 },
				'2025': { avg_annual_earning_growth: 0.08, avg_annual_revenue_growth: 0.03 }
			}
		}
	}
};

const perusahaanTambang = {
	ADRO: {
		slug: 'pt-alamtri-resources-indonesia-tbk',
		name: 'PT Alamtri Resources Indonesia Tbk',
		symbol: 'ADRO.JK',
		company_type: 'Mine Owner',
		key_operation: 'Coal Mining',
		commodity_type: ['Coal']
	},
	INCO: {
		slug: 'pt-vale-indonesia-tbk',
		name: 'PT Vale Indonesia Tbk',
		symbol: 'INCO.JK',
		company_type: 'Trader',
		key_operation: 'Nickel Mining',
		commodity_type: ['Nickel']
	}
};

function lisensi(nomor, komoditas, kedaluwarsa) {
	return {
		license_type: 'IUP',
		license_number: nomor,
		wiup_code: `${nomor}-WIUP`,
		province: 'Kalimantan Selatan',
		city: 'Kabupaten Tabalong',
		license_effective_date: '2016-01-01',
		license_expiry_date: kedaluwarsa,
		activity: 'Operasi Produksi',
		licensed_area_ha: 12000,
		commodity_type: komoditas
	};
}

const detailTambang = {
	'pt-alamtri-resources-indonesia-tbk': {
		...perusahaanTambang.ADRO,
		activities: ['Coal Mining'],
		mining_license: [
			lisensi('IUP-ADRO-01', 'Coal', hariDepan(200)),
			lisensi('IUP-ADRO-02', 'Coal', hariDepan(900))
		],
		mining_contract: [],
		mining_site_count: 2
	},
	'pt-vale-indonesia-tbk': {
		...perusahaanTambang.INCO,
		activities: ['Nickel Mining'],
		mining_license: [lisensi('IUPK-INCO-01', 'Nickel', hariDepan(30))],
		mining_contract: [],
		mining_site_count: 1
	}
};

function barisKinerja(tahun, komoditas, subTipe, unit, produksi, cadangan = {}) {
	return {
		year: tahun,
		commodity_type: komoditas,
		commodity_sub_type: subTipe,
		commodity_stats: {
			unit,
			mining_operation_status: 'production',
			production_volume: produksi,
			sales_volume: produksi,
			resources_reserves: { measurement_year: tahun, ...cadangan }
		}
	};
}

const tahunKinerja = tahunIni - 1;

const kinerjaTambang = {
	'pt-alamtri-resources-indonesia-tbk': {
		[tahunKinerja]: [
			barisKinerja(tahunKinerja, 'Coal', 'Sub-bituminous Coal', 'Mt', 54, { total_reserves_Mt: 756 })
		],
		[tahunKinerja - 1]: [barisKinerja(tahunKinerja - 1, 'Coal', 'Sub-bituminous Coal', 'Mt', 50)]
	},
	'pt-vale-indonesia-tbk': {
		[tahunKinerja]: [
			barisKinerja(tahunKinerja, 'Nickel', 'Nickel Matte', 't', 72_000),
			barisKinerja(tahunKinerja, 'Nickel', 'Saprolite Ore', 'wmt', 4, { total_reserves_wmt: 100 })
		],
		[tahunKinerja - 1]: [barisKinerja(tahunKinerja - 1, 'Nickel', 'Nickel Matte', 't', 60_000)]
	}
};

function seriHarga(nama, terbaru, setahunLalu) {
	const sekarang = new Date();
	const titik = [];
	for (let mundur = 24; mundur >= 0; mundur -= 1) {
		const tanggal = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - mundur, 1));
		const harga =
			mundur >= 12 ? setahunLalu : terbaru + ((setahunLalu - terbaru) * mundur) / 12;
		titik.push({
			name: nama,
			date: tanggal.toISOString().slice(0, 10),
			price_usd_per_ton: Math.round(harga * 100) / 100
		});
	}
	return titik;
}

const hargaKomoditas = {
	coal: seriHarga('Coal', 94, 100),
	nickel: seriHarga('Nickel', 16_500, 15_000)
};

const situsTambang = {
	'pt-alamtri-resources-indonesia-tbk': [
		{ name: 'Tutupan', slug: 'tutupan', commodity_type: 'Coal', province: 'Kalimantan Selatan', city: 'Tabalong', latitude: -2.15, longitude: 115.42 },
		{ name: 'Wara', slug: 'wara', commodity_type: 'Coal', province: 'Kalimantan Selatan', city: 'Tabalong', latitude: -2.31, longitude: 115.36 }
	],
	'pt-vale-indonesia-tbk': [
		{ name: 'Sorowako', slug: 'sorowako', commodity_type: 'Nickel', province: 'Sulawesi Selatan', city: 'Luwu Timur', latitude: -2.53, longitude: 121.36 }
	]
};

const emiten = [
	['ANTM', 'Aneka Tambang Tbk.'],
	['PTBA', 'Bukit Asam Tbk.'],
	['BBCA', 'Bank Central Asia Tbk.'],
	['MDKA', 'Merdeka Copper Gold Tbk.'],
	['INCO', 'Vale Indonesia Tbk.'],
	['BRMS', 'Bumi Resources Minerals Tbk.'],
	['ADRO', 'Alamtri Resources Indonesia Tbk.'],
	['ITMG', 'Indo Tambangraya Megah Tbk.'],
	['TLKM', 'Telkom Indonesia (Persero) Tbk'],
	['BBRI', 'Bank Rakyat Indonesia (Persero) Tbk']
].map(([kode, nama]) => ({ symbol: `${kode}.JK`, company_name: nama }));

function halaman(daftar, url) {
	const limit = Number(url.searchParams.get('limit') ?? 20);
	const offset = Number(url.searchParams.get('offset') ?? 0);
	const isi = daftar.slice(offset, offset + limit);
	const adaLagi = offset + limit < daftar.length;
	return {
		results: isi,
		pagination: {
			total_count: daftar.length,
			showing: isi.length,
			limit,
			offset,
			has_next: adaLagi,
			has_previous: offset > 0,
			next_offset: adaLagi ? offset + limit : null,
			previous_offset: offset > 0 ? Math.max(0, offset - limit) : null
		}
	};
}

function kodeDari(teks) {
	return String(teks ?? '').toUpperCase().replace(/\.JK$/, '');
}

let panggilanUpstream = 0;
let pushDiterima = [];

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

	if (path === '/__stub/push') {
		return balas(res, 200, { deliveries: pushDiterima });
	}

	if (path === '/__stub/push/reset') {
		pushDiterima = [];
		return balas(res, 200, { ok: true });
	}

	if (path.startsWith('/__push/')) {
		const potongan = [];
		req.on('data', (bagian) => potongan.push(bagian));
		req.on('end', () => {
			const isi = Buffer.concat(potongan);
			const hilang = path.startsWith('/__push/hilang/');

			pushDiterima.push({
				path,
				gone: hilang,
				method: req.method,
				authorization: req.headers.authorization ?? '',
				content_encoding: req.headers['content-encoding'] ?? '',
				content_type: req.headers['content-type'] ?? '',
				ttl: req.headers.ttl ?? '',
				urgency: req.headers.urgency ?? '',
				body_bytes: isi.length,
				body_base64: isi.toString('base64'),
				body_text: isi.toString('utf8'),
				received_at: new Date().toISOString()
			});

			if (hilang) {
				return balas(res, 410, { error: 'langganan sudah tidak berlaku' });
			}
			return balas(res, 201, { ok: true });
		});
		return;
	}

	if (!req.headers.authorization) {
		return balas(res, 401, { error: 'kunci api tidak dikirim' });
	}

	panggilanUpstream += 1;

	if (path === '/companies/') {
		return balas(res, 200, halaman(emiten, url));
	}

	const cocokLaporan = path.match(/^\/company\/report\/([a-z0-9.]+)\/$/i);
	if (cocokLaporan) {
		const kode = kodeDari(cocokLaporan[1]);

		if (kode === 'BRMS') {
			return balas(res, 500, { error: 'upstream sengaja gagal untuk uji circuit breaker' });
		}

		const data = laporan[kode];
		if (!data) {
			return balas(res, 404, { error: 'Given stock symbol does not exist.' });
		}

		const bagian = (url.searchParams.get('sections') ?? '').split(',').filter(Boolean);
		if (bagian.length === 0) {
			return balas(res, 200, data);
		}
		const hasil = { symbol: data.symbol, company_name: data.company_name };
		for (const nama of bagian) hasil[nama] = data[nama] ?? null;
		return balas(res, 200, hasil);
	}

	if (path === '/suspensions/') {
		const kode = kodeDari(url.searchParams.get('symbol'));
		const daftar = (suspensi[kode] ?? []).map(([hari, alasan]) => ({
			symbol: `${kode}.JK`,
			suspension_date: hariLalu(hari),
			reason: alasan,
			pdf_url: `https://www.idx.co.id/stub/suspensi-${kode}-${hari}.pdf`
		}));
		return balas(res, 200, halaman(daftar, url));
	}

	if (path === '/filings/') {
		const kode = kodeDari(url.searchParams.get('symbol'));
		const mulai = url.searchParams.get('start') ?? '0000-00-00';
		const sumber = kode === 'BBRI' ? filingBbri() : (filings[kode] ?? []);
		const daftar = sumber
			.filter((item) => item.timestamp.slice(0, 10) >= mulai)
			.map((item) => ({ ...item, symbol: `${kode}.JK` }));
		return balas(res, 200, halaman(daftar, url));
	}

	const cocokSubsektor = path.match(/^\/subsector\/report\/([a-z0-9-]+)\/$/i);
	if (cocokSubsektor) {
		const data = subsektor[cocokSubsektor[1].toLowerCase()];
		if (!data) {
			return balas(res, 404, { error: 'sub sektor tidak dikenal' });
		}
		return balas(res, 200, data);
	}

	if (path === '/mining/companies/') {
		const kata = kodeDari(url.searchParams.get('keyword'));
		const daftar = perusahaanTambang[kata] ? [perusahaanTambang[kata]] : [];
		return balas(res, 200, halaman(daftar, url));
	}

	const cocokKinerja = path.match(/^\/mining\/companies\/performance\/([a-z0-9-]+)\/$/i);
	if (cocokKinerja) {
		const perTahun = kinerjaTambang[cocokKinerja[1]];
		if (!perTahun) {
			return balas(res, 404, { error: 'Company not found.' });
		}
		const tersedia = Object.keys(perTahun).map(Number).sort();
		const tahun = Number(url.searchParams.get('year') ?? Math.max(...tersedia));
		return balas(res, 200, { year: tahun, available_years: tersedia, data: perTahun[tahun] ?? [] });
	}

	const cocokTambang = path.match(/^\/mining\/companies\/([a-z0-9-]+)\/$/i);
	if (cocokTambang) {
		const data = detailTambang[cocokTambang[1]];
		if (!data) {
			return balas(res, 404, { error: 'Company not found. Please provide a valid company slug.' });
		}
		return balas(res, 200, data);
	}

	const cocokHarga = path.match(/^\/mining\/commodities\/([a-z ]+)\/price\/$/i);
	if (cocokHarga) {
		const data = hargaKomoditas[decodeURIComponent(cocokHarga[1]).toLowerCase()];
		if (!data) {
			return balas(res, 404, { error: 'Commodity not found.' });
		}
		return balas(res, 200, data);
	}

	if (path === '/mining/sites/') {
		const daftar = (situsTambang[url.searchParams.get('company')] ?? []).map((situs) => ({
			name: situs.name,
			project_name: null,
			year: tahunKinerja,
			commodity_type: situs.commodity_type,
			production_volume: null,
			unit: 'Mt',
			strip_ratio: null,
			province: situs.province,
			city: situs.city,
			company_slug: url.searchParams.get('company'),
			slug: situs.slug
		}));
		return balas(res, 200, halaman(daftar, url));
	}

	const cocokSitus = path.match(/^\/mining\/sites\/([a-z0-9-]+)\/$/i);
	if (cocokSitus) {
		const situs = Object.values(situsTambang)
			.flat()
			.find((item) => item.slug === cocokSitus[1]);
		if (!situs) {
			return balas(res, 404, { error: 'Mining site not found.' });
		}
		return balas(res, 200, {
			name: situs.name,
			year: tahunKinerja,
			commodity_type: situs.commodity_type,
			unit: 'Mt',
			location: {
				province: situs.province,
				city: situs.city,
				latitude: situs.latitude,
				longitude: situs.longitude
			},
			slug: situs.slug
		});
	}

	return balas(res, 404, { error: 'rute stub tidak dikenal' });
}).listen(port, '127.0.0.1', () => {
	process.stdout.write(`sectors stub siap di http://127.0.0.1:${port}\n`);
});
