package service

import (
	"encoding/json"
	"math"
	"testing"
	"time"
)

const laporanPPGL = `{"symbol":"PPGL.JK","company_name":"PT Prima Globalindo Logistik Tbk","overview":{"sector":"Transportation & Logistic","sub_sector":"Logistics & Deliveries","industry":"Logistics & Deliveries","sub_industry":"Logistics & Deliveries"},"valuation":{"historical_valuation":[{"pb":0.98,"pe":19.93,"ps":0.81,"year":2025,"pb_peer_avg":1.86,"pe_peer_avg":21.9,"ps_peer_avg":1.52},{"pb":9.71,"pe":null,"ps":null,"year":2026,"pb_peer_avg":1.4,"pe_peer_avg":11.55,"ps_peer_avg":1.25}]},"financials":{"historical_financials":[{"year":2024,"revenue":211734531294,"earnings":9543109256},{"year":2025,"revenue":175229924584,"earnings":7119221079}]},"ownership":{"major_shareholders":[{"name":"Darmawan Suryadi Sm","share_percentage":"0.5312"},{"name":"Public","share_percentage":"0.2408"},{"name":"Jap Astrid Patricia","share_percentage":"0.228"}],"top_transactions":null}}`

const suspensiPPGL = `{"results":[{"symbol":"PPGL.JK","suspension_date":"2026-09-02","reason":"Terjadinya peningkatan harga kumulatif yang signifikan pada saham PPGL.JK, dalam rangka cooling down sebagai bentuk perlindungan bagi investor","pdf_url":"https://www.idx.co.id/a.pdf"},{"symbol":"PPGL.JK","suspension_date":"2026-01-13","reason":"Terjadinya peningkatan harga kumulatif yang signifikan pada saham PPGL.JK","pdf_url":null},{"symbol":"PPGL.JK","suspension_date":"2026-01-09","reason":"Terjadinya peningkatan harga kumulatif yang signifikan pada saham PPGL.JK","pdf_url":null}],"pagination":{"total_count":3}}`

const filingPPGL = `{"results":[{"timestamp":"2026-09-24T09:51:26","symbol":"PPGL.JK","transaction_type":"sell","holder_type":"insider","holder_name":"Jap Astrid Patricia","transaction_value":59327533200.0,"share_percentage_before":22.8,"share_percentage_after":0.0,"source":"https://www.idx.co.id/b.pdf"}]}`

const kinerjaANTM2024 = `{"year":2024,"available_years":[2023,2024],"data":[{"year":2024,"commodity_type":"Gold","commodity_sub_type":null,"commodity_stats":{"unit":"koz","production_volume":35.94,"resources_reserves":{"total_reserves_Mt":805.0,"Au_reserves_koz":166.0,"Ag_reserves_koz":1398.0}}},{"year":2024,"commodity_type":"Nickel","commodity_sub_type":"Limonite & Saprolite Ore","commodity_stats":{"unit":"wmt","production_volume":9.94,"resources_reserves":{"total_reserves_wmt":null}}},{"year":2024,"commodity_type":"Nickel","commodity_sub_type":"Limonite Ore","commodity_stats":{"unit":"wmt","production_volume":null,"resources_reserves":{"total_reserves_wmt":113.91,"total_reserves_dmt":71.34}}},{"year":2024,"commodity_type":"Nickel","commodity_sub_type":"Saprolite Ore","commodity_stats":{"unit":"wmt","production_volume":null,"resources_reserves":{"total_reserves_wmt":380.0}}}]}`

const kinerjaANTM2023 = `{"year":2023,"available_years":[2023,2024],"data":[{"year":2023,"commodity_type":"Gold","commodity_sub_type":null,"commodity_stats":{"unit":"koz","production_volume":42.61,"resources_reserves":{"Au_reserves_koz":184.0}}}]}`

func dekode(t *testing.T, mentah string, tujuan any) {
	t.Helper()
	if err := json.Unmarshal([]byte(mentah), tujuan); err != nil {
		t.Fatalf("respons contoh tidak terbaca: %v", err)
	}
}

