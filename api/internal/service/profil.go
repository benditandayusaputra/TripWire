package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"sort"
	"strings"

	"github.com/benditandayusaputra/tripwire/api/pkg/sectorsclient"
)

const jumlahArusInstitusi = 12

var kategoriInvestor = []string{
	"individual", "mutual_fund", "pension_fund", "insurance", "corporate",
	"financial_institutions", "securities_companies", "foundation", "other",
}

type Pejabat struct {
	Nama    string `json:"name"`
	Jabatan string `json:"position"`
}

type SahamPejabat struct {
	Nama    string   `json:"name"`
	Jabatan string   `json:"position"`
	Lembar  *float64 `json:"share_amount"`
	Persen  *float64 `json:"percentage"`
}

type PemegangSaham struct {
	Nama   string   `json:"name"`
	Lembar *float64 `json:"share_amount"`
	Nilai  *float64 `json:"share_value"`
	Persen float64  `json:"percentage"`
}

type PelakuInstitusi struct {
	Nama      string  `json:"name"`
	Perubahan float64 `json:"change_amount"`
}

type ArusInstitusi struct {
	Tanggal string  `json:"date"`
	Bersih  float64 `json:"net_transaction"`
}

type AksiInstitusi struct {
	Tanggal string            `json:"date,omitempty"`
	Pembeli []PelakuInstitusi `json:"top_buyers"`
	Penjual []PelakuInstitusi `json:"top_sellers"`
	Arus    []ArusInstitusi   `json:"flow"`
}

type KategoriInvestor struct {
	Kunci string  `json:"key"`
	Lokal float64 `json:"local"`
	Asing float64 `json:"foreign"`
}

type KomposisiInvestor struct {
	Tanggal      string             `json:"date"`
	SahamBeredar *float64           `json:"shares_outstanding"`
	Pemegang     *float64           `json:"shareholders"`
	Perubahan    *float64           `json:"shareholders_change"`
	Lokal        float64            `json:"local"`
	Asing        float64            `json:"foreign"`
	Kategori     []KategoriInvestor `json:"categories"`
}

type ProfilPerusahaan struct {
	PapanPencatatan string   `json:"listing_board,omitempty"`
	TanggalTercatat string   `json:"listing_date,omitempty"`
	Sektor          string   `json:"sector,omitempty"`
	SubSektor       string   `json:"sub_sector,omitempty"`
	Industri        string   `json:"industry,omitempty"`
	SubIndustri     string   `json:"sub_industry,omitempty"`
	Alamat          string   `json:"address,omitempty"`
	Situs           string   `json:"website,omitempty"`
	Telepon         string   `json:"phone,omitempty"`
	Email           string   `json:"email,omitempty"`
	Karyawan        *float64 `json:"employees"`
}

type ProfilEmiten struct {
	Ticker        string             `json:"ticker"`
	CompanyName   string             `json:"company_name"`
	Kutipan       *Kutipan           `json:"quote"`
	Perusahaan    ProfilPerusahaan   `json:"company"`
	Pejabat       []Pejabat          `json:"executives"`
	SahamPejabat  []SahamPejabat     `json:"executive_holdings"`
	PemegangSaham []PemegangSaham    `json:"shareholders"`
	InvestorKakap []string           `json:"whale_investors"`
	Grup          []string           `json:"conglomerates"`
	Afiliasi      []string           `json:"affiliates"`
	Institusi     AksiInstitusi      `json:"institutional"`
	Komposisi     *KomposisiInvestor `json:"composition"`
	Meta          MarketMeta         `json:"meta"`
}

func pathManajemen(kode string) string {
	return fmt.Sprintf("/company/report/%s/?sections=management", url.PathEscape(kode))
}

func pathKomposisi(kode string) string {
	return fmt.Sprintf("/company/shareholders-composition/%s/", url.PathEscape(kode))
}

func (s *MarketService) Profil(ctx context.Context, rawTicker string) (*ProfilEmiten, error) {
	ticker, err := s.tickers.Lookup(rawTicker)
	if err != nil {
		v := newValidationError()
		v.add("ticker", "Ticker tidak terdaftar di IDX")
		return nil, v
	}

	laporan, err := ambilLaporan(ctx, s.client, ticker.Code, "overview", "ownership")
	if err != nil {
		return nil, err
	}

	var isi laporanProfil
	_ = json.Unmarshal(laporan.Data, &isi)
	profil := isi.profil(ticker)
	if kutipan, ok := uraiKutipan(ticker.Code, laporan.Data); ok {
		profil.Kutipan = &kutipan
	}

	semuaCache := laporan.Cached
	pelengkap := func(path string, tujuan any) {
		hasil, err := s.client.Get(ctx, path, ttlReferensi, 1)
		if err != nil {
			if !errors.Is(err, sectorsclient.ErrTidakDitemukan) {
				log.Printf("market: %s dilewati: %v", path, err)
			}
			return
		}
		semuaCache = semuaCache && hasil.Cached
		_ = json.Unmarshal(hasil.Data, tujuan)
	}

	var manajemen manajemenMentah
	pelengkap(pathManajemen(ticker.Code), &manajemen)
	profil.isiManajemen(manajemen)

	var komposisi komposisiMentah
	pelengkap(pathKomposisi(ticker.Code), &komposisi)
	profil.Komposisi = komposisi.terbaru()

	profil.Meta = s.Credits(ctx)
	profil.Meta.Cached = semuaCache
	return profil, nil
}

