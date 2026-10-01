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

function laporanDasar({
	symbol,
	nama,
	sector,
	subSector,
	industry,
	subIndustry,
	publik,
	lain = [],
	harga = [1500, 0.004, 1200, 1800, 44, 60, []],
	profil = {},
	kepemilikan = {},
	direksi = [],
	sahamDireksi = null
}) {
	const [penutupan, ubah, rendah, tinggi, triliun, peringkat, indices] = harga;
	return {
		symbol,
		company_name: nama,
		overview: {
			...profil,
			listing_board: 'Main',
			sector,
			sub_sector: subSector,
			industry,
			sub_industry: subIndustry,
			market_cap: triliun * 1_000_000_000_000,
			market_cap_rank: peringkat,
			last_close_price: penutupan,
			latest_close_date: hariLalu(1),
			daily_close_change: ubah,
			all_time_price: {
				'52_w_low': { [hariLalu(200)]: rendah },
				'52_w_high': { [hariLalu(90)]: tinggi }
			},
			indices
		},
		valuation: { last_close_price: penutupan, historical_valuation: [] },
		financials: { historical_financials: [] },
		ownership: {
			major_shareholders: pemegang([...lain, ['Public', publik]]),
			top_transactions: null,
			...kepemilikan
		},
		management: {
			key_executives: direksi.map(([name, position]) => ({ name, position })),
			executives_shareholdings: sahamDireksi
		}
	};
}

const KATEGORI_INVESTOR = [
	'individual',
	'mutual_fund',
	'pension_fund',
	'insurance',
	'corporate',
	'financial_institutions',
	'securities_companies',
	'foundation',
	'other'
];

function komposisiBulan(hari, lokal, asing, pemegangSaham, perubahan) {
	const baris = {
		date: hariLalu(hari),
		shares_number: 24_030_764_725,
		numbers_of_shareholders: pemegangSaham,
		change_in_shareholders: perubahan
	};
	KATEGORI_INVESTOR.forEach((nama, urutan) => {
		baris[`${nama}_l`] = lokal[urutan] ?? 0;
		baris[`${nama}_f`] = asing[urutan] ?? 0;
	});
	baris.total_l = lokal.reduce((jumlah, nilai) => jumlah + nilai, 0);
	baris.total_f = asing.reduce((jumlah, nilai) => jumlah + nilai, 0);
	return baris;
}

const komposisi = {
	ANTM: [
		komposisiBulan(62, [4_000_000_000, 900_000_000], [2_500_000_000, 1_100_000_000], 500_000, 8_000),
		komposisiBulan(31, [4_200_000_000, 1_000_000_000, 300_000_000], [2_400_000_000, 900_000_000], 512_345, 12_345)
	],
	TLKM: []
};