func dekat(t *testing.T, nama string, hasil, harapan float64) {
	t.Helper()
	if math.Abs(hasil-harapan) > 0.011 {
		t.Errorf("%s = %v, harusnya %v", nama, hasil, harapan)
	}
}

func TestTierKeparahanAlasanResmiIDX(t *testing.T) {
	kasus := map[string]int{
		"Terjadinya peningkatan harga kumulatif yang signifikan pada saham ASLI.JK":                         1,
		"Dalam rangka cooling down sebagai bentuk perlindungan bagi investor":                               1,
		"Keterlambatan penyampaian laporan keuangan":                                                        2,
		"Efek Perseroan telah berada dalam papan pemantauan khusus selama lebih dari 1 (satu) tahun":        3,
		"Sehubungan dengan adanya ketidakpastian atas kelangsungan usaha":                                   3,
		"Unusual Market Activity (UMA)":                                                                     1,
		"Permohonan Penundaan Kewajiban Pembayaran Utang terhadap Perseroan":                                3,
		"Belum melakukan pembayaran Biaya Pencatatan Tahunan":                                               2,
		"Terjadinya penurunan harga kumulatif yang signifikan pada saham FLMC.JK dalam rangka cooling down": 1,
	}
	for alasan, harapan := range kasus {
		if hasil := tierKeparahan(alasan); hasil != harapan {
			t.Errorf("tierKeparahan(%q) = %d, harusnya %d", alasan, hasil, harapan)
		}
	}
}

func TestRedFlagDariResponsAsliSectors(t *testing.T) {
	var mentah laporanMentah
	dekode(t, laporanPPGL, &mentah)
	laporan := mentah.urai()

	var susp daftarSuspensi
	dekode(t, suspensiPPGL, &susp)
	var filing daftarFiling
	dekode(t, filingPPGL, &filing)

	suspensi := []Suspension{}
	for _, item := range susp.Results {
		suspensi = append(suspensi, Suspension{Date: item.SuspensionDate.Time, Reason: item.Reason, PdfURL: item.PdfURL})
	}
	insider := []InsiderTransaction{}
	for _, item := range filing.Results {
		insider = append(insider, InsiderTransaction{
			Date: item.Timestamp.Time, HolderName: item.HolderName, Type: arahTransaksi(item.TransactionType),
			Value: item.TransactionValue.Nilai, SharePctBefore: item.SharePctBefore.ptr(), SharePctAfter: item.SharePctAfter.ptr(),
		})
	}

	dekat(t, "free float", laporan.freeFloat(), 24.08)
	if laporan.kandidatTambang() {
		t.Errorf("emiten logistik tidak boleh masuk mode tambang")
	}

	sekarang := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	hasil := HitungRedFlag(RedFlagSignals{
		Suspensions: suspensi, Insiders: insider,
		MajorShareholders: laporan.pemegangSaham(), FreeFloatPct: laporan.freeFloat(),
	}, sekarang)

	dekat(t, "sub skor suspensi", hasil.SubScores.Suspension, 60.5)
	dekat(t, "sub skor insider", hasil.SubScores.InsiderClustering, 20)
	dekat(t, "sub skor kepemilikan", hasil.SubScores.OwnershipChange, 100)
	dekat(t, "delta konsentrasi", hasil.SupportingData.DeltaConcentration, 22.8)
	dekat(t, "pengali pola silang", hasil.CrossPattern.MultiplierApplied, 1.3)
	dekat(t, "skor gabungan", hasil.GovernanceRiskScore, 73)
	if hasil.Category != "Tinggi" {
		t.Errorf("kategori = %s, harusnya Tinggi", hasil.Category)
	}
	if hasil.SupportingData.OwnershipChanges[0].HolderName != "Jap Astrid Patricia" {
		t.Errorf("perubahan kepemilikan terbesar salah pemegang: %+v", hasil.SupportingData.OwnershipChanges)
	}

	snapshot := BandingkanSektor(SectorSnapshot{SubSector: laporan.Overview.SubSector}, laporan.metrikValuasi())
	metrik := map[string]MetricComparison{}
	for _, baris := range snapshot.Metrics {
		metrik[baris.Key] = baris
	}
	if metrik["pb"].Year != 2026 || metrik["pe"].Year != 2025 {
		t.Errorf("tahun valuasi terbaru salah dipilih: %+v", snapshot.Metrics)
	}
	dekat(t, "selisih PE terhadap peer", *metrik["pe"].DifferencePct, -9)
}

