package service

import (
	"math"
	"sort"
	"strings"
	"time"
)

const (
	jendelaInsiderHari     = 30
	jendelaKepemilikanHari = 90
	jendelaPolaSilangHari  = 30
	ambangKlasterInsider   = 2
	ambangKepemilikanPP    = 3.0
	ambangFreeFloatKecil   = 20.0
	faktorFreeFloatKecil   = 0.7
)

var (
	alasanSuspendSerius = []string{
		"kelangsungan usaha", "pemantauan khusus", "pkpu", "penundaan kewajiban", "pailit",
		"gagal bayar", "wanprestasi", "delisting", "penghapusan pencatatan", "dugaan", "pelanggaran",
		"sanksi", "investigasi", "penyelidikan", "manipulasi", "tidak menyatakan pendapat",
		"tidak memberikan pendapat",
	}
	alasanSuspendRutin = []string{
		"harga kumulatif", "cooling down", "unusual market activity", "aktivitas pasar",
	}
)

type Suspension struct {
	Date         time.Time `json:"date"`
	Reason       string    `json:"reason"`
	SeverityTier int       `json:"severity_tier"`
	PdfURL       string    `json:"pdf_url,omitempty"`
}

type InsiderTransaction struct {
	Date           time.Time `json:"date"`
	HolderName     string    `json:"holder_name"`
	HolderType     string    `json:"holder_type,omitempty"`
	Type           string    `json:"transaction_type"`
	Value          float64   `json:"transaction_value"`
	SharePctBefore *float64  `json:"share_pct_before,omitempty"`
	SharePctAfter  *float64  `json:"share_pct_after,omitempty"`
	SourceURL      string    `json:"source_url,omitempty"`
}

type Shareholder struct {
	Name       string  `json:"name"`
	Percentage float64 `json:"percentage"`
}

type OwnershipChange struct {
	HolderName     string    `json:"holder_name"`
	SharePctBefore float64   `json:"share_pct_before"`
	SharePctAfter  float64   `json:"share_pct_after"`
	DeltaPP        float64   `json:"delta_pp"`
	FirstDate      time.Time `json:"first_date"`
	LastDate       time.Time `json:"last_date"`
	Filings        int       `json:"filings"`
}

type RedFlagSignals struct {
	Suspensions       []Suspension
	Insiders          []InsiderTransaction
	MajorShareholders []Shareholder
	FreeFloatPct      float64
}

type RedFlagSubScores struct {
	Suspension        float64 `json:"suspension"`
	InsiderClustering float64 `json:"insider_clustering"`
	OwnershipChange   float64 `json:"ownership_change"`
}

type CrossPattern struct {
	SignalsActiveInWindow int      `json:"signals_active_in_window"`
	MultiplierApplied     float64  `json:"multiplier_applied"`
	WindowDays            int      `json:"window_days"`
	ActiveSignals         []string `json:"active_signals"`
}

type RedFlagSupportingData struct {
	Suspensions         []Suspension         `json:"suspensions"`
	InsiderTransactions []InsiderTransaction `json:"insider_transactions"`
	OwnershipChanges    []OwnershipChange    `json:"ownership_changes"`
	MajorShareholders   []Shareholder        `json:"major_shareholders"`
	FreeFloatPct        float64              `json:"free_float_pct"`
	FreeFloatFactor     float64              `json:"free_float_factor"`
	InsiderCountWindow  int                  `json:"insider_count_in_window"`
	InsiderNetDirection float64              `json:"insider_net_direction"`
	DeltaConcentration  float64              `json:"delta_concentration_pp"`
}

type RedFlagPayload struct {
	GovernanceRiskScore float64               `json:"governance_risk_score"`
	Category            string                `json:"category"`
	BaseScore           float64               `json:"base_score"`
	SubScores           RedFlagSubScores      `json:"sub_scores"`
	CrossPattern        CrossPattern          `json:"cross_pattern"`
	SupportingData      RedFlagSupportingData `json:"supporting_data"`
	DataSources         []string              `json:"data_sources"`
	ComputedAt          time.Time             `json:"computed_at"`
}

