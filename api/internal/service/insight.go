package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"maps"
	"net/url"
	"strconv"
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

	batasHalaman       = 30
	jumlahSitusDetail  = 3
	ttlReferensi       = 7 * 24 * time.Hour
	basisPeer          = "peer_avg"
	basisSubSektor     = "subsector_weighted_avg"
	namaPemegangPublik = "public"
)

var (
	semuaBagianLaporan = []string{"overview", "valuation", "financials", "ownership"}
	ttlBagianLaporan   = map[string]time.Duration{
		"overview":   0,
		"valuation":  ttlReferensi,
		"financials": ttlReferensi,
		"ownership":  ttlReferensi,
	}
	kataKunciTambang = []string{"coal", "metal", "mineral", "mining", "gold", "nickel", "copper", "tambang"}
	satuanLogamMulia = map[string]string{"gold": "USD/oz", "silver": "USD/oz", "platinum": "USD/oz", "palladium": "USD/oz"}
)

type Insight struct {
	ID          string     `json:"id,omitempty"`
	Ticker      string     `json:"ticker"`
	CompanyName string     `json:"company_name"`
	InsightType string     `json:"insight_type"`
	Subtype     string     `json:"subtype"`
	Score       *float64   `json:"score"`
	Payload     any        `json:"payload"`
	Signature   string     `json:"signature,omitempty"`
	PrevHash    *string    `json:"prev_hash,omitempty"`
	CurrentHash string     `json:"current_hash,omitempty"`
	GeneratedAt *time.Time `json:"generated_at,omitempty"`
	Meta        MarketMeta `json:"meta"`
}

type InsightService struct {
	client     *sectorsclient.Client
	tickers    *TickerService
	integrity  *IntegrityService
	notifikasi *NotificationService
}

func NewInsightService(
	client *sectorsclient.Client,
	tickers *TickerService,
	integrity *IntegrityService,
	notifikasi *NotificationService,
) *InsightService {
	return &InsightService{client: client, tickers: tickers, integrity: integrity, notifikasi: notifikasi}
}

func pathLaporan(kode, bagian string) string {
	return fmt.Sprintf("/company/report/%s/?sections=%s", url.PathEscape(kode), bagian)
}

func ambilLaporan(ctx context.Context, client *sectorsclient.Client, kode string, bagian ...string) (*sectorsclient.Hasil, error) {
	mulai := time.Now()
	gabungan := map[string]json.RawMessage{}
	semuaCache := true

	for _, satu := range bagian {
		hasil, err := client.Get(ctx, pathLaporan(kode, satu), ttlBagianLaporan[satu], 1)
		if err != nil {
			return nil, err
		}
		var isi map[string]json.RawMessage
		if err := json.Unmarshal(hasil.Data, &isi); err != nil {
			return nil, fmt.Errorf("%w: laporan %s tidak terbaca", sectorsclient.ErrUpstreamGagal, kode)
		}
		maps.Copy(gabungan, isi)
		semuaCache = semuaCache && hasil.Cached
	}

	data, err := json.Marshal(gabungan)
	if err != nil {
		return nil, err
	}
	terpakai, tersisa := client.Kredit(ctx)
	return &sectorsclient.Hasil{
		Data:     data,
		Cached:   semuaCache,
		Latensi:  time.Since(mulai),
		Terpakai: terpakai,
		Tersisa:  tersisa,
	}, nil
}

func (s *InsightService) simpan(ctx context.Context, insight *Insight) (*Insight, error) {
	event, baru, err := s.integrity.Record(ctx, insight)
	if err != nil {
		return nil, err
	}

	generatedAt := event.GeneratedAt
	insight.ID = event.ID
	insight.Signature = event.Signature
	insight.PrevHash = event.PrevHash
	insight.CurrentHash = event.CurrentHash
	insight.GeneratedAt = &generatedAt

	if baru && s.notifikasi != nil {
		if _, err := s.notifikasi.Dispatch(ctx, insight); err != nil {
			log.Printf("insight: dispatch notifikasi %s gagal: %v", insight.ID, err)
		}
	}

	return insight, nil
}