func TestProduksiTambangDariResponsAsliSectors(t *testing.T) {
	var kini, lalu kinerjaTambang
	dekode(t, kinerjaANTM2024, &kini)
	dekode(t, kinerjaANTM2023, &lalu)

	tren := RingkasProduksi([]string{"Nickel", "Gold"}, kini.tahun(), kini.baris(2024), 2023, lalu.baris(2023))
	if tren == nil || tren.Commodity != "Gold" {
		t.Fatalf("komoditas fokus harusnya Gold karena hanya emas yang punya data dua tahun: %+v", tren)
	}
	dekat(t, "yoy produksi", *tren.YoYPct, -15.65)
	dekat(t, "umur cadangan", *tren.ReserveLifeYears, 4.62)

	nikel := RingkasProduksi([]string{"Nickel"}, 2024, kini.baris(2024), 2023, nil)
	dekat(t, "umur cadangan nikel", *nikel.ReserveLifeYears, 49.69)

	harga := RingkasHarga("Nickel", "USD/t", []PricePoint{
		{Date: "2025-02-15", Price: 15000}, {Date: "2025-08-01", Price: 16000}, {Date: "2026-02-15", Price: 17670.31},
	})
	dekat(t, "yoy harga", *harga.YoYPct, 17.8)

	eksposur := HitungEksposurKomoditas(MiningData{Profile: MiningProfile{CompanyType: "Mine Owner"}, Production: tren, Price: harga})
	if eksposur.EntityFactor != 1 || eksposur.EntityType != "mine_owner" {
		t.Errorf("tipe entitas mine owner salah dibaca: %+v", eksposur)
	}
	dekat(t, "skor eksposur", eksposur.Score, (18.7*0.35+85.6*0.35+23.1*0.30)/1.0)
}

const laporanHargaANTM = `{"symbol":"ANTM.JK","company_name":"Aneka Tambang Tbk.","overview":{"listing_board":"Main","sector":"Basic Materials","sub_sector":"Basic Materials","market_cap":77619370061750,"market_cap_rank":27,"last_close_price":3230,"latest_close_date":"2026-09-25","daily_close_change":-0.0122324159021407,"all_time_price":{"ytd_low":{"2026-06-04":2450},"52_w_low":{"2026-06-04":2450},"ytd_high":{"2026-01-26":4970},"52_w_high":{"2026-01-26":4970},"all_time_low":{"2015-12-14":285}},"esg_score":33.68,"indices":["IDXHIDIV20","LQ45","IDX30"]},"valuation":{"last_close_price":3230,"historical_valuation":[]}}`

func TestKutipanDariResponsAsliSectors(t *testing.T) {
	kutipan, ada := uraiKutipan("ANTM", json.RawMessage(laporanHargaANTM))
	if !ada {
		t.Fatalf("kutipan ANTM harus terbaca dari laporan emiten")
	}

	dekat(t, "harga penutupan", kutipan.Harga, 3230)
	dekat(t, "perubahan harian", *kutipan.PerubahanHarian*100, -1.22)
	dekat(t, "kapitalisasi pasar", *kutipan.Kapitalisasi/1e12, 77.62)
	dekat(t, "tertinggi 52 minggu", *kutipan.Tertinggi52, 4970)
	dekat(t, "terendah 52 minggu", *kutipan.Terendah52, 2450)
	if kutipan.TanggalTutup != "2026-09-25" || kutipan.Sektor != "Basic Materials" || len(kutipan.Indeks) != 3 {
		t.Errorf("kutipan tidak lengkap: %+v", kutipan)
	}

	if _, ada := uraiKutipan("PPGL", json.RawMessage(laporanPPGL)); ada {
		t.Errorf("laporan tanpa harga penutupan tidak boleh menghasilkan kutipan")
	}
}
