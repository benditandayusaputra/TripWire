package service

import "testing"

const manajemenANTM = `{"symbol":"ANTM.JK","company_name":"Aneka Tambang Tbk.","management":{"key_executives":[{"name":"Untung Budiharto","position":"President Director"},{"name":"Hartono","position":"Director"},{"name":"I Dewa Wirantaya","position":"Director"},{"name":"Handi Sutanto","position":"Director"},{"name":"Ratih Dewihandajani L.","position":"Director"},{"name":"Arini Kasmira","position":"Director"}],"executives_shareholdings":[{"name":"Arini Kasmira","position":"Director","share_amount":244000,"share_percentage":1e-05}]}}`

const laporanContohBBCA = `{"symbol":"BBCA.JK","company_name":"PT Bank Central Asia Tbk.","overview":{"listing_board":"Main","sector":"Financials","sub_sector":"Banks","address":"Menara BCA, Grand Indonesia\r\nJalan MH Thamrin No. 1\r\nJakarta 10310","employee_num":27937,"listing_date":"2000-05-31","website":"www.bca.co.id","phone":"021-23588000","last_close_price":6175,"latest_close_date":"2026-07-08","affiliates":["Djarum","Hartono"]},"ownership":{"major_shareholders":[{"name":"Pemegang Uji","share_value":1,"share_amount":2,"share_percentage":"0.1"},{"name":"PT Dwimuria Investama Andalan","share_value":418232441250000,"share_amount":67729950000,"share_percentage":"0.54942"}],"top_transactions":{"date":"2026-04-30","top_buyers":[{"name":"Fidelity Institutional Asset Management","changeAmount":186742480}],"top_sellers":[{"name":"Fidelity Management & Research Company LLC","changeAmount":-833622654}]},"institutional_transaction_flow":[{"date":"2026-04-30","net_transaction":-4575387238},{"date":"2026-03-31","net_transaction":null},{"date":"2026-02-28","net_transaction":120}],"whale_investors":["Anthoni Salim"],"conglomerates_group":["Djarum Group"]}}`

const komposisiContohBBCA = `{"symbol":"BBCA.JK","year":2026,"data":[{"date":"2026-05-31","individual_l":5,"total_l":5},{"date":"2026-06-30","shares_number":123275050000,"insurance_l":2347930190,"corporate_l":676811585,"pension_fund_l":326033400,"financial_institutions_l":437363600,"individual_l":11100401696,"mutual_fund_l":1218211444,"securities_companies_l":109436679,"foundation_l":73544460,"other_l":14203600,"total_l":16303936654,"insurance_f":551962796,"corporate_f":1223361552,"pension_fund_f":5139363015,"financial_institutions_f":2811510529,"individual_f":326180480,"mutual_fund_f":19268413209,"securities_companies_f":558727363,"foundation_f":298788705,"other_f":5971446817,"total_f":36149754466,"numbers_of_shareholders":797115,"change_in_shareholders":29745}]}`

func TestProfilEmitenDariResponsSectors(t *testing.T) {
	var laporan laporanProfil
	dekode(t, laporanContohBBCA, &laporan)
	profil := laporan.profil(Ticker{Code: "BBCA", Name: "Bank Central Asia Tbk."})

	if profil.CompanyName != "PT Bank Central Asia Tbk." {
		t.Errorf("nama emiten = %q", profil.CompanyName)
	}
	if profil.Perusahaan.Alamat != "Menara BCA, Grand Indonesia\nJalan MH Thamrin No. 1\nJakarta 10310" {
		t.Errorf("alamat = %q", profil.Perusahaan.Alamat)
	}
	if profil.Perusahaan.Situs != "https://www.bca.co.id" {
		t.Errorf("situs = %q", profil.Perusahaan.Situs)
	}
	if profil.Perusahaan.Karyawan == nil || *profil.Perusahaan.Karyawan != 27937 {
		t.Errorf("karyawan = %v", profil.Perusahaan.Karyawan)
	}

	if len(profil.PemegangSaham) != 2 || profil.PemegangSaham[0].Nama != "PT Dwimuria Investama Andalan" {
		t.Fatalf("pemegang saham tidak terurut dari porsi terbesar: %+v", profil.PemegangSaham)
	}
	dekat(t, "porsi Dwimuria", profil.PemegangSaham[0].Persen, 54.942)

	if profil.Grup[0] != "Djarum Group" || profil.InvestorKakap[0] != "Anthoni Salim" || len(profil.Afiliasi) != 2 {
		t.Errorf("grup, investor kakap, atau afiliasi hilang: %v %v %v", profil.Grup, profil.InvestorKakap, profil.Afiliasi)
	}

	institusi := profil.Institusi
	if institusi.Tanggal != "2026-04-30" || institusi.Pembeli[0].Perubahan != 186742480 || institusi.Penjual[0].Perubahan != -833622654 {
		t.Errorf("transaksi institusi = %+v", institusi)
	}
	if len(institusi.Arus) != 2 || institusi.Arus[0].Tanggal != "2026-02-28" {
		t.Errorf("arus institusi harus urut tanggal tanpa nilai kosong: %+v", institusi.Arus)
	}

	var manajemen manajemenMentah
	dekode(t, manajemenANTM, &manajemen)
	profil.isiManajemen(manajemen)
	if len(profil.Pejabat) != 6 || profil.Pejabat[0].Jabatan != "President Director" {
		t.Errorf("direksi = %+v", profil.Pejabat)
	}
	saham := profil.SahamPejabat
	if len(saham) != 1 || saham[0].Lembar == nil || *saham[0].Lembar != 244000 || saham[0].Persen == nil {
		t.Fatalf("saham direksi = %+v", saham)
	}
	dekat(t, "porsi saham direksi", *saham[0].Persen, 0.001)

	var komposisi komposisiMentah
	dekode(t, komposisiContohBBCA, &komposisi)
	terbaru := komposisi.terbaru()
	if terbaru == nil || terbaru.Tanggal != "2026-06-30" || len(terbaru.Kategori) != 9 {
		t.Fatalf("komposisi terbaru = %+v", terbaru)
	}
	if terbaru.Lokal != 16303936654 || terbaru.Asing != 36149754466 {
		t.Errorf("total lokal dan asing = %v dan %v", terbaru.Lokal, terbaru.Asing)
	}
	if terbaru.Pemegang == nil || *terbaru.Pemegang != 797115 {
		t.Errorf("jumlah pemegang = %v", terbaru.Pemegang)
	}
	if (komposisiMentah{}).terbaru() != nil {
		t.Errorf("komposisi kosong harus nil")
	}
}

func TestTautanSitusHanyaHttp(t *testing.T) {
	kasus := map[string]string{
		"www.bca.co.id":           "https://www.bca.co.id",
		"http://contoh.co.id":     "http://contoh.co.id",
		"javascript:alert(1)":     "",
		"JavaScript://%0aalert":   "",
		"data:text/html,<b>x</b>": "",
		"   ":                     "",
	}
	for masukan, harapan := range kasus {
		if hasil := tautanSitus(masukan); hasil != harapan {
			t.Errorf("tautanSitus(%q) = %q, harusnya %q", masukan, hasil, harapan)
		}
	}
}
