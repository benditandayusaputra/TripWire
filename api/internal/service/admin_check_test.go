package service

import (
	"testing"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

func TestPerkiraanSisaHari(t *testing.T) {
	hari := func(credit ...int64) []sectorsclient.PemakaianHari {
		daftar := make([]sectorsclient.PemakaianHari, len(credit))
		for i, nilai := range credit {
			daftar[i].Credit = nilai
		}
		return daftar
	}

	if rata, sisa := PerkiraanSisaHari(hari(0, 0, 0), 500); rata != nil || sisa != nil {
		t.Fatalf("tanpa pemakaian harusnya kosong, dapat %v %v", rata, sisa)
	}

	rata, sisa := PerkiraanSisaHari(hari(0, 0, 0, 0, 30, 10, 20), 400)
	if rata == nil || *rata != 20 || *sisa != 20 {
		t.Fatalf("rata dihitung sejak hari pertama tercatat, dapat %v %v", *rata, *sisa)
	}

	if _, sisa := PerkiraanSisaHari(hari(40, 40), -10); *sisa != 0 {
		t.Fatalf("cadangan habis harusnya nol hari, dapat %d", *sisa)
	}
}