func (s *InsightService) RedFlag(ctx context.Context, rawTicker string) (*Insight, error) {
	ticker, err := s.lookup(rawTicker)
	if err != nil {
		return nil, err
	}

	sekarang := time.Now()
	jejak := baruJejak()

	laporan, err := s.laporan(ctx, ticker.Code, jejak, "ownership")
	if err != nil {
		return nil, err
	}

	suspensi, err := s.suspensi(ctx, ticker.Code, jejak)
	if err != nil {
		return nil, err
	}

	filing, err := s.filing(ctx, ticker.Code, sekarang, jejak)
	if err != nil {
		return nil, err
	}

	payload := HitungRedFlag(RedFlagSignals{
		Suspensions:       suspensi,
		Insiders:          filing,
		MajorShareholders: laporan.pemegangSaham(),
		FreeFloatPct:      laporan.freeFloat(),
	}, sekarang)
	payload.DataSources = jejak.sumber
	skor := payload.GovernanceRiskScore

	return s.simpan(ctx, &Insight{
		Ticker:      ticker.Code,
		CompanyName: namaEmiten(ticker, laporan.CompanyName),
		InsightType: InsightRedFlag,
		Subtype:     SubtypeGovernanceComposite,
		Score:       &skor,
		Payload:     payload,
		Meta:        s.meta(ctx, jejak),
	})
}

func (s *InsightService) MarketIntelligence(ctx context.Context, rawTicker string) (*Insight, error) {
	ticker, err := s.lookup(rawTicker)
	if err != nil {
		return nil, err
	}

	sekarang := time.Now()
	jejak := baruJejak()

	laporan, err := s.laporan(ctx, ticker.Code, jejak, "overview", "valuation", "financials")
	if err != nil {
		return nil, err
	}

	snapshot, err := s.snapshotSektor(ctx, laporan, jejak)
	if err != nil {
		return nil, err
	}

	payload := MarketIntelPayload{
		Mode:           ModeStandar,
		SectorSnapshot: snapshot,
		ComputedAt:     sekarang.UTC(),
	}

	insight := &Insight{
		Ticker:      ticker.Code,
		CompanyName: namaEmiten(ticker, laporan.CompanyName),
		InsightType: InsightMarketIntelligence,
		Subtype:     SubtypeSectorSnapshot,
	}

	if laporan.kandidatTambang() {
		tambang, err := s.tambang(ctx, ticker.Code, jejak)
		if err != nil {
			return nil, err
		}

		if tambang != nil {
			radar := HitungRadarLisensi(tambang.Licenses, sekarang)
			profil := tambang.Profile

			payload.Mode = ModeTambang
			payload.MiningProfile = &profil
			payload.ProductionTrend = tambang.Production
			payload.CommodityPrice = tambang.Price
			payload.LicenseRadar = &radar
			payload.MineSites = tambang.MineSites
			payload.CommodityExposure = HitungEksposurKomoditas(*tambang)

			insight.Subtype = SubtypeMiningDeepDive
			if payload.CommodityExposure != nil {
				skor := payload.CommodityExposure.Score
				insight.Score = &skor
			}
		}
	}

	payload.DataSources = jejak.sumber
	insight.Payload = payload
	insight.Meta = s.meta(ctx, jejak)

	return s.simpan(ctx, insight)
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
	sumber     []string
}

func baruJejak() *jejakPanggilan {
	return &jejakPanggilan{semuaCache: true, sumber: []string{}}
}