func HitungRedFlag(sinyal RedFlagSignals, sekarang time.Time) RedFlagPayload {
	suspend := skorSuspend(sinyal.Suspensions, sekarang)

	jumlahInsider, arahInsider := ringkasInsider(sinyal.Insiders, sekarang, jendelaInsiderHari)
	insider := math.Min(100, float64(jumlahInsider)*20) * (0.4 + 0.6*math.Max(0, arahInsider))

	faktorFloat := faktorFreeFloat(sinyal.FreeFloatPct)
	perubahan := perubahanKepemilikan(sinyal.Insiders, sekarang, jendelaKepemilikanHari)
	delta90 := deltaTerbesar(perubahan)
	owner := math.Min(100, delta90*10) * faktorFloat

	silang := polaSilang(sinyal, sekarang, jumlahInsider)

	dasar := suspend*0.3 + insider*0.4 + owner*0.3
	skor := math.Min(100, dasar*silang.MultiplierApplied)

	pemegang := append([]Shareholder{}, sinyal.MajorShareholders...)
	for i := range pemegang {
		pemegang[i].Percentage = bulatkan(pemegang[i].Percentage)
	}

	return RedFlagPayload{
		GovernanceRiskScore: bulatkan(skor),
		Category:            kategoriRisiko(skor),
		BaseScore:           bulatkan(dasar),
		SubScores: RedFlagSubScores{
			Suspension:        bulatkan(suspend),
			InsiderClustering: bulatkan(insider),
			OwnershipChange:   bulatkan(owner),
		},
		CrossPattern: silang,
		SupportingData: RedFlagSupportingData{
			Suspensions:         urutSuspensi(sinyal.Suspensions),
			InsiderTransactions: urutInsider(sinyal.Insiders),
			OwnershipChanges:    perubahan,
			MajorShareholders:   pemegang,
			FreeFloatPct:        bulatkan(sinyal.FreeFloatPct),
			FreeFloatFactor:     faktorFloat,
			InsiderCountWindow:  jumlahInsider,
			InsiderNetDirection: bulatkan(arahInsider),
			DeltaConcentration:  bulatkan(delta90),
		},
		DataSources: []string{},
		ComputedAt:  sekarang.UTC(),
	}
}

func skorSuspend(daftar []Suspension, sekarang time.Time) float64 {
	batas := sekarang.AddDate(-3, 0, 0)

	var terbaru time.Time
	var totalTier float64
	var dalamJendela int

	for _, item := range daftar {
		if item.Date.IsZero() || item.Date.After(sekarang) {
			continue
		}
		if item.Date.After(terbaru) {
			terbaru = item.Date
		}
		if item.Date.Before(batas) {
			continue
		}
		dalamJendela++
		totalTier += nilaiKeparahan(tierKeparahan(item.Reason))
	}

	frekuensi := math.Min(100, float64(dalamJendela)*25)
	recency := skorRecency(terbaru, sekarang)

	severity := 0.0
	if dalamJendela > 0 {
		severity = totalTier / float64(dalamJendela)
	}

	return frekuensi*0.3 + recency*0.3 + severity*0.4
}

func skorRecency(terakhir, sekarang time.Time) float64 {
	if terakhir.IsZero() || terakhir.After(sekarang) || terakhir.Before(sekarang.AddDate(-3, 0, 0)) {
		return 0
	}

	hari := sekarang.Sub(terakhir).Hours() / 24
	switch {
	case hari < 90:
		return 100
	case hari < 180:
		return 70
	case hari < 365:
		return 40
	default:
		return 15
	}
}

func nilaiKeparahan(tier int) float64 {
	switch tier {
	case 1:
		return 20
	case 3:
		return 100
	default:
		return 60
	}
}

func tierKeparahan(alasan string) int {
	normal := strings.ToLower(alasan)

	for _, kata := range alasanSuspendSerius {
		if strings.Contains(normal, kata) {
			return 3
		}
	}

	for _, kata := range alasanSuspendRutin {
		if strings.Contains(normal, kata) {
			return 1
		}
	}
	for _, kata := range strings.FieldsFunc(normal, func(r rune) bool { return !('a' <= r && r <= 'z') && !('0' <= r && r <= '9') }) {
		if kata == "uma" {
			return 1
		}
	}

	return 2
}

func ringkasInsider(daftar []InsiderTransaction, sekarang time.Time, jendelaHari int) (int, float64) {
	awal := sekarang.AddDate(0, 0, -jendelaHari)

	pelaku := make(map[string]struct{})
	var jual, beli float64

	for _, item := range daftar {
		if item.Date.IsZero() || item.Date.Before(awal) || item.Date.After(sekarang) {
			continue
		}

		pelaku[namaPemegang(item)] = struct{}{}

		switch arahTransaksi(item.Type) {
		case "sell":
			jual += math.Abs(item.Value)
		case "buy":
			beli += math.Abs(item.Value)
		}
	}

	arah := 0.0
	if jual+beli > 0 {
		arah = (jual - beli) / (jual + beli)
	}

	return len(pelaku), arah
}

func namaPemegang(item InsiderTransaction) string {
	nama := strings.ToLower(strings.Join(strings.Fields(item.HolderName), " "))
	if nama == "" {
		return strings.ToLower(strings.TrimSpace(item.Type))
	}
	return nama
}

func arahTransaksi(jenis string) string {
	normal := strings.ToLower(strings.TrimSpace(jenis))
	for _, kata := range []string{"sell", "sale", "jual", "divest", "dispos"} {
		if strings.Contains(normal, kata) {
			return "sell"
		}
	}
	for _, kata := range []string{"buy", "beli", "purchase", "acqui"} {
		if strings.Contains(normal, kata) {
			return "buy"
		}
	}
	return "others"
}

