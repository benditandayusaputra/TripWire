package service

import (
	"math"
	"sort"
	"strings"
	"time"
)

const jendelaLisensiHari = 365

type MiningLicense struct {
	LicenseID     string    `json:"license_id"`
	Commodity     string    `json:"commodity"`
	Status        string    `json:"status"`
	ExpiresAt     time.Time `json:"expires_at"`
	DaysRemaining int       `json:"days_remaining"`
}

type MineSite struct {
	Name      string  `json:"name"`
	Commodity string  `json:"commodity"`
	Region    string  `json:"region"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type MiningData struct {
	CompanyType          string
	Commodity            string
	ProductionYoYPct     float64
	CommodityPriceYoYPct float64
	ReserveLifeYears     float64
	Licenses             []MiningLicense
	MineSites            []MineSite
}

type MetricComparison struct {
	Key           string  `json:"key"`
	Label         string  `json:"label"`
	Value         float64 `json:"value"`
	SectorAverage float64 `json:"sector_average"`
	DifferencePct float64 `json:"difference_pct"`
	Position      string  `json:"position"`
}

type SectorSnapshot struct {
	SubSector string             `json:"sub_sector"`
	Metrics   []MetricComparison `json:"metrics"`
}

type ExposureComponents struct {
	ProductionTrend     float64 `json:"production_trend"`
	CommodityPriceTrend float64 `json:"commodity_price_trend"`
	ReserveLife         float64 `json:"reserve_life"`
}

type CommodityExposure struct {
	Score        float64            `json:"score"`
	Category     string             `json:"category"`
	BaseScore    float64            `json:"base_score"`
	Components   ExposureComponents `json:"components"`
	EntityType   string             `json:"entity_type"`
	EntityFactor float64            `json:"entity_factor"`
	Commodity    string             `json:"commodity"`
}

type LicenseRadar struct {
	WindowDays      int             `json:"window_days"`
	TotalLicenses   int             `json:"total_licenses"`
	ExpiringSoon    []MiningLicense `json:"expiring_soon"`
	HasExpiringSoon bool            `json:"has_expiring_license"`
}

type MarketIntelPayload struct {
	Mode              string             `json:"mode"`
	SectorSnapshot    SectorSnapshot     `json:"sector_snapshot"`
	CommodityExposure *CommodityExposure `json:"commodity_exposure,omitempty"`
	LicenseRadar      *LicenseRadar      `json:"license_radar,omitempty"`
	MineSites         []MineSite         `json:"mine_sites,omitempty"`
	ComputedAt        time.Time          `json:"computed_at"`
}

var metrikSektor = []struct {
	Key   string
	Label string
}{
	{"pe", "Price to Earnings"},
	{"pb", "Price to Book"},
	{"roe", "Return on Equity"},
	{"net_profit_margin", "Net Profit Margin"},
}

func BandingkanSektor(subSector string, emiten, sektor map[string]float64) SectorSnapshot {
	metrics := make([]MetricComparison, 0, len(metrikSektor))

	for _, definisi := range metrikSektor {
		nilai, adaNilai := emiten[definisi.Key]
		rata, adaRata := sektor[definisi.Key]
		if !adaNilai || !adaRata || rata == 0 {
			continue
		}

		selisih := (nilai - rata) / math.Abs(rata) * 100
		metrics = append(metrics, MetricComparison{
			Key:           definisi.Key,
			Label:         definisi.Label,
			Value:         bulatkan(nilai),
			SectorAverage: bulatkan(rata),
			DifferencePct: bulatkan(selisih),
			Position:      posisiRelatif(selisih),
		})
	}

	return SectorSnapshot{SubSector: subSector, Metrics: metrics}
}

func posisiRelatif(selisih float64) string {
	switch {
	case selisih > 1:
		return "di atas rata rata sektor"
	case selisih < -1:
		return "di bawah rata rata sektor"
	default:
		return "setara rata rata sektor"
	}
}

func HitungEksposurKomoditas(data MiningData) CommodityExposure {
	produksi := batasi(50+data.ProductionYoYPct*2, 0, 100)
	harga := batasi(50+data.CommodityPriceYoYPct*2, 0, 100)
	cadangan := batasi(data.ReserveLifeYears*5, 0, 100)

	dasar := produksi*0.35 + harga*0.35 + cadangan*0.30
	faktor := faktorEntitas(data.CompanyType)
	skor := math.Min(100, dasar*faktor)

	return CommodityExposure{
		Score:     bulatkan(skor),
		Category:  kategoriEksposur(skor),
		BaseScore: bulatkan(dasar),
		Components: ExposureComponents{
			ProductionTrend:     bulatkan(produksi),
			CommodityPriceTrend: bulatkan(harga),
			ReserveLife:         bulatkan(cadangan),
		},
		EntityType:   normalTipeEntitas(data.CompanyType),
		EntityFactor: faktor,
		Commodity:    data.Commodity,
	}
}

func normalTipeEntitas(tipe string) string {
	normal := strings.ToLower(strings.TrimSpace(tipe))
	if normal == "" {
		return "unknown"
	}
	return normal
}

func faktorEntitas(tipe string) float64 {
	normal := normalTipeEntitas(tipe)
	switch {
	case strings.Contains(normal, "mine_owner"), strings.Contains(normal, "miner"), strings.Contains(normal, "operator"):
		return 1.0
	case strings.Contains(normal, "trading"), strings.Contains(normal, "trader"):
		return 0.7
	default:
		return 0.85
	}
}

func kategoriEksposur(skor float64) string {
	switch {
	case skor <= 30:
		return "Rendah"
	case skor <= 60:
		return "Sedang"
	case skor <= 85:
		return "Tinggi"
	default:
		return "Sangat Tinggi"
	}
}

func HitungRadarLisensi(daftar []MiningLicense, sekarang time.Time) LicenseRadar {
	batas := sekarang.AddDate(0, 0, jendelaLisensiHari)
	segera := make([]MiningLicense, 0, len(daftar))

	for _, lisensi := range daftar {
		if lisensi.ExpiresAt.IsZero() || lisensi.ExpiresAt.After(batas) {
			continue
		}
		lisensi.DaysRemaining = int(math.Floor(lisensi.ExpiresAt.Sub(sekarang).Hours() / 24))
		segera = append(segera, lisensi)
	}

	sort.Slice(segera, func(i, j int) bool { return segera[i].ExpiresAt.Before(segera[j].ExpiresAt) })

	return LicenseRadar{
		WindowDays:      jendelaLisensiHari,
		TotalLicenses:   len(daftar),
		ExpiringSoon:    segera,
		HasExpiringSoon: len(segera) > 0,
	}
}

func batasi(nilai, bawah, atas float64) float64 {
	return math.Max(bawah, math.Min(atas, nilai))
}