func (j *jejakPanggilan) catat(path string, hasil *sectorsclient.Hasil) {
	if hasil == nil || !hasil.Cached {
		j.semuaCache = false
	}

	endpoint := path
	if posisi := strings.Index(endpoint, "?"); posisi >= 0 {
		endpoint = endpoint[:posisi]
	}
	for _, ada := range j.sumber {
		if ada == endpoint {
			return
		}
	}
	j.sumber = append(j.sumber, endpoint)
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

func (s *InsightService) ambil(ctx context.Context, jejak *jejakPanggilan, path string, ttl time.Duration, biaya int64, tujuan any) error {
	hasil, err := s.client.Get(ctx, path, ttl, biaya)
	if err != nil {
		return err
	}
	jejak.catat(path, hasil)

	if err := json.Unmarshal(hasil.Data, tujuan); err != nil {
		return fmt.Errorf("%w: respons %s tidak terbaca", sectorsclient.ErrUpstreamGagal, path)
	}
	return nil
}

func (s *InsightService) laporan(ctx context.Context, kode string, jejak *jejakPanggilan, bagian ...string) (*laporanEmiten, error) {
	hasil, err := ambilLaporan(ctx, s.client, kode, bagian...)
	if err != nil {
		return nil, err
	}
	jejak.catat(pathLaporan(kode, bagian[0]), hasil)

	var mentah laporanMentah
	if err := json.Unmarshal(hasil.Data, &mentah); err != nil {
		return nil, fmt.Errorf("%w: laporan %s tidak terbaca", sectorsclient.ErrUpstreamGagal, kode)
	}
	return mentah.urai(), nil
}

func (s *InsightService) suspensi(ctx context.Context, kode string, jejak *jejakPanggilan) ([]Suspension, error) {
	var isi daftarSuspensi
	path := fmt.Sprintf("/suspensions/?symbol=%s&limit=%d", url.QueryEscape(kode), batasHalaman)
	if err := s.ambil(ctx, jejak, path, 0, 1, &isi); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return []Suspension{}, nil
		}
		return nil, err
	}

	daftar := make([]Suspension, 0, len(isi.Results))
	for _, item := range isi.Results {
		if !simbolCocok(item.Symbol, kode) || item.SuspensionDate.IsZero() {
			continue
		}
		daftar = append(daftar, Suspension{
			Date:   item.SuspensionDate.Time,
			Reason: strings.TrimSpace(item.Reason),
			PdfURL: item.PdfURL,
		})
	}
	return daftar, nil
}

func (s *InsightService) filing(ctx context.Context, kode string, sekarang time.Time, jejak *jejakPanggilan) ([]InsiderTransaction, error) {
	var isi daftarFiling
	mulai := sekarang.In(zonaJakarta()).AddDate(0, 0, -jendelaKepemilikanHari).Format("2006-01-02")
	path := fmt.Sprintf("/filings/?symbol=%s&start=%s&limit=%d", url.QueryEscape(kode), mulai, batasHalaman)
	if err := s.ambil(ctx, jejak, path, 0, 1, &isi); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return []InsiderTransaction{}, nil
		}
		return nil, err
	}

	daftar := make([]InsiderTransaction, 0, len(isi.Results))
	for _, item := range isi.Results {
		if !simbolCocok(item.Symbol, kode) || item.Timestamp.IsZero() {
			continue
		}
		daftar = append(daftar, InsiderTransaction{
			Date:           item.Timestamp.Time,
			HolderName:     strings.TrimSpace(item.HolderName),
			HolderType:     item.HolderType,
			Type:           arahTransaksi(item.TransactionType),
			Value:          item.TransactionValue.Nilai,
			SharePctBefore: item.SharePctBefore.ptr(),
			SharePctAfter:  item.SharePctAfter.ptr(),
			SourceURL:      item.Source,
		})
	}
	return daftar, nil
}

func (s *InsightService) snapshotSektor(ctx context.Context, laporan *laporanEmiten, jejak *jejakPanggilan) (SectorSnapshot, error) {
	snapshot := SectorSnapshot{
		Sector:      laporan.Overview.Sector,
		SubSector:   laporan.Overview.SubSector,
		Industry:    laporan.Overview.Industry,
		SubIndustry: laporan.Overview.SubIndustry,
	}

	mentah := laporan.metrikValuasi()

	if slug := slugSubSektor(laporan.Overview.SubSector); slug != "" {
		var isi laporanSubSektor
		path := fmt.Sprintf("/subsector/report/%s/?sections=growth", url.PathEscape(slug))
		err := s.ambil(ctx, jejak, path, ttlReferensi, 1, &isi)
		switch {
		case err == nil:
			mentah = append(mentah, laporan.metrikPertumbuhan(isi)...)
		case !errors.Is(err, sectorsclient.ErrTidakDitemukan):
			return snapshot, err
		}
	}

	return BandingkanSektor(snapshot, mentah), nil
}

