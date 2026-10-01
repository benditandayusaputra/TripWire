package service

import (
	"math"
	"sort"
	"strings"
	"time"
)

const (
	jendelaLisensiHari = 365
	bobotProduksi      = 0.35
	bobotHarga         = 0.35
	bobotCadangan      = 0.30
	UnitKelipatan      = "x"
	UnitPersen         = "%"
)

type MiningLicense struct {
	LicenseID string    `json:"license_id"`
	Type      string    `json:"license_type,omitempty"`
	Commodity string    `json:"commodity"`
	Status    string    `json:"status"`
	Province  string    `json:"province,omitempty"`
	City      string    `json:"city,omitempty"`
	AreaHa    float64   `json:"licensed_area_ha,omitempty"`
	ExpiresAt time.Time `json:"expires_at"`
	Expired   bool      `json:"expired"`
}

type MineSite struct {
	Name             string   `json:"name"`
	Commodity        string   `json:"commodity"`
	Province         string   `json:"province"`
	City             string   `json:"city"`
	Region           string   `json:"region"`
	Latitude         *float64 `json:"latitude"`
	Longitude        *float64 `json:"longitude"`
	ProductionVolume *float64 `json:"production_volume"`
	Unit             string   `json:"unit,omitempty"`
	Year             int      `json:"year,omitempty"`
}

type ProductionRow struct {
	SubType            string   `json:"sub_type"`
	Unit               string   `json:"unit"`
	Production         float64  `json:"production"`
	PreviousProduction *float64 `json:"previous_production"`
	YoYPct             *float64 `json:"yoy_pct"`
}

type ProductionTrend struct {
	Commodity        string          `json:"commodity"`
	Year             int             `json:"year"`
	PreviousYear     int             `json:"previous_year"`
	Rows             []ProductionRow `json:"rows"`
	YoYPct           *float64        `json:"yoy_pct"`
	ReserveLifeYears *float64        `json:"reserve_life_years"`
	ReserveUnit      string          `json:"reserve_unit,omitempty"`
	Reserves         *float64        `json:"reserves"`
}

type PricePoint struct {
	Date  string  `json:"date"`
	Price float64 `json:"price"`
}

type CommodityPrice struct {
	Commodity    string       `json:"commodity"`
	Unit         string       `json:"unit"`
	Latest       float64      `json:"latest"`
	LatestDate   string       `json:"latest_date"`
	Previous     *float64     `json:"previous"`
	PreviousDate string       `json:"previous_date,omitempty"`
	YoYPct       *float64     `json:"yoy_pct"`
	Series       []PricePoint `json:"series"`
}

type MiningProfile struct {
	Slug         string   `json:"slug"`
	Name         string   `json:"name"`
	CompanyType  string   `json:"company_type"`
	KeyOperation string   `json:"key_operation"`
	Commodities  []string `json:"commodities"`
	SiteCount    int      `json:"site_count"`
}

type MiningData struct {
	Profile    MiningProfile
	Production *ProductionTrend
	Price      *CommodityPrice
	Licenses   []MiningLicense
	MineSites  []MineSite
}

type MetrikMentah struct {
	Key     string
	Label   string
	Unit    string
	Year    int
	Value   float64
	Average float64
	Basis   string
}

type MetricComparison struct {
	Key           string   `json:"key"`
	Label         string   `json:"label"`
	Unit          string   `json:"unit"`
	Year          int      `json:"year"`
	Value         float64  `json:"value"`
	SectorAverage float64  `json:"sector_average"`
	Difference    float64  `json:"difference"`
	DifferencePct *float64 `json:"difference_pct"`
	Position      string   `json:"position"`
	Basis         string   `json:"basis"`
}

type SectorSnapshot struct {
	Sector      string             `json:"sector"`
	SubSector   string             `json:"sub_sector"`
	Industry    string             `json:"industry"`
	SubIndustry string             `json:"sub_industry"`
	Metrics     []MetricComparison `json:"metrics"`
}

type ExposureComponents struct {
	ProductionTrend     *float64 `json:"production_trend"`
	CommodityPriceTrend *float64 `json:"commodity_price_trend"`
	ReserveLife         *float64 `json:"reserve_life"`
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
	MiningProfile     *MiningProfile     `json:"mining_profile,omitempty"`
	CommodityExposure *CommodityExposure `json:"commodity_exposure,omitempty"`
	ProductionTrend   *ProductionTrend   `json:"production_trend,omitempty"`
	CommodityPrice    *CommodityPrice    `json:"commodity_price,omitempty"`
	LicenseRadar      *LicenseRadar      `json:"license_radar,omitempty"`
	MineSites         []MineSite         `json:"mine_sites,omitempty"`
	DataSources       []string           `json:"data_sources"`
	ComputedAt        time.Time          `json:"computed_at"`
}

