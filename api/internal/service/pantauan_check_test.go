package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/benditandayusaputra/tripwire/api/internal/model"
	"github.com/benditandayusaputra/tripwire/api/internal/repository"
)

func TestCekBerikutMengikutiCronDanSyaratKondisi(t *testing.T) {
	jadwal, err := cron.ParseStandard("0 */6 * * *")
	if err != nil {
		t.Fatalf("cron: %v", err)
	}
	selasaSiang := time.Date(2026, 9, 29, 3, 10, 0, 0, time.UTC)

	kasus := []struct {
		nama    string
		tipe    string
		config  string
		harapan time.Time
	}{
		{"harian ikut scan berikutnya", model.ConditionDaily, `{}`, time.Date(2026, 9, 29, 6, 0, 0, 0, time.UTC)},
		{"mingguan Rabu mulai dari Rabu dini hari WIB", model.ConditionWeekly, `{"weekday":3}`, time.Date(2026, 9, 29, 18, 0, 0, 0, time.UTC)},
		{"berkala 8 jam jatuh di jam kelipatan 24", model.ConditionPeriodicCustom, `{"interval_hours":8}`, time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)},
	}

	for _, k := range kasus {
		kondisi := model.WatchCondition{ConditionType: k.tipe, Config: json.RawMessage(k.config), IsActive: true}
		waktu, ada := cekBerikut(jadwal, kondisi, selasaSiang)
		if !ada || !waktu.Equal(k.harapan) {
			t.Errorf("%s: dapat %v (%v), harusnya %v", k.nama, waktu, ada, k.harapan)
		}
		if ada && !jatuhTempo(repository.KondisiTerjadwal{ConditionType: k.tipe, Config: kondisi.Config}, waktu) {
			t.Errorf("%s: waktu %v tidak lolos syarat scheduler", k.nama, waktu)
		}
	}

	jarang := model.WatchCondition{ConditionType: model.ConditionPeriodicCustom, Config: json.RawMessage(`{"interval_hours":719}`)}
	if _, ada := cekBerikut(jadwal, jarang, selasaSiang); ada {
		t.Errorf("kondisi yang baru jatuh tempo lewat 62 hari harus dianggap belum terjadwal")
	}
}

func TestSusunRisikoMengambilSkorTerakhirDanSebelumnya(t *testing.T) {
	skor := func(nilai float64) *float64 { return &nilai }
	waktu := func(jam int) time.Time { return time.Date(2026, 9, 1, jam, 0, 0, 0, time.UTC) }

	risiko := susunRisiko([]repository.BarisRisiko{
		{ID: "a", Ticker: "ANTM", InsightType: InsightRedFlag, Score: skor(22), GeneratedAt: waktu(1), Jumlah: 4},
		{ID: "b", Ticker: "ANTM", InsightType: InsightMarketIntelligence, Subtype: SubtypeMiningDeepDive, Score: skor(40), GeneratedAt: waktu(2), Jumlah: 4},
		{ID: "c", Ticker: "ANTM", InsightType: InsightRedFlag, Score: skor(54), GeneratedAt: waktu(3), Jumlah: 4},
		{ID: "d", Ticker: "ANTM", InsightType: InsightRedFlag, Score: skor(91), GeneratedAt: waktu(4), Jumlah: 4},
		{ID: "e", Ticker: "BBCA", InsightType: InsightMarketIntelligence, Subtype: SubtypeSectorSnapshot, GeneratedAt: waktu(5), Jumlah: 1},
	})

	antm := risiko["ANTM"]
	if antm.RedFlag == nil || antm.RedFlag.ID != "d" || *antm.RedFlag.Score != 91 {
		t.Fatalf("red flag terakhir ANTM salah: %+v", antm.RedFlag)
	}
	if antm.SkorSebelum == nil || *antm.SkorSebelum != 54 {
		t.Errorf("skor sebelumnya ANTM harusnya 54, dapat %v", antm.SkorSebelum)
	}
	if len(antm.Riwayat) != 3 || antm.Riwayat[0].Skor != 22 || antm.Riwayat[2].Skor != 91 {
		t.Errorf("riwayat skor ANTM harus urut dari lama ke baru: %+v", antm.Riwayat)
	}
	if antm.Pasar == nil || antm.Pasar.ID != "b" || antm.Jumlah != 4 {
		t.Errorf("insight pasar atau jumlah ANTM salah: %+v %d", antm.Pasar, antm.Jumlah)
	}

	bbca := risiko["BBCA"]
	if bbca.RedFlag != nil || bbca.Riwayat == nil || len(bbca.Riwayat) != 0 || bbca.Pasar == nil {
		t.Errorf("emiten tanpa red flag harus punya riwayat kosong dan insight pasar: %+v", bbca)
	}
}