func (s *InsightService) tambang(ctx context.Context, kode string, jejak *jejakPanggilan) (*MiningData, error) {
	var hasilCari daftarPerusahaanTambang
	path := fmt.Sprintf("/mining/companies/?keyword=%s&limit=%d", url.QueryEscape(kode), batasHalaman)
	if err := s.ambil(ctx, jejak, path, ttlReferensi, 1, &hasilCari); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return nil, nil
		}
		return nil, err
	}

	slug := ""
	for _, item := range hasilCari.Results {
		if item.Symbol != nil && simbolCocok(*item.Symbol, kode) {
			slug = item.Slug
			break
		}
	}
	if slug == "" {
		return nil, nil
	}

	var detail detailTambang
	if err := s.ambil(ctx, jejak, fmt.Sprintf("/mining/companies/%s/", url.PathEscape(slug)), ttlReferensi, 1, &detail); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return nil, nil
		}
		return nil, err
	}

	data := &MiningData{
		Profile: MiningProfile{
			Slug:         slug,
			Name:         detail.Name,
			CompanyType:  detail.CompanyType,
			KeyOperation: detail.KeyOperation,
			Commodities:  nonNil(detail.CommodityType),
			SiteCount:    detail.MiningSiteCount,
		},
		Licenses:  detail.lisensi(),
		MineSites: []MineSite{},
	}

	produksi, err := s.produksiTambang(ctx, slug, detail.CommodityType, jejak)
	if err != nil {
		return nil, err
	}
	data.Production = produksi

	komoditasHarga := ""
	if produksi != nil {
		komoditasHarga = produksi.Commodity
	} else if len(detail.CommodityType) > 0 {
		komoditasHarga = detail.CommodityType[0]
	}
	if komoditasHarga != "" {
		harga, err := s.hargaKomoditas(ctx, komoditasHarga, jejak)
		if err != nil {
			return nil, err
		}
		data.Price = harga
	}

	situs, err := s.situsTambang(ctx, slug, jejak)
	if err != nil {
		return nil, err
	}
	data.MineSites = situs

	return data, nil
}

func (s *InsightService) produksiTambang(ctx context.Context, slug string, komoditas []string, jejak *jejakPanggilan) (*ProductionTrend, error) {
	var kini kinerjaTambang
	if err := s.ambil(ctx, jejak, fmt.Sprintf("/mining/companies/performance/%s/", url.PathEscape(slug)), ttlReferensi, 1, &kini); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return nil, nil
		}
		return nil, err
	}

	tahun := kini.tahun()
	if tahun == 0 {
		return nil, nil
	}

	var lalu kinerjaTambang
	tahunLalu := tahun - 1
	if kini.tersedia(tahunLalu) {
		path := fmt.Sprintf("/mining/companies/performance/%s/?year=%d", url.PathEscape(slug), tahunLalu)
		if err := s.ambil(ctx, jejak, path, ttlReferensi, 1, &lalu); err != nil && !errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return nil, err
		}
	}

	return RingkasProduksi(komoditas, tahun, kini.baris(tahun), tahunLalu, lalu.baris(tahunLalu)), nil
}

func (s *InsightService) hargaKomoditas(ctx context.Context, komoditas string, jejak *jejakPanggilan) (*CommodityPrice, error) {
	var mentah []map[string]json.RawMessage
	path := fmt.Sprintf("/mining/commodities/%s/price/", url.PathEscape(strings.ToLower(komoditas)))
	if err := s.ambil(ctx, jejak, path, ttlReferensi, 1, &mentah); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return nil, nil
		}
		return nil, err
	}

	unit := ""
	titik := make([]PricePoint, 0, len(mentah))
	for _, baris := range mentah {
		var tanggal string
		if err := json.Unmarshal(baris["date"], &tanggal); err != nil || len(tanggal) < 10 {
			continue
		}
		for kunci, nilai := range baris {
			if !strings.HasPrefix(kunci, "price") {
				continue
			}
			var angka angkaFleksibel
			if err := json.Unmarshal(nilai, &angka); err != nil || !angka.Ada {
				continue
			}
			if unit == "" {
				unit = satuanHarga(kunci)
			}
			titik = append(titik, PricePoint{Date: tanggal[:10], Price: angka.Nilai})
			break
		}
	}

	if satuan, ada := satuanLogamMulia[strings.ToLower(komoditas)]; ada {
		unit = satuan
	}

	return RingkasHarga(komoditas, unit, titik), nil
}