const laporan = {
	ANTM: laporanDasar({
		symbol: 'ANTM.JK',
		nama: 'Aneka Tambang Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Diversified Metals & Minerals',
		publik: 35,
		lain: [['Inalum (Persero)', 65]],
		harga: [3230, -0.0122, 2450, 4970, 77.6, 27, ['LQ45', 'IDX30']],
		profil: {
			address: 'Gedung Uji Tambang\r\nJalan Contoh No. 1\r\nJakarta 12530',
			website: 'www.aneka-tambang.test',
			phone: '021-0000000',
			email: 'ir@aneka-tambang.test',
			employee_num: 2750,
			listing_date: '1997-11-27',
			affiliates: ['Grup Afiliasi Uji']
		},
		kepemilikan: {
			top_transactions: {
				date: hariLalu(40),
				top_buyers: [{ name: 'Dana Pensiun Uji', changeAmount: 12_500_000 }],
				top_sellers: [{ name: 'Manajer Investasi Uji', changeAmount: -8_000_000 }]
			},
			institutional_transaction_flow: [
				{ date: hariLalu(40), net_transaction: 4_500_000 },
				{ date: hariLalu(70), net_transaction: -2_000_000 }
			],
			whale_investors: ['Investor Kakap Uji'],
			conglomerates_group: ['Grup BUMN Uji']
		},
		direksi: [
			['Direktur Utama Uji', 'President Director'],
			['Direktur Keuangan Uji', 'Director'],
			['Komisaris Utama Uji', 'President Commissioner']
		],
		sahamDireksi: [
			{
				name: 'Direktur Keuangan Uji',
				position: 'Director',
				share_amount: 244_000,
				share_percentage: 0.00001
			}
		]
	}),
	PTBA: laporanDasar({
		symbol: 'PTBA.JK',
		nama: 'Bukit Asam Tbk.',
		sector: 'Energy',
		subSector: 'Oil, Gas & Coal',
		industry: 'Coal',
		subIndustry: 'Coal Production',
		publik: 40,
		lain: [['MIND ID', 60]],
		harga: [2650, 0.0076, 2300, 3100, 30.5, 45, ['LQ45']],
		profil: { website: 'javascript:alert(1)' }
	}),
	MDKA: laporanDasar({
		symbol: 'MDKA.JK',
		nama: 'Merdeka Copper Gold Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Diversified Metals & Minerals',
		publik: 12,
		lain: [['Saratoga Investama Sedaya', 18]],
		harga: [1850, -0.0213, 1400, 2900, 45.2, 38, ['LQ45']]
	}),
	ITMG: laporanDasar({
		symbol: 'ITMG.JK',
		nama: 'Indo Tambangraya Megah Tbk.',
		sector: 'Energy',
		subSector: 'Oil, Gas & Coal',
		industry: 'Coal',
		subIndustry: 'Coal Production',
		publik: 30,
		lain: [['Banpu Minerals', 62]],
		harga: [24500, 0.0041, 22000, 28000, 27.7, 52, []]
	}),
	TLKM: laporanDasar({
		symbol: 'TLKM.JK',
		nama: 'Telkom Indonesia (Persero) Tbk',
		sector: 'Infrastructures',
		subSector: 'Telecommunication',
		industry: 'Telecommunication',
		subIndustry: 'Integrated Telecommunication',
		publik: 48,
		lain: [['Negara Republik Indonesia', 52]],
		harga: [2980, 0.0068, 2500, 3500, 295, 6, ['LQ45', 'IDX30']]
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
			lain: [['PT Dwimuria Investama Andalan', 55]],
			harga: [7000, 0.0036, 6100, 9800, 863, 1, ['LQ45', 'IDX30']]
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
		lain: [['Adaro Strategic Investments', 62]],
		harga: [2100, -0.0094, 1800, 2700, 64.6, 30, ['LQ45']]
	}),
	INCO: laporanDasar({
		symbol: 'INCO.JK',
		nama: 'Vale Indonesia Tbk.',
		sector: 'Basic Materials',
		subSector: 'Basic Materials',
		industry: 'Metals & Minerals',
		subIndustry: 'Nickel',
		publik: 22,
		lain: [['Vale Canada Limited', 44]],
		harga: [3900, 0.0155, 3100, 4600, 38.8, 41, ['LQ45']]
	}),
	BBRI: laporanDasar({
		symbol: 'BBRI.JK',
		nama: 'Bank Rakyat Indonesia (Persero) Tbk',
		sector: 'Financials',
		subSector: 'Banks',
		industry: 'Banks',
		subIndustry: 'Banks',
		publik: 47,
		lain: [['Negara Republik Indonesia', 53]],
		harga: [3950, -0.005, 3500, 5200, 598, 3, ['LQ45', 'IDX30']]
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

function hargaHarian(kode, mulai) {
	const tanggal = [];
	for (let mundur = 1; hariLalu(mundur) >= mulai; mundur += 1) {
		const hari = new Date(`${hariLalu(mundur)}T00:00:00Z`).getUTCDay();
		if (hari !== 0 && hari !== 6) tanggal.unshift(hariLalu(mundur));
	}

	let benih = [...kode].reduce((jumlah, huruf) => jumlah * 31 + huruf.charCodeAt(0), 7) % 2147483647;
	const acak = () => (benih = (benih * 16807) % 2147483647) / 2147483647;
	const fraksi = (harga) => Math.max(50, Math.round(harga / 5) * 5);

	let tutup = laporan[kode]?.overview.last_close_price ?? 1000;
	const baris = [];
	for (let i = tanggal.length - 1; i >= 0; i -= 1) {
		const buka = fraksi(tutup * (1 + (acak() - 0.5) * 0.03));
		baris.unshift({
			symbol: `${kode}.JK`,
			date: tanggal[i],
			close: tutup,
			open: buka,
			high: Math.max(buka, tutup) + 5 * Math.round(acak() * 6),
			low: Math.min(buka, tutup) - 5 * Math.round(acak() * 6),
			volume: Math.round(20 + acak() * 60) * 1_000_000,
			market_cap: tutup * 24_000_000_000
		});
		tutup = fraksi(buka * (1 + (acak() - 0.5) * 0.02));
	}
	return baris;
}

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
		if (url.searchParams.get('include_query_values') !== 'true') {
			return balas(res, 200, halaman(emiten, url));
		}
		const berisi = emiten
			.map(({ symbol, company_name }) => {
				const kode = kodeDari(symbol);
				const [kemarin, terakhir] = hargaHarian(kode, hariLalu(7)).slice(-2);
				const overview = laporan[kode]?.overview;
				return {
					symbol,
					company_name: `PT ${company_name}`,
					query_values: {
						symbol,
						last_close_price: terakhir.close,
						daily_close_change: overview?.daily_close_change ?? terakhir.close / kemarin.close - 1,
						market_cap: overview?.market_cap ?? terakhir.market_cap,
						sector: overview?.sector ?? 'Basic Materials'
					}
				};
			})
			.sort((a, b) => b.query_values.market_cap - a.query_values.market_cap);
		return balas(res, 200, halaman(berisi, url));
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

	const cocokKomposisi = path.match(/^\/company\/shareholders-composition\/([a-z0-9.]+)\/$/i);
	if (cocokKomposisi) {
		const kode = kodeDari(cocokKomposisi[1]);
		if (!komposisi[kode]) {
			return balas(res, 404, {
				error: `Symbol '${kode}.JK' not found in shareholders composition data.`
			});
		}
		return balas(res, 200, { symbol: `${kode}.JK`, year: tahunIni, data: komposisi[kode] });
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

	const cocokIndeks = path.match(/^\/index-daily\/([a-z0-9]+)\/$/i);
	if (cocokIndeks) {
		const kode = cocokIndeks[1].toLowerCase();
		const dasar = { ihsg: 7100, lq45: 820, idx30: 430 }[kode];
		if (!dasar) {
			return balas(res, 404, { error: 'index tidak dikenal' });
		}
		const mulai = url.searchParams.get('start') ?? hariLalu(30);
		const seri = [];
		for (let lalu = 120; lalu >= 1; lalu -= 1) {
			const tanggal = hariLalu(lalu);
			const hari = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
			if (tanggal < mulai || hari === 0 || hari === 6) continue;
			const urut = 120 - lalu;
			seri.push({
				index_code: kode.toUpperCase(),
				date: tanggal,
				price: Math.round(dasar * (1 + 0.03 * Math.sin(urut / 6) + 0.0006 * urut) * 100) / 100
			});
		}
		return balas(res, 200, seri);
	}

	if (path === '/foreign-flow/') {
		const urutan = url.searchParams.get('order_by') ?? '-net_foreign_inflow';
		const turun = urutan.startsWith('-');
		const daftar = [
			['ANTM', 294.6, 377.7],
			['BBCA', 182.4, 510.2],
			['TLKM', 96.1, 140.8],
			['ADRO', 12.5, 40.2],
			['ITMG', 3.2, 8.4],
			['PTBA', -8.7, 21.3],
			['MDKA', -45.3, 30.1],
			['INCO', -120.8, 60.4],
			['BBRI', -210.5, 330.9]
		]
			.map(([kode, bersih, beli]) => ({
				symbol: `${kode}.JK`,
				date: hariLalu(1),
				net_foreign_inflow: bersih * 1_000_000_000,
				foreign_buy_idr: beli * 1_000_000_000,
				foreign_sell_idr: (beli - bersih) * 1_000_000_000
			}))
			.sort((a, b) => (turun ? -1 : 1) * (a.net_foreign_inflow - b.net_foreign_inflow));
		return balas(res, 200, halaman(daftar, url));
	}

	const cocokHarian = path.match(/^\/daily\/([a-z0-9.]+)\/$/i);
	if (cocokHarian) {
		const mulai = url.searchParams.get('start') ?? hariLalu(30);
		return balas(res, 200, hargaHarian(kodeDari(cocokHarian[1]), mulai));
	}

	return balas(res, 404, { error: 'rute stub tidak dikenal' });
}).listen(port, '127.0.0.1', () => {
	process.stdout.write(`sectors stub siap di http://127.0.0.1:${port}\n`);
});
