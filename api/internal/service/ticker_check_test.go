package service

import "testing"

func TestCariTickerMendahulukanAwalanKode(t *testing.T) {
	s := &TickerService{ordered: []Ticker{
		{Code: "ADRO", Name: "Alamtri Resources Indonesia"},
		{Code: "ANTM", Name: "Aneka Tambang"},
		{Code: "BBCA", Name: "Bank Central Asia"},
		{Code: "BBRI", Name: "Bank Rakyat Indonesia"},
		{Code: "TLKM", Name: "Telkom Indonesia"},
	}}

	kode := func(daftar []Ticker) []string {
		hasil := make([]string, len(daftar))
		for i, ticker := range daftar {
			hasil[i] = ticker.Code
		}
		return hasil
	}

	if got := kode(s.Search("b", 3)); len(got) != 3 || got[0] != "BBCA" || got[1] != "BBRI" || got[2] != "ANTM" {
		t.Fatalf("awalan kode harus didahulukan, dapat %v", got)
	}
	if got := kode(s.Search("indonesia", 10)); len(got) != 3 || got[0] != "ADRO" || got[2] != "TLKM" {
		t.Fatalf("pencarian nama harus tetap jalan, dapat %v", got)
	}
	if got := kode(s.Search("", 2)); len(got) != 2 || got[0] != "ADRO" {
		t.Fatalf("kata kosong mengembalikan urutan awal, dapat %v", got)
	}
}