func (s *InsightService) situsTambang(ctx context.Context, slug string, jejak *jejakPanggilan) ([]MineSite, error) {
	var daftar daftarSitus
	path := fmt.Sprintf("/mining/sites/?company=%s&limit=%d", url.QueryEscape(slug), batasHalaman)
	if err := s.ambil(ctx, jejak, path, ttlReferensi, 1, &daftar); err != nil {
		if errors.Is(err, sectorsclient.ErrTidakDitemukan) {
			return []MineSite{}, nil
		}
		return nil, err
	}

	situs := make([]MineSite, 0, len(daftar.Results))
	for urutan, item := range daftar.Results {
		satu := MineSite{
			Name:             item.Name,
			Commodity:        item.CommodityType,
			Province:         item.Province,
			City:             item.City,
			Region:           gabungWilayah(item.City, item.Province),
			ProductionVolume: item.ProductionVolume.ptr(),
			Unit:             item.Unit,
			Year:             item.Year,
		}

		if urutan < jumlahSitusDetail && item.Slug != "" {
			var detail detailSitus
			err := s.ambil(ctx, jejak, fmt.Sprintf("/mining/sites/%s/", url.PathEscape(item.Slug)), ttlReferensi, 1, &detail)
			switch {
			case err == nil:
				satu.Latitude = detail.Location.Latitude.ptr()
				satu.Longitude = detail.Location.Longitude.ptr()
				if satu.Province == "" {
					satu.Province = detail.Location.Province
				}
				if satu.City == "" {
					satu.City = detail.Location.City
				}
				satu.Region = gabungWilayah(satu.City, satu.Province)
			case !errors.Is(err, sectorsclient.ErrTidakDitemukan):
				return nil, err
			}
		}

		situs = append(situs, satu)
	}

	return situs, nil
}

func simbolCocok(simbol, kode string) bool {
	if strings.TrimSpace(simbol) == "" {
		return true
	}
	return strings.EqualFold(strings.TrimSuffix(strings.ToUpper(strings.TrimSpace(simbol)), ".JK"), kode)
}

func gabungWilayah(kota, provinsi string) string {
	bagian := make([]string, 0, 2)
	for _, nilai := range []string{kota, provinsi} {
		if strings.TrimSpace(nilai) != "" {
			bagian = append(bagian, strings.TrimSpace(nilai))
		}
	}
	return strings.Join(bagian, ", ")
}

func satuanHarga(kunci string) string {
	bagian := strings.Split(strings.TrimPrefix(strings.TrimPrefix(kunci, "price"), "_"), "_per_")
	if len(bagian) != 2 {
		return strings.ToUpper(strings.ReplaceAll(strings.TrimPrefix(kunci, "price_"), "_", " "))
	}
	satuan := map[string]string{"ton": "t", "tonne": "t", "troy_ounce": "oz", "ounce": "oz"}[bagian[1]]
	if satuan == "" {
		satuan = bagian[1]
	}
	return strings.ToUpper(bagian[0]) + "/" + satuan
}

func nonNil(daftar []string) []string {
	if daftar == nil {
		return []string{}
	}
	return daftar
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

	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05.999999", "2006-01-02T15:04:05", "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, teks); err == nil {
			t.Time = parsed
			return nil
		}
	}

	return nil
}

type angkaFleksibel struct {
	Nilai float64
	Ada   bool
}

func (a *angkaFleksibel) UnmarshalJSON(raw []byte) error {
	teks := strings.Trim(strings.TrimSpace(string(raw)), `"`)
	if teks == "" || teks == "null" {
		return nil
	}
	if nilai, err := strconv.ParseFloat(teks, 64); err == nil {
		a.Nilai, a.Ada = nilai, true
	}
	return nil
}

func (a angkaFleksibel) ptr() *float64 {
	if !a.Ada {
		return nil
	}
	nilai := a.Nilai
	return &nilai
}

type laporanMentah struct {
	Symbol      string          `json:"symbol"`
	CompanyName string          `json:"company_name"`
	Overview    json.RawMessage `json:"overview"`
	Valuation   json.RawMessage `json:"valuation"`
	Financials  json.RawMessage `json:"financials"`
	Ownership   json.RawMessage `json:"ownership"`
}

