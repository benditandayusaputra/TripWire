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

type Suspension struct {
	Date         time.Time `json:"date"`
	Reason       string    `json:"reason"`
	SeverityTier int       `json:"severity_tier"`
}

type InsiderTransaction struct {
	Date       time.Time `json:"date"`
	HolderName string    `json:"holder_name"`
	Type       string    `json:"transaction_type"`
	Value      float64   `json:"transaction_value"`
}

type OwnershipSnapshot struct {
	Date         time.Time `json:"date"`
	TopHolderPct float64   `json:"top_holder_percentage"`
	TopHolder    string    `json:"top_holder_name,omitempty"`
}

type RedFlagSignals struct {
	Suspensions  []Suspension
	Insiders     []InsiderTransaction
	Ownership    []OwnershipSnapshot
	FreeFloatPct float64
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
	OwnershipSnapshots  []OwnershipSnapshot  `json:"ownership_snapshots"`
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
	ComputedAt          time.Time             `json:"computed_at"`
}

func HitungRedFlag(sinyal RedFlagSignals, sekarang time.Time) RedFlagPayload {
	suspend := skorSuspend(sinyal.Suspensions, sekarang)

	jumlahInsider, arahInsider := ringkasInsider(sinyal.Insiders, sekarang, jendelaInsiderHari)
	insider := math.Min(100, float64(jumlahInsider)*20) * (0.4 + 0.6*math.Max(0, arahInsider))

	faktorFloat := faktorFreeFloat(sinyal.FreeFloatPct)
	delta90 := deltaKonsentrasi(sinyal.Ownership, sekarang, jendelaKepemilikanHari)
	owner := math.Min(100, delta90*10) * faktorFloat

	silang := polaSilang(sinyal, sekarang, jumlahInsider)

	dasar := suspend*0.3 + insider*0.4 + owner*0.3
	skor := math.Min(100, dasar*silang.MultiplierApplied)

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
			OwnershipSnapshots:  urutKepemilikan(sinyal.Ownership),
			FreeFloatPct:        bulatkan(sinyal.FreeFloatPct),
			FreeFloatFactor:     faktorFloat,
			InsiderCountWindow:  jumlahInsider,
			InsiderNetDirection: bulatkan(arahInsider),
			DeltaConcentration:  bulatkan(delta90),
		},
		ComputedAt: sekarang.UTC(),
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
		totalTier += nilaiKeparahan(tierKeparahan(item))
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

func tierKeparahan(item Suspension) int {
	if item.SeverityTier >= 1 && item.SeverityTier <= 3 {
		return item.SeverityTier
	}

	alasan := strings.ToLower(item.Reason)
	for _, kata := range []string{"dugaan", "pelanggaran", "sanksi", "investigasi", "manipulasi", "gagal bayar", "pailit"} {
		if strings.Contains(alasan, kata) {
			return 3
		}
	}

	if strings.Contains(alasan, "unusual market activity") {
		return 1
	}
	for _, kata := range strings.FieldsFunc(alasan, func(r rune) bool { return !('a' <= r && r <= 'z') && !('0' <= r && r <= '9') }) {
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

		nama := strings.ToLower(strings.TrimSpace(item.HolderName))
		if nama == "" {
			nama = strings.ToLower(strings.TrimSpace(item.Type))
		}
		pelaku[nama] = struct{}{}

		if transaksiJual(item.Type) {
			jual += math.Abs(item.Value)
		} else {
			beli += math.Abs(item.Value)
		}
	}

	arah := 0.0
	if jual+beli > 0 {
		arah = (jual - beli) / (jual + beli)
	}

	return len(pelaku), arah
}

func transaksiJual(jenis string) bool {
	normal := strings.ToLower(strings.TrimSpace(jenis))
	for _, kata := range []string{"sell", "sale", "jual", "divest", "dispos"} {
		if strings.Contains(normal, kata) {
			return true
		}
	}
	return false
}

func deltaKonsentrasi(snapshots []OwnershipSnapshot, sekarang time.Time, jendelaHari int) float64 {
	urut := urutKepemilikanNaik(snapshots, sekarang)
	if len(urut) < 2 {
		return 0
	}

	kini := urut[len(urut)-1]
	batas := sekarang.AddDate(0, 0, -jendelaHari)

	lampau := urut[0]
	for _, item := range urut {
		if !item.Date.After(batas) {
			lampau = item
		}
	}

	return math.Abs(kini.TopHolderPct - lampau.TopHolderPct)
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

	if deltaKonsentrasi(sinyal.Ownership, sekarang, jendelaPolaSilangHari) > ambangKepemilikanPP {
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
	hasil := append([]Suspension(nil), daftar...)
	for i := range hasil {
		hasil[i].SeverityTier = tierKeparahan(hasil[i])
	}
	sort.Slice(hasil, func(i, j int) bool { return hasil[i].Date.After(hasil[j].Date) })
	if hasil == nil {
		hasil = []Suspension{}
	}
	return hasil
}

func urutInsider(daftar []InsiderTransaction) []InsiderTransaction {
	hasil := append([]InsiderTransaction(nil), daftar...)
	sort.Slice(hasil, func(i, j int) bool { return hasil[i].Date.After(hasil[j].Date) })
	if hasil == nil {
		hasil = []InsiderTransaction{}
	}
	return hasil
}

func urutKepemilikan(daftar []OwnershipSnapshot) []OwnershipSnapshot {
	hasil := append([]OwnershipSnapshot(nil), daftar...)
	sort.Slice(hasil, func(i, j int) bool { return hasil[i].Date.After(hasil[j].Date) })
	if hasil == nil {
		hasil = []OwnershipSnapshot{}
	}
	return hasil
}

func urutKepemilikanNaik(daftar []OwnershipSnapshot, sekarang time.Time) []OwnershipSnapshot {
	hasil := make([]OwnershipSnapshot, 0, len(daftar))
	for _, item := range daftar {
		if item.Date.IsZero() || item.Date.After(sekarang) {
			continue
		}
		hasil = append(hasil, item)
	}
	sort.Slice(hasil, func(i, j int) bool { return hasil[i].Date.Before(hasil[j].Date) })
	return hasil
}