type pelakuMentah struct {
	Name   string         `json:"name"`
	Change angkaFleksibel `json:"changeAmount"`
}

type laporanProfil struct {
	CompanyName string `json:"company_name"`
	Overview    struct {
		ListingBoard string         `json:"listing_board"`
		Sector       string         `json:"sector"`
		SubSector    string         `json:"sub_sector"`
		Industry     string         `json:"industry"`
		SubIndustry  string         `json:"sub_industry"`
		Address      string         `json:"address"`
		Employees    angkaFleksibel `json:"employee_num"`
		ListingDate  string         `json:"listing_date"`
		Website      string         `json:"website"`
		Phone        string         `json:"phone"`
		Email        string         `json:"email"`
		Affiliates   []string       `json:"affiliates"`
	} `json:"overview"`
	Ownership struct {
		MajorShareholders []struct {
			Name   string         `json:"name"`
			Amount angkaFleksibel `json:"share_amount"`
			Value  angkaFleksibel `json:"share_value"`
			Pct    angkaFleksibel `json:"share_percentage"`
		} `json:"major_shareholders"`
		TopTransactions struct {
			Date    string         `json:"date"`
			Buyers  []pelakuMentah `json:"top_buyers"`
			Sellers []pelakuMentah `json:"top_sellers"`
		} `json:"top_transactions"`
		Flow []struct {
			Date string         `json:"date"`
			Net  angkaFleksibel `json:"net_transaction"`
		} `json:"institutional_transaction_flow"`
		Whales        []string `json:"whale_investors"`
		Conglomerates []string `json:"conglomerates_group"`
	} `json:"ownership"`
}

func (l laporanProfil) profil(ticker Ticker) *ProfilEmiten {
	o, k := l.Overview, l.Ownership

	profil := &ProfilEmiten{
		Ticker:      ticker.Code,
		CompanyName: namaEmiten(ticker, strings.TrimSpace(l.CompanyName)),
		Perusahaan: ProfilPerusahaan{
			PapanPencatatan: strings.TrimSpace(o.ListingBoard),
			TanggalTercatat: strings.TrimSpace(o.ListingDate),
			Sektor:          strings.TrimSpace(o.Sector),
			SubSektor:       strings.TrimSpace(o.SubSector),
			Industri:        strings.TrimSpace(o.Industry),
			SubIndustri:     strings.TrimSpace(o.SubIndustry),
			Alamat:          strings.TrimSpace(strings.ReplaceAll(o.Address, "\r\n", "\n")),
			Situs:           tautanSitus(o.Website),
			Telepon:         strings.TrimSpace(o.Phone),
			Email:           strings.TrimSpace(o.Email),
			Karyawan:        o.Employees.ptr(),
		},
		Pejabat:       []Pejabat{},
		SahamPejabat:  []SahamPejabat{},
		PemegangSaham: []PemegangSaham{},
		InvestorKakap: bersihkanDaftar(k.Whales),
		Grup:          bersihkanDaftar(k.Conglomerates),
		Afiliasi:      bersihkanDaftar(o.Affiliates),
		Institusi: AksiInstitusi{
			Tanggal: strings.TrimSpace(k.TopTransactions.Date),
			Pembeli: pelakuInstitusi(k.TopTransactions.Buyers),
			Penjual: pelakuInstitusi(k.TopTransactions.Sellers),
			Arus:    []ArusInstitusi{},
		},
	}

	for _, item := range k.MajorShareholders {
		nama := strings.TrimSpace(item.Name)
		if nama == "" || !item.Pct.Ada {
			continue
		}
		profil.PemegangSaham = append(profil.PemegangSaham, PemegangSaham{
			Nama:   nama,
			Lembar: item.Amount.ptr(),
			Nilai:  item.Value.ptr(),
			Persen: persenKepemilikan(item.Pct.Nilai),
		})
	}
	sort.SliceStable(profil.PemegangSaham, func(i, j int) bool {
		return profil.PemegangSaham[i].Persen > profil.PemegangSaham[j].Persen
	})

	for _, item := range k.Flow {
		if tanggal := strings.TrimSpace(item.Date); tanggal != "" && item.Net.Ada {
			profil.Institusi.Arus = append(profil.Institusi.Arus, ArusInstitusi{Tanggal: tanggal, Bersih: item.Net.Nilai})
		}
	}
	arus := profil.Institusi.Arus
	sort.Slice(arus, func(i, j int) bool { return arus[i].Tanggal < arus[j].Tanggal })
	profil.Institusi.Arus = arus[max(0, len(arus)-jumlahArusInstitusi):]

	return profil
}