type laporanEmiten struct {
	Symbol      string
	CompanyName string
	Overview    struct {
		Sector      string `json:"sector"`
		SubSector   string `json:"sub_sector"`
		Industry    string `json:"industry"`
		SubIndustry string `json:"sub_industry"`
	}
	Valuation struct {
		HistoricalValuation []struct {
			Year   angkaFleksibel `json:"year"`
			PE     angkaFleksibel `json:"pe"`
			PB     angkaFleksibel `json:"pb"`
			PS     angkaFleksibel `json:"ps"`
			PEPeer angkaFleksibel `json:"pe_peer_avg"`
			PBPeer angkaFleksibel `json:"pb_peer_avg"`
			PSPeer angkaFleksibel `json:"ps_peer_avg"`
		} `json:"historical_valuation"`
	}
	Financials struct {
		HistoricalFinancials []struct {
			Year     angkaFleksibel `json:"year"`
			Revenue  angkaFleksibel `json:"revenue"`
			Earnings angkaFleksibel `json:"earnings"`
		} `json:"historical_financials"`
	}
	Ownership struct {
		MajorShareholders []struct {
			Name            string         `json:"name"`
			SharePercentage angkaFleksibel `json:"share_percentage"`
		} `json:"major_shareholders"`
	}
}

func (m laporanMentah) urai() *laporanEmiten {
	laporan := &laporanEmiten{Symbol: m.Symbol, CompanyName: strings.TrimSpace(m.CompanyName)}
	uraiLonggar(m.Overview, &laporan.Overview)
	uraiLonggar(m.Valuation, &laporan.Valuation)
	uraiLonggar(m.Financials, &laporan.Financials)
	uraiLonggar(m.Ownership, &laporan.Ownership)
	return laporan
}

func uraiLonggar(mentah json.RawMessage, tujuan any) {
	if len(mentah) == 0 {
		return
	}
	if err := json.Unmarshal(mentah, tujuan); err != nil {
		log.Printf("insight: bagian laporan Sectors dilewati karena bentuknya tidak dikenali: %v", err)
	}
}

func persenKepemilikan(nilai float64) float64 {
	if nilai <= 1 {
		return nilai * 100
	}
	return nilai
}

func (l *laporanEmiten) pemegangSaham() []Shareholder {
	daftar := make([]Shareholder, 0, len(l.Ownership.MajorShareholders))
	for _, item := range l.Ownership.MajorShareholders {
		if !item.SharePercentage.Ada || strings.TrimSpace(item.Name) == "" {
			continue
		}
		daftar = append(daftar, Shareholder{
			Name:       strings.TrimSpace(item.Name),
			Percentage: persenKepemilikan(item.SharePercentage.Nilai),
		})
	}
	return daftar
}

func (l *laporanEmiten) freeFloat() float64 {
	for _, item := range l.Ownership.MajorShareholders {
		if strings.EqualFold(strings.TrimSpace(item.Name), namaPemegangPublik) && item.SharePercentage.Ada {
			return persenKepemilikan(item.SharePercentage.Nilai)
		}
	}
	return 0
}

func (l *laporanEmiten) kandidatTambang() bool {
	gabungan := strings.ToLower(strings.Join([]string{
		l.Overview.SubSector, l.Overview.Industry, l.Overview.SubIndustry,
	}, " "))
	for _, kata := range kataKunciTambang {
		if strings.Contains(gabungan, kata) {
			return true
		}
	}
	return false
}

func (l *laporanEmiten) metrikValuasi() []MetrikMentah {
	definisi := []struct {
		key, label string
		nilai      func(i int) (angkaFleksibel, angkaFleksibel)
	}{
		{"pe", "Price to Earnings", func(i int) (angkaFleksibel, angkaFleksibel) {
			v := l.Valuation.HistoricalValuation[i]
			return v.PE, v.PEPeer
		}},
		{"pb", "Price to Book", func(i int) (angkaFleksibel, angkaFleksibel) {
			v := l.Valuation.HistoricalValuation[i]
			return v.PB, v.PBPeer
		}},
		{"ps", "Price to Sales", func(i int) (angkaFleksibel, angkaFleksibel) {
			v := l.Valuation.HistoricalValuation[i]
			return v.PS, v.PSPeer
		}},
	}

	hasil := make([]MetrikMentah, 0, len(definisi))
	for _, d := range definisi {
		tahunTerbaik := 0
		var pilihan MetrikMentah
		for i, baris := range l.Valuation.HistoricalValuation {
			nilai, rata := d.nilai(i)
			tahun := int(baris.Year.Nilai)
			if !nilai.Ada || !rata.Ada || tahun < tahunTerbaik {
				continue
			}
			tahunTerbaik = tahun
			pilihan = MetrikMentah{
				Key: d.key, Label: d.label, Unit: UnitKelipatan, Year: tahun,
				Value: nilai.Nilai, Average: rata.Nilai, Basis: basisPeer,
			}
		}
		if tahunTerbaik > 0 {
			hasil = append(hasil, pilihan)
		}
	}
	return hasil
}

