package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

const (
	InsightRedFlag            = "red_flag"
	InsightMarketIntelligence = "market_intelligence"

	SubtypeGovernanceComposite = "governance_risk_composite"
	SubtypeSectorSnapshot      = "sector_relative_snapshot"
	SubtypeMiningDeepDive      = "mining_deep_dive"

	ModeStandar = "standard"
	ModeTambang = "mining_deep"
)

var subSektorTambang = []string{"coal", "metal", "mineral", "mining", "oil, gas", "oil & gas", "tambang"}

type Insight struct {
	Ticker      string     `json:"ticker"`
	CompanyName string     `json:"company_name"`
	InsightType string     `json:"insight_type"`
	Subtype     string     `json:"subtype"`
	Score       *float64   `json:"score"`
	Payload     any        `json:"payload"`
	Meta        MarketMeta `json:"meta"`
}

type InsightService struct {
	client  *sectorsclient.Client
	tickers *TickerService
}

func NewInsightService(client *sectorsclient.Client, tickers *TickerService) *InsightService {
	return &InsightService{client: client, tickers: tickers}
}

func (s *InsightService) RedFlag(ctx context.Context, rawTicker string) (*Insight, error) {
	ticker, err := s.lookup(rawTicker)
	if err != nil {
		return nil, err
	}

	jejak := &jejakPanggilan{semuaCache: true}

	laporan, err := s.laporan(ctx, ticker.Code, jejak)
	if err != nil {
		return nil, err
	}

	sinyal := RedFlagSignals{
		Suspensions:  s.suspensi(ctx, ticker.Code, jejak),
		Insiders:     laporan.transaksiInsider(),
		Ownership:    laporan.snapshotKepemilikan(),
		FreeFloatPct: laporan.Ownership.FreeFloatPct,
	}

	payload := HitungRedFlag(sinyal, time.Now())
	skor := payload.GovernanceRiskScore

	return &Insight{
		Ticker:      ticker.Code,
		CompanyName: namaEmiten(ticker, laporan.CompanyName),
		InsightType: InsightRedFlag,
		Subtype:     SubtypeGovernanceComposite,
		Score:       &skor,
		Payload:     payload,
		Meta:        s.meta(ctx, jejak),
	}, nil
}

func (s *InsightService) MarketIntelligence(ctx context.Context, rawTicker string) (*Insight, error) {
	ticker, err := s.lookup(rawTicker)
	if err != nil {
		return nil, err
	}

	jejak := &jejakPanggilan{semuaCache: true}

	laporan, err := s.laporan(ctx, ticker.Code, jejak)
	if err != nil {
		return nil, err
	}

	sekarang := time.Now()
	payload := MarketIntelPayload{
		Mode:           ModeStandar,
		SectorSnapshot: BandingkanSektor(laporan.SubSector, laporan.Valuation, s.rataSektor(ctx, laporan.SubSector, jejak)),
		ComputedAt:     sekarang.UTC(),
	}

	insight := &Insight{
		Ticker:      ticker.Code,
		CompanyName: namaEmiten(ticker, laporan.CompanyName),
		InsightType: InsightMarketIntelligence,
		Subtype:     SubtypeSectorSnapshot,
	}

	if tambang := s.tambang(ctx, ticker.Code, laporan.SubSector, jejak); tambang != nil {
		eksposur := HitungEksposurKomoditas(*tambang)
		radar := HitungRadarLisensi(tambang.Licenses, sekarang)

		payload.Mode = ModeTambang
		payload.CommodityExposure = &eksposur
		payload.LicenseRadar = &radar
		payload.MineSites = tambang.MineSites

		insight.Subtype = SubtypeMiningDeepDive
		skor := eksposur.Score
		insight.Score = &skor
	}

	insight.Payload = payload
	insight.Meta = s.meta(ctx, jejak)

	return insight, nil
}

func (s *InsightService) lookup(rawTicker string) (Ticker, error) {
	ticker, err := s.tickers.Lookup(rawTicker)
	if err != nil {
		v := newValidationError()
		v.add("ticker", "Ticker tidak terdaftar di IDX")
		return Ticker{}, v
	}
	return ticker, nil
}

