package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

var ErrPasarTidakTersedia = errors.New("service: data pasar sedang tidak tersedia")

const (
	batasHalamanUniverse = 200
	maksHalamanUniverse  = 10
	jumlahTeratas        = 10
	jumlahArusAsing      = 10
	biayaIndeks          = 1
	biayaArusAsing       = 1
)

var labelIndeks = map[string]string{"ihsg": "IHSG", "lq45": "LQ45", "idx30": "IDX30"}

type MarketMeta struct {
	Cached           bool  `json:"cached"`
	LatencyMS        int64 `json:"latency_ms"`
	CreditsUsed      int64 `json:"credits_used"`
	CreditsRemaining int64 `json:"credits_remaining"`
	CreditBudget     int64 `json:"credit_budget"`
	CircuitOpen      bool  `json:"circuit_open"`
}

type MarketReport struct {
	Ticker      string          `json:"ticker"`
	CompanyName string          `json:"company_name"`
	Meta        MarketMeta      `json:"meta"`
	Data        json.RawMessage `json:"data"`
}

type Kutipan struct {
	Ticker          string   `json:"ticker"`
	Harga           float64  `json:"last_close_price"`
	TanggalTutup    string   `json:"latest_close_date,omitempty"`
	PerubahanHarian *float64 `json:"daily_close_change"`
	Kapitalisasi    *float64 `json:"market_cap"`
	Peringkat       *float64 `json:"market_cap_rank"`
	Tertinggi52     *float64 `json:"high_52w"`
	Terendah52      *float64 `json:"low_52w"`
	Sektor          string   `json:"sector,omitempty"`
	SubSektor       string   `json:"sub_sector,omitempty"`
	Indeks          []string `json:"indices"`
}

type SahamPasar struct {
	Ticker          string   `json:"ticker"`
	Nama            string   `json:"company_name"`
	Sektor          string   `json:"sector,omitempty"`
	Harga           *float64 `json:"last_close_price"`
	PerubahanHarian *float64 `json:"daily_close_change"`
	Kapitalisasi    *float64 `json:"market_cap"`
}

type TitikIndeks struct {
	Tanggal string  `json:"date"`
	Nilai   float64 `json:"price"`
}

type SeriIndeks struct {
	Kode string        `json:"code"`
	Seri []TitikIndeks `json:"series"`
	Meta MarketMeta    `json:"meta"`
}

type ArusAsing struct {
	Ticker string  `json:"ticker"`
	Nama   string  `json:"company_name"`
	Bersih float64 `json:"net_foreign_inflow"`
	Beli   float64 `json:"foreign_buy_idr"`
	Jual   float64 `json:"foreign_sell_idr"`
}

type RingkasanAsing struct {
	Tanggal string      `json:"date"`
	Beli    []ArusAsing `json:"top_buy"`
	Jual    []ArusAsing `json:"top_sell"`
	Meta    MarketMeta  `json:"meta"`
}

type MarketService struct {
	client  *sectorsclient.Client
	tickers *TickerService
}

func NewMarketService(client *sectorsclient.Client, tickers *TickerService) *MarketService {
	return &MarketService{client: client, tickers: tickers}
}

func (s *MarketService) CompanyReport(ctx context.Context, rawTicker string) (*MarketReport, error) {
	ticker, err := s.tickers.Lookup(rawTicker)
	if err != nil {
		v := newValidationError()
		v.add("ticker", "Ticker tidak terdaftar di IDX")
		return nil, v
	}

	hasil, err := s.client.Get(ctx, pathLaporan(ticker.Code), 0, biayaLaporan)
	if err != nil {
		return nil, err
	}

	return &MarketReport{
		Ticker:      ticker.Code,
		CompanyName: ticker.Name,
		Data:        hasil.Data,
		Meta:        s.meta(ctx, hasil),
	}, nil
}

func (s *MarketService) meta(ctx context.Context, hasil *sectorsclient.Hasil) MarketMeta {
	return MarketMeta{
		Cached:           hasil.Cached,
		LatencyMS:        hasil.Latensi.Milliseconds(),
		CreditsUsed:      hasil.Terpakai,
		CreditsRemaining: hasil.Tersisa,
		CreditBudget:     s.client.Budget(),
		CircuitOpen:      s.client.CircuitTerbuka(ctx),
	}
}