func BandingkanSektor(snapshot SectorSnapshot, mentah []MetrikMentah) SectorSnapshot {
	snapshot.Metrics = make([]MetricComparison, 0, len(mentah))

	for _, item := range mentah {
		if item.Average == 0 || math.IsNaN(item.Value) || math.IsNaN(item.Average) {
			continue
		}

		selisih := item.Value - item.Average
		baris := MetricComparison{
			Key:           item.Key,
			Label:         item.Label,
			Unit:          item.Unit,
			Year:          item.Year,
			Value:         bulatkan(item.Value),
			SectorAverage: bulatkan(item.Average),
			Difference:    bulatkan(selisih),
			Basis:         item.Basis,
		}

		if item.Unit == UnitPersen {
			baris.Position = posisiRelatif(selisih)
		} else {
			relatif := bulatkan(selisih / math.Abs(item.Average) * 100)
			baris.DifferencePct = &relatif
			baris.Position = posisiRelatif(relatif)
		}

		snapshot.Metrics = append(snapshot.Metrics, baris)
	}

	return snapshot
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

func HitungEksposurKomoditas(data MiningData) *CommodityExposure {
	var komponen ExposureComponents
	var total, bobot float64

	tambah := func(nilai *float64, w float64, skala func(float64) float64) *float64 {
		if nilai == nil {
			return nil
		}
		skor := bulatkan(batasi(skala(*nilai), 0, 100))
		total += skor * w
		bobot += w
		return &skor
	}

	komoditas := ""
	if data.Production != nil {
		komoditas = data.Production.Commodity
		komponen.ProductionTrend = tambah(data.Production.YoYPct, bobotProduksi, func(v float64) float64 { return 50 + v*2 })
	}
	if data.Price != nil {
		if komoditas == "" {
			komoditas = data.Price.Commodity
		}
		komponen.CommodityPriceTrend = tambah(data.Price.YoYPct, bobotHarga, func(v float64) float64 { return 50 + v*2 })
	}
	if data.Production != nil {
		komponen.ReserveLife = tambah(data.Production.ReserveLifeYears, bobotCadangan, func(v float64) float64 { return v * 5 })
	}

	if bobot == 0 {
		return nil
	}

	dasar := total / bobot
	faktor := faktorEntitas(data.Profile.CompanyType)
	skor := math.Min(100, dasar*faktor)

	return &CommodityExposure{
		Score:        bulatkan(skor),
		Category:     kategoriEksposur(skor),
		BaseScore:    bulatkan(dasar),
		Components:   komponen,
		EntityType:   normalTipeEntitas(data.Profile.CompanyType),
		EntityFactor: faktor,
		Commodity:    komoditas,
	}
}

func normalTipeEntitas(tipe string) string {
	normal := strings.Join(strings.Fields(strings.ToLower(tipe)), "_")
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
	batasDepan := sekarang.AddDate(0, 0, jendelaLisensiHari)
	batasLalu := sekarang.AddDate(0, 0, -jendelaLisensiHari)
	segera := make([]MiningLicense, 0, len(daftar))

	for _, lisensi := range daftar {
		if lisensi.ExpiresAt.IsZero() || lisensi.ExpiresAt.After(batasDepan) || lisensi.ExpiresAt.Before(batasLalu) {
			continue
		}
		lisensi.Expired = lisensi.ExpiresAt.Before(sekarang)
		segera = append(segera, lisensi)
	}

	sort.SliceStable(segera, func(i, j int) bool { return segera[i].ExpiresAt.Before(segera[j].ExpiresAt) })

	return LicenseRadar{
		WindowDays:      jendelaLisensiHari,
		TotalLicenses:   len(daftar),
		ExpiringSoon:    segera,
		HasExpiringSoon: len(segera) > 0,
	}
}

type barisProduksi struct {
	Commodity  string
	SubType    string
	Unit       string
	Production *float64
	Reserves   map[string]float64
}

var simbolKomoditas = map[string]string{
	"gold": "au", "silver": "ag", "copper": "cu", "nickel": "ni", "zinc and lead": "zn", "aluminium": "al",
}

func RingkasProduksi(komoditas []string, tahun int, kini []barisProduksi, tahunLalu int, lalu []barisProduksi) *ProductionTrend {
	fokus := pilihKomoditasFokus(komoditas, kini, lalu)
	if fokus == "" {
		return nil
	}

	kunci := func(b barisProduksi) string {
		return strings.ToLower(b.Commodity) + "|" + strings.ToLower(b.SubType) + "|" + strings.ToLower(b.Unit)
	}
	sebelumnya := map[string]float64{}
	for _, baris := range lalu {
		if strings.EqualFold(baris.Commodity, fokus) && baris.Production != nil && *baris.Production > 0 {
			sebelumnya[kunci(baris)] = *baris.Production
		}
	}

	tren := &ProductionTrend{Commodity: fokus, Year: tahun, PreviousYear: tahunLalu, Rows: []ProductionRow{}}
	produksiPerUnit := map[string]float64{}
	cadanganPerUnit := map[string]float64{}
	var jumlahYoY float64
	var adaYoY int

	for _, baris := range kini {
		if !strings.EqualFold(baris.Commodity, fokus) {
			continue
		}
		for unit, nilai := range baris.Reserves {
			cadanganPerUnit[unit] += nilai
		}
		if baris.Production == nil || *baris.Production <= 0 {
			continue
		}

		produksiPerUnit[strings.ToLower(baris.Unit)] += *baris.Production
		item := ProductionRow{SubType: baris.SubType, Unit: baris.Unit, Production: bulatkan(*baris.Production)}
		if nilaiLalu, ada := sebelumnya[kunci(baris)]; ada {
			yoy := bulatkan((*baris.Production - nilaiLalu) / nilaiLalu * 100)
			lampau := bulatkan(nilaiLalu)
			item.PreviousProduction = &lampau
			item.YoYPct = &yoy
			jumlahYoY += yoy
			adaYoY++
		}
		tren.Rows = append(tren.Rows, item)
	}

	if adaYoY > 0 {
		rata := bulatkan(jumlahYoY / float64(adaYoY))
		tren.YoYPct = &rata
	}

	unitUrut := make([]string, 0, len(produksiPerUnit))
	for unit := range produksiPerUnit {
		unitUrut = append(unitUrut, unit)
	}
	sort.Strings(unitUrut)
	for _, unit := range unitUrut {
		cadangan, ada := cadanganPerUnit[unit]
		if !ada || cadangan <= 0 {
			continue
		}
		umur := bulatkan(cadangan / produksiPerUnit[unit])
		total := bulatkan(cadangan)
		tren.ReserveLifeYears = &umur
		tren.Reserves = &total
		tren.ReserveUnit = satuanAsli(kini, fokus, unit)
		break
	}

	return tren
}

func pilihKomoditasFokus(komoditas []string, kini, lalu []barisProduksi) string {
	berproduksi := func(daftar []barisProduksi, nama string) bool {
		for _, baris := range daftar {
			if strings.EqualFold(baris.Commodity, nama) && baris.Production != nil && *baris.Production > 0 {
				return true
			}
		}
		return false
	}

	urutan := append([]string{}, komoditas...)
	for _, baris := range kini {
		urutan = append(urutan, baris.Commodity)
	}

	for _, nama := range urutan {
		if berproduksi(kini, nama) && berproduksi(lalu, nama) {
			return nama
		}
	}
	for _, nama := range urutan {
		if berproduksi(kini, nama) {
			return nama
		}
	}
	return ""
}

func satuanAsli(daftar []barisProduksi, komoditas, unitKecil string) string {
	for _, baris := range daftar {
		if strings.EqualFold(baris.Commodity, komoditas) && strings.ToLower(baris.Unit) == unitKecil {
			return baris.Unit
		}
	}
	return unitKecil
}

func cadanganSesuaiUnit(komoditas, unit string, cadangan map[string]*float64) (float64, bool) {
	unitKecil := strings.ToLower(unit)
	if unitKecil == "" {
		return 0, false
	}

	kandidat := []string{"total_reserves_" + unitKecil}
	if simbol, ada := simbolKomoditas[strings.ToLower(komoditas)]; ada {
		kandidat = append(kandidat, simbol+"_reserves_"+unitKecil)
	}

	for _, nama := range kandidat {
		for kunci, nilai := range cadangan {
			if nilai != nil && strings.ToLower(kunci) == nama {
				return *nilai, true
			}
		}
	}
	return 0, false
}

func RingkasHarga(komoditas, unit string, titik []PricePoint) *CommodityPrice {
	if len(titik) == 0 {
		return nil
	}

	urut := append([]PricePoint{}, titik...)
	sort.SliceStable(urut, func(i, j int) bool { return urut[i].Date < urut[j].Date })

	terakhir := urut[len(urut)-1]
	tanggalTerakhir, err := time.Parse("2006-01-02", terakhir.Date)
	if err != nil {
		return nil
	}

	hasil := &CommodityPrice{
		Commodity:  komoditas,
		Unit:       unit,
		Latest:     bulatkan(terakhir.Price),
		LatestDate: terakhir.Date,
		Series:     []PricePoint{},
	}

	target := tanggalTerakhir.AddDate(-1, 0, 0)
	awalSeri := tanggalTerakhir.AddDate(-1, 0, -15)
	var pembanding *PricePoint
	selisihTerkecil := math.MaxFloat64

	for i := range urut {
		tanggal, err := time.Parse("2006-01-02", urut[i].Date)
		if err != nil {
			continue
		}
		if !tanggal.Before(awalSeri) {
			hasil.Series = append(hasil.Series, PricePoint{Date: urut[i].Date, Price: bulatkan(urut[i].Price)})
		}
		selisih := math.Abs(tanggal.Sub(target).Hours())
		if selisih < selisihTerkecil && selisih <= 45*24 {
			selisihTerkecil = selisih
			pembanding = &urut[i]
		}
	}

	if pembanding != nil && pembanding.Price > 0 {
		lampau := bulatkan(pembanding.Price)
		yoy := bulatkan((terakhir.Price - pembanding.Price) / pembanding.Price * 100)
		hasil.Previous = &lampau
		hasil.PreviousDate = pembanding.Date
		hasil.YoYPct = &yoy
	}

	return hasil
}

func batasi(nilai, bawah, atas float64) float64 {
	return math.Max(bawah, math.Min(atas, nilai))
}