func (l *laporanEmiten) pertumbuhan(tahun int, ambil func(i int) angkaFleksibel) (float64, bool) {
	var kini, lalu *float64
	for i, baris := range l.Financials.HistoricalFinancials {
		nilai := ambil(i)
		if !nilai.Ada {
			continue
		}
		switch int(baris.Year.Nilai) {
		case tahun:
			kini = nilai.ptr()
		case tahun - 1:
			lalu = nilai.ptr()
		}
	}
	if kini == nil || lalu == nil || *lalu == 0 {
		return 0, false
	}
	return (*kini - *lalu) / abs(*lalu) * 100, true
}

func (l *laporanEmiten) metrikPertumbuhan(sektor laporanSubSektor) []MetrikMentah {
	tahunTerbaru := 0
	for tahunTeks := range sektor.Growth.WeightedAvgGrowthData {
		tahun, err := strconv.Atoi(tahunTeks)
		if err != nil {
			continue
		}
		if _, ada := l.pertumbuhan(tahun, func(i int) angkaFleksibel { return l.Financials.HistoricalFinancials[i].Revenue }); ada && tahun > tahunTerbaru {
			tahunTerbaru = tahun
		}
	}
	if tahunTerbaru == 0 {
		return nil
	}

	rata := sektor.Growth.WeightedAvgGrowthData[strconv.Itoa(tahunTerbaru)]
	hasil := make([]MetrikMentah, 0, 2)

	if nilai, ada := l.pertumbuhan(tahunTerbaru, func(i int) angkaFleksibel { return l.Financials.HistoricalFinancials[i].Revenue }); ada && rata.AvgAnnualRevenueGrowth.Ada {
		hasil = append(hasil, MetrikMentah{
			Key: "revenue_growth", Label: "Pertumbuhan pendapatan", Unit: UnitPersen, Year: tahunTerbaru,
			Value: nilai, Average: rata.AvgAnnualRevenueGrowth.Nilai * 100, Basis: basisSubSektor,
		})
	}
	if nilai, ada := l.pertumbuhan(tahunTerbaru, func(i int) angkaFleksibel { return l.Financials.HistoricalFinancials[i].Earnings }); ada && rata.AvgAnnualEarningGrowth.Ada {
		hasil = append(hasil, MetrikMentah{
			Key: "earnings_growth", Label: "Pertumbuhan laba", Unit: UnitPersen, Year: tahunTerbaru,
			Value: nilai, Average: rata.AvgAnnualEarningGrowth.Nilai * 100, Basis: basisSubSektor,
		})
	}

	return hasil
}

func abs(nilai float64) float64 {
	if nilai < 0 {
		return -nilai
	}
	return nilai
}

type daftarSuspensi struct {
	Results []struct {
		Symbol         string           `json:"symbol"`
		SuspensionDate tanggalFleksibel `json:"suspension_date"`
		Reason         string           `json:"reason"`
		PdfURL         string           `json:"pdf_url"`
	} `json:"results"`
}

type daftarFiling struct {
	Results []struct {
		Timestamp        tanggalFleksibel `json:"timestamp"`
		Symbol           string           `json:"symbol"`
		TransactionType  string           `json:"transaction_type"`
		HolderType       string           `json:"holder_type"`
		HolderName       string           `json:"holder_name"`
		TransactionValue angkaFleksibel   `json:"transaction_value"`
		SharePctBefore   angkaFleksibel   `json:"share_percentage_before"`
		SharePctAfter    angkaFleksibel   `json:"share_percentage_after"`
		Source           string           `json:"source"`
	} `json:"results"`
}

type laporanSubSektor struct {
	Sector    string `json:"sector"`
	SubSector string `json:"sub_sector"`
	Growth    struct {
		WeightedAvgGrowthData map[string]struct {
			AvgAnnualEarningGrowth angkaFleksibel `json:"avg_annual_earning_growth"`
			AvgAnnualRevenueGrowth angkaFleksibel `json:"avg_annual_revenue_growth"`
		} `json:"weighted_avg_growth_data"`
	} `json:"growth"`
}

type daftarPerusahaanTambang struct {
	Results []struct {
		Slug   string  `json:"slug"`
		Name   string  `json:"name"`
		Symbol *string `json:"symbol"`
	} `json:"results"`
}