func (s *MarketService) halamanSaham(ctx context.Context, offset int) ([]SahamPasar, int, *sectorsclient.Hasil, error) {
	kueri := url.Values{
		"where":                {"last_close_price > 0 and daily_close_change > -1 and market_cap > 0 and sector like '%'"},
		"order_by":             {"-market_cap"},
		"include_query_values": {"true"},
		"limit":                {strconv.Itoa(batasHalamanUniverse)},
		"offset":               {strconv.Itoa(offset)},
	}
	hasil, err := s.client.Get(ctx, "/companies/?"+kueri.Encode(), 0, 1)
	if err != nil {
		return nil, 0, nil, err
	}

	var isi struct {
		Results []struct {
			Symbol string `json:"symbol"`
			Nilai  struct {
				Harga        angkaFleksibel `json:"last_close_price"`
				Perubahan    angkaFleksibel `json:"daily_close_change"`
				Kapitalisasi angkaFleksibel `json:"market_cap"`
				Sektor       string         `json:"sector"`
			} `json:"query_values"`
		} `json:"results"`
		Pagination struct {
			HasNext    bool `json:"has_next"`
			NextOffset *int `json:"next_offset"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil, 0, nil, fmt.Errorf("%w: screener emiten tidak terbaca", sectorsclient.ErrUpstreamGagal)
	}

	saham := make([]SahamPasar, 0, len(isi.Results))
	for _, baris := range isi.Results {
		ticker, err := s.tickers.Lookup(baris.Symbol)
		if err != nil || !baris.Nilai.Harga.Ada || baris.Nilai.Harga.Nilai <= 0 {
			continue
		}
		saham = append(saham, SahamPasar{
			Ticker:          ticker.Code,
			Nama:            ticker.Name,
			Sektor:          strings.TrimSpace(baris.Nilai.Sektor),
			Harga:           baris.Nilai.Harga.ptr(),
			PerubahanHarian: baris.Nilai.Perubahan.ptr(),
			Kapitalisasi:    baris.Nilai.Kapitalisasi.ptr(),
		})
	}

	berikut := 0
	if isi.Pagination.HasNext && isi.Pagination.NextOffset != nil && *isi.Pagination.NextOffset > offset {
		berikut = *isi.Pagination.NextOffset
	}
	return saham, berikut, hasil, nil
}

func (s *MarketService) Teratas(ctx context.Context) ([]SahamPasar, MarketMeta, error) {
	saham, _, hasil, err := s.halamanSaham(ctx, 0)
	if err != nil {
		return nil, MarketMeta{}, err
	}
	return saham[:min(jumlahTeratas, len(saham))], s.meta(ctx, hasil), nil
}

func (s *MarketService) DaftarSaham(ctx context.Context) ([]SahamPasar, MarketMeta) {
	pasar := map[string]SahamPasar{}
	var meta MarketMeta
	for offset, halaman := 0, 0; halaman < maksHalamanUniverse; halaman++ {
		saham, berikut, hasil, err := s.halamanSaham(ctx, offset)
		if err != nil {
			break
		}
		meta = s.meta(ctx, hasil)
		for _, satu := range saham {
			pasar[satu.Ticker] = satu
		}
		if berikut == 0 {
			break
		}
		offset = berikut
	}

	semua := s.tickers.Semua()
	daftar := make([]SahamPasar, 0, len(semua))
	for _, ticker := range semua {
		satu, ada := pasar[ticker.Code]
		if !ada {
			satu = SahamPasar{Ticker: ticker.Code, Nama: ticker.Name}
		}
		daftar = append(daftar, satu)
	}
	sort.SliceStable(daftar, func(i, j int) bool {
		return kapitalisasi(daftar[i]) > kapitalisasi(daftar[j])
	})
	return daftar, meta
}

func kapitalisasi(saham SahamPasar) float64 {
	if saham.Kapitalisasi == nil {
		return -1
	}
	return *saham.Kapitalisasi
}

func (s *MarketService) Indeks(ctx context.Context, mentah string) (*SeriIndeks, error) {
	kode := strings.ToLower(strings.TrimSpace(mentah))
	label, dikenal := labelIndeks[kode]
	if !dikenal {
		v := newValidationError()
		v.add("code", "Indeks tidak tersedia, pilih IHSG, LQ45, atau IDX30")
		return nil, v
	}

	mulai := time.Now().In(zonaJakarta()).AddDate(0, 0, -hariRiwayatHarga).Format(formatTanggalIDX)
	hasil, err := s.client.Get(ctx, fmt.Sprintf("/index-daily/%s/?start=%s", kode, mulai), 0, biayaIndeks)
	if err != nil {
		return nil, err
	}

	seri, err := uraiIndeks(hasil.Data)
	if err != nil {
		return nil, fmt.Errorf("%w: indeks %s tidak terbaca", sectorsclient.ErrUpstreamGagal, label)
	}
	return &SeriIndeks{Kode: label, Seri: seri, Meta: s.meta(ctx, hasil)}, nil
}

func uraiIndeks(data json.RawMessage) ([]TitikIndeks, error) {
	var mentah []struct {
		Tanggal string         `json:"date"`
		Nilai   angkaFleksibel `json:"price"`
	}
	if err := json.Unmarshal(data, &mentah); err != nil {
		return nil, err
	}

	seri := make([]TitikIndeks, 0, len(mentah))
	for _, baris := range mentah {
		if len(baris.Tanggal) < len(formatTanggalIDX) || !baris.Nilai.Ada || baris.Nilai.Nilai <= 0 {
			continue
		}
		seri = append(seri, TitikIndeks{Tanggal: baris.Tanggal[:len(formatTanggalIDX)], Nilai: baris.Nilai.Nilai})
	}
	sort.Slice(seri, func(i, j int) bool { return seri[i].Tanggal < seri[j].Tanggal })
	return seri, nil
}

func (s *MarketService) ArusAsing(ctx context.Context) (*RingkasanAsing, error) {
	beli, tanggal, _, err := s.halamanAsing(ctx, "-net_foreign_inflow")
	if err != nil {
		return nil, err
	}
	jual, tanggalJual, hasil, err := s.halamanAsing(ctx, "net_foreign_inflow")
	if err != nil {
		return nil, err
	}

	ringkasan := &RingkasanAsing{Tanggal: max(tanggal, tanggalJual), Beli: []ArusAsing{}, Jual: []ArusAsing{}, Meta: s.meta(ctx, hasil)}
	for _, satu := range beli {
		if satu.Bersih > 0 {
			ringkasan.Beli = append(ringkasan.Beli, satu)
		}
	}
	for _, satu := range jual {
		if satu.Bersih < 0 {
			ringkasan.Jual = append(ringkasan.Jual, satu)
		}
	}
	return ringkasan, nil
}

func (s *MarketService) halamanAsing(ctx context.Context, urutan string) ([]ArusAsing, string, *sectorsclient.Hasil, error) {
	kueri := url.Values{"limit": {strconv.Itoa(jumlahArusAsing)}, "order_by": {urutan}}
	hasil, err := s.client.Get(ctx, "/foreign-flow/?"+kueri.Encode(), 0, biayaArusAsing)
	if err != nil {
		return nil, "", nil, err
	}

	var isi struct {
		Results []struct {
			Symbol  string         `json:"symbol"`
			Tanggal string         `json:"date"`
			Bersih  angkaFleksibel `json:"net_foreign_inflow"`
			Beli    angkaFleksibel `json:"foreign_buy_idr"`
			Jual    angkaFleksibel `json:"foreign_sell_idr"`
		} `json:"results"`
	}
	if err := json.Unmarshal(hasil.Data, &isi); err != nil {
		return nil, "", nil, fmt.Errorf("%w: arus dana asing tidak terbaca", sectorsclient.ErrUpstreamGagal)
	}

	arus := make([]ArusAsing, 0, len(isi.Results))
	tanggal := ""
	for _, baris := range isi.Results {
		ticker, err := s.tickers.Lookup(baris.Symbol)
		if err != nil || !baris.Bersih.Ada {
			continue
		}
		tanggal = max(tanggal, baris.Tanggal)
		arus = append(arus, ArusAsing{
			Ticker: ticker.Code,
			Nama:   ticker.Name,
			Bersih: baris.Bersih.Nilai,
			Beli:   baris.Beli.Nilai,
			Jual:   baris.Jual.Nilai,
		})
	}
	return arus, tanggal, hasil, nil
}

func (s *MarketService) Kutipan(ctx context.Context, kode []string) map[string]Kutipan {
	hasil := map[string]Kutipan{}
	for _, satu := range kode {
		data, ada := s.client.Terakhir(ctx, pathLaporan(satu))
		if !ada {
			continue
		}
		if kutipan, ok := uraiKutipan(satu, data); ok {
			hasil[satu] = kutipan
		}
	}
	return hasil
}

func uraiKutipan(kode string, data json.RawMessage) (Kutipan, bool) {
	var isi struct {
		Overview struct {
			Sector        string                               `json:"sector"`
			SubSector     string                               `json:"sub_sector"`
			MarketCap     angkaFleksibel                       `json:"market_cap"`
			MarketCapRank angkaFleksibel                       `json:"market_cap_rank"`
			Harga         angkaFleksibel                       `json:"last_close_price"`
			TanggalTutup  string                               `json:"latest_close_date"`
			Perubahan     angkaFleksibel                       `json:"daily_close_change"`
			Rentang       map[string]map[string]angkaFleksibel `json:"all_time_price"`
			Indices       []string                             `json:"indices"`
		} `json:"overview"`
	}
	_ = json.Unmarshal(data, &isi)

	o := isi.Overview
	if !o.Harga.Ada || o.Harga.Nilai <= 0 {
		return Kutipan{}, false
	}

	ujung := func(kunci string) *float64 {
		for _, nilai := range o.Rentang[kunci] {
			return nilai.ptr()
		}
		return nil
	}

	indeks := o.Indices
	if indeks == nil {
		indeks = []string{}
	}

	return Kutipan{
		Ticker:          kode,
		Harga:           o.Harga.Nilai,
		TanggalTutup:    o.TanggalTutup,
		PerubahanHarian: o.Perubahan.ptr(),
		Kapitalisasi:    o.MarketCap.ptr(),
		Peringkat:       o.MarketCapRank.ptr(),
		Tertinggi52:     ujung("52_w_high"),
		Terendah52:      ujung("52_w_low"),
		Sektor:          o.Sector,
		SubSektor:       o.SubSector,
		Indeks:          indeks,
	}, true
}

func (s *MarketService) Credits(ctx context.Context) MarketMeta {
	terpakai, tersisa := s.client.Kredit(ctx)
	return MarketMeta{
		CreditsUsed:      terpakai,
		CreditsRemaining: tersisa,
		CreditBudget:     s.client.Budget(),
		CircuitOpen:      s.client.CircuitTerbuka(ctx),
	}
}

func (s *MarketService) RefreshTickerUniverse(ctx context.Context) (int, error) {
	tickers := make([]Ticker, 0, 1000)
	offset := 0

	for halaman := 0; halaman < maksHalamanUniverse; halaman++ {
		path := fmt.Sprintf("/companies/?limit=%d&offset=%d", batasHalamanUniverse, offset)
		hasil, err := s.client.Get(ctx, path, ttlReferensi, 1)
		if err != nil {
			return 0, err
		}

		var isi struct {
			Results []struct {
				Symbol      string `json:"symbol"`
				CompanyName string `json:"company_name"`
			} `json:"results"`
			Pagination struct {
				HasNext    bool `json:"has_next"`
				NextOffset *int `json:"next_offset"`
			} `json:"pagination"`
		}
		if err := json.Unmarshal(hasil.Data, &isi); err != nil {
			return 0, fmt.Errorf("service: daftar emiten Sectors tidak terbaca: %w", err)
		}

		for _, baris := range isi.Results {
			code := s.tickers.Normalize(baris.Symbol)
			if len(code) != 4 {
				continue
			}
			tickers = append(tickers, Ticker{Code: code, Name: strings.TrimSpace(baris.CompanyName), ListingBoard: "Sectors"})
		}

		if !isi.Pagination.HasNext || isi.Pagination.NextOffset == nil || *isi.Pagination.NextOffset <= offset {
			break
		}
		offset = *isi.Pagination.NextOffset
	}

	if len(tickers) == 0 {
		return 0, fmt.Errorf("service: daftar emiten Sectors kosong")
	}

	if err := s.tickers.SaveToCache(ctx, tickers); err != nil {
		return 0, err
	}

	return len(tickers), nil
}