func perubahanKepemilikan(daftar []InsiderTransaction, sekarang time.Time, jendelaHari int) []OwnershipChange {
	awal := sekarang.AddDate(0, 0, -jendelaHari)

	urut := make([]InsiderTransaction, 0, len(daftar))
	for _, item := range daftar {
		if item.Date.IsZero() || item.Date.Before(awal) || item.Date.After(sekarang) {
			continue
		}
		if item.SharePctBefore == nil || item.SharePctAfter == nil {
			continue
		}
		urut = append(urut, item)
	}
	sort.SliceStable(urut, func(i, j int) bool { return urut[i].Date.Before(urut[j].Date) })

	indeks := map[string]int{}
	hasil := []OwnershipChange{}
	for _, item := range urut {
		kunci := namaPemegang(item)
		posisi, ada := indeks[kunci]
		if !ada {
			indeks[kunci] = len(hasil)
			hasil = append(hasil, OwnershipChange{
				HolderName:     strings.TrimSpace(item.HolderName),
				SharePctBefore: *item.SharePctBefore,
				FirstDate:      item.Date,
			})
			posisi = len(hasil) - 1
		}
		hasil[posisi].SharePctAfter = *item.SharePctAfter
		hasil[posisi].LastDate = item.Date
		hasil[posisi].Filings++
	}

	for i := range hasil {
		hasil[i].SharePctBefore = bulatkan(hasil[i].SharePctBefore)
		hasil[i].SharePctAfter = bulatkan(hasil[i].SharePctAfter)
		hasil[i].DeltaPP = bulatkan(hasil[i].SharePctAfter - hasil[i].SharePctBefore)
	}

	sort.SliceStable(hasil, func(i, j int) bool { return math.Abs(hasil[i].DeltaPP) > math.Abs(hasil[j].DeltaPP) })
	return hasil
}

func deltaTerbesar(daftar []OwnershipChange) float64 {
	terbesar := 0.0
	for _, item := range daftar {
		terbesar = math.Max(terbesar, math.Abs(item.DeltaPP))
	}
	return terbesar
}

func faktorFreeFloat(pct float64) float64 {
	if pct > 0 && pct < ambangFreeFloatKecil {
		return faktorFreeFloatKecil
	}
	return 1.0
}

func polaSilang(sinyal RedFlagSignals, sekarang time.Time, jumlahInsider int) CrossPattern {
	awal := sekarang.AddDate(0, 0, -jendelaPolaSilangHari)
	aktif := make([]string, 0, 3)

	for _, item := range sinyal.Suspensions {
		if !item.Date.IsZero() && !item.Date.Before(awal) && !item.Date.After(sekarang) {
			aktif = append(aktif, "suspension")
			break
		}
	}

	if jendelaPolaSilangHari != jendelaInsiderHari {
		jumlahInsider, _ = ringkasInsider(sinyal.Insiders, sekarang, jendelaPolaSilangHari)
	}
	if jumlahInsider >= ambangKlasterInsider {
		aktif = append(aktif, "insider_clustering")
	}

	if deltaTerbesar(perubahanKepemilikan(sinyal.Insiders, sekarang, jendelaPolaSilangHari)) > ambangKepemilikanPP {
		aktif = append(aktif, "ownership_change")
	}

	pengali := 1.0
	switch len(aktif) {
	case 2:
		pengali = 1.3
	case 3:
		pengali = 1.6
	}

	return CrossPattern{
		SignalsActiveInWindow: len(aktif),
		MultiplierApplied:     pengali,
		WindowDays:            jendelaPolaSilangHari,
		ActiveSignals:         aktif,
	}
}

func kategoriRisiko(skor float64) string {
	switch {
	case skor <= 30:
		return "Rendah"
	case skor <= 60:
		return "Sedang"
	case skor <= 85:
		return "Tinggi"
	default:
		return "Kritis"
	}
}

func bulatkan(nilai float64) float64 {
	return math.Round(nilai*100) / 100
}

func urutSuspensi(daftar []Suspension) []Suspension {
	hasil := append([]Suspension{}, daftar...)
	for i := range hasil {
		hasil[i].SeverityTier = tierKeparahan(hasil[i].Reason)
	}
	sort.SliceStable(hasil, func(i, j int) bool { return hasil[i].Date.After(hasil[j].Date) })
	return hasil
}

func urutInsider(daftar []InsiderTransaction) []InsiderTransaction {
	hasil := append([]InsiderTransaction{}, daftar...)
	sort.SliceStable(hasil, func(i, j int) bool { return hasil[i].Date.After(hasil[j].Date) })
	return hasil
}