type detailTambang struct {
	Name            string   `json:"name"`
	Slug            string   `json:"slug"`
	CompanyType     string   `json:"company_type"`
	KeyOperation    string   `json:"key_operation"`
	CommodityType   []string `json:"commodity_type"`
	MiningSiteCount int      `json:"mining_site_count"`
	MiningLicense   []struct {
		LicenseType       string           `json:"license_type"`
		LicenseNumber     string           `json:"license_number"`
		WiupCode          string           `json:"wiup_code"`
		Province          string           `json:"province"`
		City              string           `json:"city"`
		LicenseExpiryDate tanggalFleksibel `json:"license_expiry_date"`
		Activity          string           `json:"activity"`
		LicensedAreaHa    angkaFleksibel   `json:"licensed_area_ha"`
		CommodityType     string           `json:"commodity_type"`
	} `json:"mining_license"`
}

func (d detailTambang) lisensi() []MiningLicense {
	daftar := make([]MiningLicense, 0, len(d.MiningLicense))
	for _, item := range d.MiningLicense {
		id := strings.TrimSpace(item.LicenseNumber)
		if id == "" {
			id = strings.TrimSpace(item.WiupCode)
		}
		daftar = append(daftar, MiningLicense{
			LicenseID: id,
			Type:      item.LicenseType,
			Commodity: item.CommodityType,
			Status:    item.Activity,
			Province:  item.Province,
			City:      item.City,
			AreaHa:    item.LicensedAreaHa.Nilai,
			ExpiresAt: item.LicenseExpiryDate.Time,
		})
	}
	return daftar
}

type kinerjaTambang struct {
	Year           int   `json:"year"`
	AvailableYears []int `json:"available_years"`
	Data           []struct {
		Year             int    `json:"year"`
		CommodityType    string `json:"commodity_type"`
		CommoditySubType string `json:"commodity_sub_type"`
		CommodityStats   struct {
			Unit              string                    `json:"unit"`
			ProductionVolume  angkaFleksibel            `json:"production_volume"`
			ResourcesReserves map[string]angkaFleksibel `json:"resources_reserves"`
		} `json:"commodity_stats"`
	} `json:"data"`
}

func (k kinerjaTambang) tahun() int {
	if k.Year > 0 {
		return k.Year
	}
	for _, baris := range k.Data {
		if baris.Year > k.Year {
			k.Year = baris.Year
		}
	}
	return k.Year
}

func (k kinerjaTambang) tersedia(tahun int) bool {
	for _, ada := range k.AvailableYears {
		if ada == tahun {
			return true
		}
	}
	return false
}

func (k kinerjaTambang) baris(tahun int) []barisProduksi {
	hasil := make([]barisProduksi, 0, len(k.Data))
	for _, item := range k.Data {
		if item.Year != 0 && item.Year != tahun {
			continue
		}

		cadangan := map[string]*float64{}
		for kunci, nilai := range item.CommodityStats.ResourcesReserves {
			cadangan[kunci] = nilai.ptr()
		}

		baris := barisProduksi{
			Commodity:  item.CommodityType,
			SubType:    item.CommoditySubType,
			Unit:       item.CommodityStats.Unit,
			Production: item.CommodityStats.ProductionVolume.ptr(),
			Reserves:   map[string]float64{},
		}
		if nilai, ada := cadanganSesuaiUnit(item.CommodityType, item.CommodityStats.Unit, cadangan); ada {
			baris.Reserves[strings.ToLower(item.CommodityStats.Unit)] = nilai
		}
		hasil = append(hasil, baris)
	}
	return hasil
}

type daftarSitus struct {
	Results []struct {
		Name             string         `json:"name"`
		Slug             string         `json:"slug"`
		Year             int            `json:"year"`
		CommodityType    string         `json:"commodity_type"`
		ProductionVolume angkaFleksibel `json:"production_volume"`
		Unit             string         `json:"unit"`
		Province         string         `json:"province"`
		City             string         `json:"city"`
	} `json:"results"`
}

type detailSitus struct {
	Location struct {
		Province  string         `json:"province"`
		City      string         `json:"city"`
		Latitude  angkaFleksibel `json:"latitude"`
		Longitude angkaFleksibel `json:"longitude"`
	} `json:"location"`
}