type manajemenMentah struct {
	Management struct {
		KeyExecutives []struct {
			Name     string `json:"name"`
			Position string `json:"position"`
		} `json:"key_executives"`
		Shareholdings []struct {
			Name     string         `json:"name"`
			Position string         `json:"position"`
			Amount   angkaFleksibel `json:"share_amount"`
			Pct      angkaFleksibel `json:"share_percentage"`
		} `json:"executives_shareholdings"`
	} `json:"management"`
}

func (p *ProfilEmiten) isiManajemen(m manajemenMentah) {
	for _, item := range m.Management.KeyExecutives {
		if nama := strings.TrimSpace(item.Name); nama != "" {
			p.Pejabat = append(p.Pejabat, Pejabat{Nama: nama, Jabatan: strings.TrimSpace(item.Position)})
		}
	}

	for _, item := range m.Management.Shareholdings {
		nama := strings.TrimSpace(item.Name)
		if nama == "" {
			continue
		}
		var persen *float64
		if item.Pct.Ada {
			nilai := persenKepemilikan(item.Pct.Nilai)
			persen = &nilai
		}
		p.SahamPejabat = append(p.SahamPejabat, SahamPejabat{
			Nama:    nama,
			Jabatan: strings.TrimSpace(item.Position),
			Lembar:  item.Amount.ptr(),
			Persen:  persen,
		})
	}
}

type komposisiMentah struct {
	Data []map[string]json.RawMessage `json:"data"`
}

func (k komposisiMentah) terbaru() *KomposisiInvestor {
	var baris map[string]json.RawMessage
	tanggal := ""
	for _, satu := range k.Data {
		var teks string
		if json.Unmarshal(satu["date"], &teks) == nil && teks > tanggal {
			tanggal, baris = teks, satu
		}
	}
	if baris == nil {
		return nil
	}

	angka := func(kunci string) angkaFleksibel {
		var nilai angkaFleksibel
		_ = json.Unmarshal(baris[kunci], &nilai)
		return nilai
	}

	hasil := &KomposisiInvestor{
		Tanggal:      tanggal,
		SahamBeredar: angka("shares_number").ptr(),
		Pemegang:     angka("numbers_of_shareholders").ptr(),
		Perubahan:    angka("change_in_shareholders").ptr(),
		Kategori:     []KategoriInvestor{},
	}
	for _, kunci := range kategoriInvestor {
		lokal, asing := angka(kunci+"_l").Nilai, angka(kunci+"_f").Nilai
		if lokal+asing <= 0 {
			continue
		}
		hasil.Lokal += lokal
		hasil.Asing += asing
		hasil.Kategori = append(hasil.Kategori, KategoriInvestor{Kunci: kunci, Lokal: lokal, Asing: asing})
	}
	if hasil.Lokal+hasil.Asing <= 0 {
		return nil
	}
	return hasil
}

func pelakuInstitusi(daftar []pelakuMentah) []PelakuInstitusi {
	hasil := make([]PelakuInstitusi, 0, len(daftar))
	for _, item := range daftar {
		if nama := strings.TrimSpace(item.Name); nama != "" && item.Change.Ada {
			hasil = append(hasil, PelakuInstitusi{Nama: nama, Perubahan: item.Change.Nilai})
		}
	}
	return hasil
}

func bersihkanDaftar(daftar []string) []string {
	hasil := make([]string, 0, len(daftar))
	for _, item := range daftar {
		if nilai := strings.TrimSpace(item); nilai != "" {
			hasil = append(hasil, nilai)
		}
	}
	return hasil
}

func tautanSitus(mentah string) string {
	teks := strings.TrimSpace(mentah)
	if teks == "" {
		return ""
	}
	if !strings.Contains(teks, "://") {
		teks = "https://" + teks
	}
	alamat, err := url.Parse(teks)
	if err != nil || (alamat.Scheme != "http" && alamat.Scheme != "https") || alamat.Host == "" {
		return ""
	}
	return alamat.String()
}