func namaEmiten(ticker Ticker, dariLaporan string) string {
	if dariLaporan != "" {
		return dariLaporan
	}
	return ticker.Name
}

type jejakPanggilan struct {
	semuaCache bool
}

func (j *jejakPanggilan) catat(hasil *sectorsclient.Hasil) {
	if hasil == nil || !hasil.Cached {
		j.semuaCache = false
	}
}

func (s *InsightService) meta(ctx context.Context, jejak *jejakPanggilan) MarketMeta {
	terpakai, tersisa := s.client.Kredit(ctx)
	return MarketMeta{
		Cached:           jejak.semuaCache,
		CreditsUsed:      terpakai,
		CreditsRemaining: tersisa,
		CreditBudget:     s.client.Budget(),
		CircuitOpen:      s.client.CircuitTerbuka(ctx),
	}
}

func (s *InsightService) laporan(ctx context.Context, kode string, jejak *jejakPanggilan) (*laporanEmiten, error) {
	hasil, err := s.client.Get(ctx, fmt.Sprintf("/company/report/%s/", strings.ToLower(kode)))
	if err != nil {
		return nil, err
	}
	jejak.catat(hasil)

	var laporan laporanEmiten
	if err := json.Unmarshal(hasil.Data, &laporan); err != nil {
		return nil, fmt.Errorf("%w: laporan emiten tidak terbaca", sectorsclient.ErrUpstreamGagal)
	}

	return &laporan, nil
}

func (s *InsightService) suspensi(ctx context.Context, kode string, jejak *jejakPanggilan) []Suspension {
	hasil, err := s.client.Get(ctx, fmt.Sprintf("/idx-suspension/%s/", strings.ToLower(kode)))
	if err != nil {
		return nil
	}
	jejak.catat(hasil)

	var isi riwayatSuspensi
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil
	}

	daftar := make([]Suspension, 0, len(isi.Suspensions))
	for _, item := range isi.Suspensions {
		daftar = append(daftar, Suspension{
			Date:         item.Date.Time,
			Reason:       item.Reason,
			SeverityTier: item.SeverityTier,
		})
	}

	return daftar
}

func (s *InsightService) rataSektor(ctx context.Context, subSector string, jejak *jejakPanggilan) map[string]float64 {
	slug := slugSubSektor(subSector)
	if slug == "" {
		return nil
	}

	hasil, err := s.client.Get(ctx, fmt.Sprintf("/subsector/report/%s/", slug))
	if err != nil {
		return nil
	}
	jejak.catat(hasil)

	var isi laporanSubSektor
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil
	}

	return isi.Valuation
}

func (s *InsightService) tambang(ctx context.Context, kode, subSector string, jejak *jejakPanggilan) *MiningData {
	if !subSektorTambangCocok(subSector) {
		return nil
	}

	hasil, err := s.client.Get(ctx, fmt.Sprintf("/company/mining/%s/", strings.ToLower(kode)))
	if err != nil {
		return nil
	}
	jejak.catat(hasil)

	var isi laporanTambang
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil
	}

	data := MiningData{
		CompanyType:          isi.CompanyType,
		Commodity:            isi.Commodity.Name,
		ProductionYoYPct:     isi.Production.YoYChangePct,
		CommodityPriceYoYPct: isi.Commodity.PriceYoYChangePct,
		ReserveLifeYears:     isi.Reserves.ReserveLifeYears,
		Licenses:             make([]MiningLicense, 0, len(isi.Licenses)),
		MineSites:            make([]MineSite, 0, len(isi.MineSites)),
	}

	for _, lisensi := range isi.Licenses {
		data.Licenses = append(data.Licenses, MiningLicense{
			LicenseID: lisensi.LicenseID,
			Commodity: lisensi.Commodity,
			Status:    lisensi.Status,
			ExpiresAt: lisensi.ExpiresAt.Time,
		})
	}

	for _, situs := range isi.MineSites {
		data.MineSites = append(data.MineSites, MineSite{
			Name:      situs.Name,
			Commodity: situs.Commodity,
			Region:    situs.Region,
			Latitude:  situs.Latitude,
			Longitude: situs.Longitude,
		})
	}

	return &data
}

func subSektorTambangCocok(subSector string) bool {
	normal := strings.ToLower(strings.TrimSpace(subSector))
	if normal == "" {
		return false
	}
	for _, kata := range subSektorTambang {
		if strings.Contains(normal, kata) {
			return true
		}
	}
	return false
}

func slugSubSektor(subSector string) string {
	normal := strings.ToLower(strings.TrimSpace(subSector))
	if normal == "" {
		return ""
	}

	var bangun strings.Builder
	tanda := false
	for _, r := range normal {
		switch {
		case ('a' <= r && r <= 'z') || ('0' <= r && r <= '9'):
			if tanda && bangun.Len() > 0 {
				bangun.WriteRune('-')
			}
			tanda = false
			bangun.WriteRune(r)
		default:
			tanda = true
		}
	}

	return bangun.String()
}

type tanggalFleksibel struct {
	time.Time
}

func (t *tanggalFleksibel) UnmarshalJSON(raw []byte) error {
	teks := strings.Trim(strings.TrimSpace(string(raw)), `"`)
	if teks == "" || teks == "null" {
		return nil
	}

	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02", "02/01/2006"} {
		if parsed, err := time.Parse(layout, teks); err == nil {
			t.Time = parsed
			return nil
		}
	}

	return nil
}

type laporanEmiten struct {
	Symbol      string             `json:"symbol"`
	CompanyName string             `json:"company_name"`
	SubSector   string             `json:"sub_sector"`
	Valuation   map[string]float64 `json:"valuation"`
	Ownership   struct {
		FreeFloatPct        float64 `json:"free_float_pct"`
		ShareholdersHistory []struct {
			Date                tanggalFleksibel `json:"date"`
			TopHolderName       string           `json:"top_holder_name"`
			TopHolderPercentage float64          `json:"top_holder_percentage"`
		} `json:"shareholders_history"`
	} `json:"ownership"`
	Filings []struct {
		Date             tanggalFleksibel `json:"date"`
		HolderName       string           `json:"holder_name"`
		TransactionType  string           `json:"transaction_type"`
		TransactionValue float64          `json:"transaction_value"`
	} `json:"filings"`
}

func (l *laporanEmiten) transaksiInsider() []InsiderTransaction {
	daftar := make([]InsiderTransaction, 0, len(l.Filings))
	for _, item := range l.Filings {
		daftar = append(daftar, InsiderTransaction{
			Date:       item.Date.Time,
			HolderName: item.HolderName,
			Type:       item.TransactionType,
			Value:      item.TransactionValue,
		})
	}
	return daftar
}

func (l *laporanEmiten) snapshotKepemilikan() []OwnershipSnapshot {
	daftar := make([]OwnershipSnapshot, 0, len(l.Ownership.ShareholdersHistory))
	for _, item := range l.Ownership.ShareholdersHistory {
		daftar = append(daftar, OwnershipSnapshot{
			Date:         item.Date.Time,
			TopHolderPct: item.TopHolderPercentage,
			TopHolder:    item.TopHolderName,
		})
	}
	return daftar
}

type riwayatSuspensi struct {
	Suspensions []struct {
		Date         tanggalFleksibel `json:"date"`
		Reason       string           `json:"reason"`
		SeverityTier int              `json:"severity_tier"`
	} `json:"suspensions"`
}

type laporanSubSektor struct {
	SubSector string             `json:"sub_sector"`
	Valuation map[string]float64 `json:"valuation"`
}

type laporanTambang struct {
	Symbol      string `json:"symbol"`
	CompanyType string `json:"company_type"`
	Production  struct {
		YoYChangePct float64 `json:"yoy_change_pct"`
	} `json:"production"`
	Commodity struct {
		Name              string  `json:"name"`
		PriceYoYChangePct float64 `json:"price_yoy_change_pct"`
	} `json:"commodity"`
	Reserves struct {
		ReserveLifeYears float64 `json:"reserve_life_years"`
	} `json:"reserves"`
	Licenses []struct {
		LicenseID string           `json:"license_id"`
		Commodity string           `json:"commodity"`
		Status    string           `json:"status"`
		ExpiresAt tanggalFleksibel `json:"expires_at"`
	} `json:"licenses"`
	MineSites []struct {
		Name      string  `json:"name"`
		Commodity string  `json:"commodity"`
		Region    string  `json:"region"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"mine_sites"`
}
