import { expect, test } from "@playwright/test";
import { sesiMasuk } from "./helpers/akun";
import type { APIRequestContext } from "@playwright/test";

type SesiApi = Awaited<ReturnType<typeof sesiMasuk>>["sesi"];

async function sesiSiap(
  request: APIRequestContext,
  prefix: string,
): Promise<SesiApi> {
  const { sesi } = await sesiMasuk(request, prefix);

  for (let percobaan = 0; percobaan < 40; percobaan += 1) {
    const response = await sesi.kirim("get", "/market/credits");
    if (response.ok() && (await response.json()).meta.circuit_open === false) {
      return sesi;
    }
    await new Promise((selesai) => setTimeout(selesai, 500));
  }

  throw new Error("Circuit breaker Sectors tidak kunjung tertutup");
}

const HARAPAN_RED_FLAG = {
  ANTM: {
    skor: 97.44,
    kategori: "Kritis",
    dasar: 60.9,
    suspension: 69,
    insider: 48,
    ownership: 70,
    sinyalAktif: ["suspension", "insider_clustering", "ownership_change"],
    pengali: 1.6,
    jumlahInsider: 4,
    arahInsider: 0.33,
    deltaKonsentrasi: 7,
    faktorFloat: 1,
  },
  PTBA: {
    skor: 23.3,
    kategori: "Rendah",
    dasar: 23.3,
    suspension: 36,
    insider: 20,
    ownership: 15,
    sinyalAktif: [],
    pengali: 1,
    jumlahInsider: 1,
    arahInsider: 1,
    deltaKonsentrasi: 1.5,
    faktorFloat: 1,
  },
  MDKA: {
    skor: 37.18,
    kategori: "Sedang",
    dasar: 28.6,
    suspension: 0,
    insider: 40,
    ownership: 42,
    sinyalAktif: ["insider_clustering", "ownership_change"],
    pengali: 1.3,
    jumlahInsider: 2,
    arahInsider: 1,
    deltaKonsentrasi: 6,
    faktorFloat: 0.7,
  },
  ITMG: {
    skor: 100,
    kategori: "Kritis",
    dasar: 100,
    suspension: 100,
    insider: 100,
    ownership: 100,
    sinyalAktif: ["suspension", "insider_clustering", "ownership_change"],
    pengali: 1.6,
    jumlahInsider: 6,
    arahInsider: 1,
    deltaKonsentrasi: 12,
    faktorFloat: 1,
  },
  TLKM: {
    skor: 0,
    kategori: "Rendah",
    dasar: 0,
    suspension: 0,
    insider: 0,
    ownership: 0,
    sinyalAktif: [],
    pengali: 1,
    jumlahInsider: 0,
    arahInsider: 0,
    deltaKonsentrasi: 0,
    faktorFloat: 1,
  },
} as const;

test.describe("Fase 6: insight engine red flag dan market intelligence", () => {
  for (const [ticker, harapan] of Object.entries(HARAPAN_RED_FLAG)) {
    test(`skor red flag ${ticker} cocok dengan hitungan manual`, async ({
      request,
    }) => {
      const sesi = await sesiSiap(
        request,
        `insight-rf-${ticker.toLowerCase()}`,
      );

      const response = await sesi.kirim("get", `/insights/red-flag/${ticker}`);
      expect(response.status()).toBe(200);

      const isi = await response.json();
      expect(isi.ticker).toBe(ticker);
      expect(isi.insight_type).toBe("red_flag");
      expect(isi.subtype).toBe("governance_risk_composite");
      expect(isi.score).toBeCloseTo(harapan.skor, 2);

      const payload = isi.payload;
      expect(payload.governance_risk_score).toBeCloseTo(harapan.skor, 2);
      expect(payload.category).toBe(harapan.kategori);
      expect(payload.base_score).toBeCloseTo(harapan.dasar, 2);

      expect(payload.sub_scores.suspension).toBeCloseTo(harapan.suspension, 2);
      expect(payload.sub_scores.insider_clustering).toBeCloseTo(
        harapan.insider,
        2,
      );
      expect(payload.sub_scores.ownership_change).toBeCloseTo(
        harapan.ownership,
        2,
      );

      expect(payload.cross_pattern.window_days).toBe(30);
      expect(payload.cross_pattern.signals_active_in_window).toBe(
        harapan.sinyalAktif.length,
      );
      expect(payload.cross_pattern.multiplier_applied).toBeCloseTo(
        harapan.pengali,
        2,
      );
      expect(payload.cross_pattern.active_signals).toEqual([
        ...harapan.sinyalAktif,
      ]);

      const pendukung = payload.supporting_data;
      expect(pendukung.insider_count_in_window).toBe(harapan.jumlahInsider);
      expect(pendukung.insider_net_direction).toBeCloseTo(
        harapan.arahInsider,
        2,
      );
      expect(pendukung.delta_concentration_pp).toBeCloseTo(
        harapan.deltaKonsentrasi,
        2,
      );
      expect(pendukung.free_float_factor).toBeCloseTo(harapan.faktorFloat, 2);
      expect(Array.isArray(pendukung.suspensions)).toBe(true);
      expect(Array.isArray(pendukung.insider_transactions)).toBe(true);
      expect(Array.isArray(pendukung.ownership_changes)).toBe(true);
      expect(Array.isArray(pendukung.major_shareholders)).toBe(true);
      expect(payload.data_sources).toEqual([
        `/company/report/${ticker}/`,
        "/suspensions/",
        "/filings/",
      ]);
    });
  }

  test("data pendukung red flag memuat jejak asli dari Sectors", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-jejak");

    const isi = await (
      await sesi.kirim("get", "/insights/red-flag/ANTM")
    ).json();
    const pendukung = isi.payload.supporting_data;

    expect(
      pendukung.suspensions.map(
        (baris: { severity_tier: number }) => baris.severity_tier,
      ),
    ).toEqual([3, 1]);
    expect(pendukung.suspensions[0].pdf_url).toContain("idx.co.id");

    expect(pendukung.insider_transactions.length).toBe(5);
    expect(
      pendukung.insider_transactions.some(
        (baris: { holder_name: string }) =>
          baris.holder_name === "Pemegang Saham Lama",
      ),
    ).toBe(false);

    const terbesar = pendukung.ownership_changes[0];
    expect(terbesar.holder_name).toBe("Inalum (Persero)");
    expect(terbesar.share_pct_before).toBeCloseTo(60, 2);
    expect(terbesar.share_pct_after).toBeCloseTo(67, 2);
    expect(terbesar.delta_pp).toBeCloseTo(7, 2);
    expect(terbesar.filings).toBe(2);

    const publik = pendukung.major_shareholders.find(
      (baris: { name: string }) => baris.name === "Public",
    );
    expect(publik.percentage).toBeCloseTo(35, 2);
    expect(pendukung.free_float_pct).toBeCloseTo(35, 2);
  });

  test("pengali pola silang hanya aktif saat dua sinyal atau lebih jatuh di jendela yang sama", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-cross");

    const aktif = await (
      await sesi.kirim("get", "/insights/red-flag/ANTM")
    ).json();
    const nonaktif = await (
      await sesi.kirim("get", "/insights/red-flag/PTBA")
    ).json();

    expect(aktif.payload.cross_pattern.multiplier_applied).toBe(1.6);
    expect(aktif.payload.governance_risk_score).toBeCloseTo(
      aktif.payload.base_score * 1.6,
      2,
    );

    expect(nonaktif.payload.cross_pattern.multiplier_applied).toBe(1);
    expect(nonaktif.payload.governance_risk_score).toBeCloseTo(
      nonaktif.payload.base_score,
      2,
    );
  });

  test("transaksi insider di luar jendela 30 hari tidak ikut dihitung", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-window");

    const isi = await (
      await sesi.kirim("get", "/insights/red-flag/PTBA")
    ).json();

    expect(isi.payload.supporting_data.insider_transactions.length).toBe(3);
    expect(isi.payload.supporting_data.insider_count_in_window).toBe(1);
    expect(isi.payload.supporting_data.insider_net_direction).toBe(1);
  });

  test("suspend lebih tua dari tiga tahun tidak menambah frekuensi maupun severity", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-suspend");

    const isi = await (
      await sesi.kirim("get", "/insights/red-flag/PTBA")
    ).json();

    expect(isi.payload.supporting_data.suspensions.length).toBe(2);
    expect(isi.payload.sub_scores.suspension).toBeCloseTo(36, 2);
  });

  test("emiten tanpa riwayat data tetap menghasilkan skor rendah, bukan error", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-kosong");

    const response = await sesi.kirim("get", "/insights/red-flag/TLKM");
    expect(response.status()).toBe(200);

    const isi = await response.json();
    expect(isi.score).toBe(0);
    expect(isi.payload.category).toBe("Rendah");
    expect(isi.payload.supporting_data.suspensions).toEqual([]);
  });

  test("market intelligence mode standar membandingkan fundamental dengan rata rata sektor", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-mi-standar");

    const response = await sesi.kirim(
      "get",
      "/insights/market-intelligence/BBCA",
    );
    expect(response.status()).toBe(200);

    const isi = await response.json();
    expect(isi.insight_type).toBe("market_intelligence");
    expect(isi.subtype).toBe("sector_relative_snapshot");
    expect(isi.score).toBeNull();
    expect(isi.payload.mode).toBe("standard");
    expect(isi.payload.commodity_exposure).toBeUndefined();
    expect(isi.payload.data_sources).toEqual([
      "/company/report/BBCA/",
      "/subsector/report/banks/",
    ]);

    const snapshot = isi.payload.sector_snapshot;
    expect(snapshot.sub_sector).toBe("Banks");
    expect(snapshot.sector).toBe("Financials");

    const metrik = Object.fromEntries(
      snapshot.metrics.map((baris: { key: string }) => [baris.key, baris]),
    );

    expect(Object.keys(metrik).sort()).toEqual(
      ["earnings_growth", "pb", "pe", "ps", "revenue_growth"].sort(),
    );

    expect(metrik.pe.year).toBe(2025);
    expect(metrik.pe.unit).toBe("x");
    expect(metrik.pe.basis).toBe("peer_avg");
    expect(metrik.pe.value).toBeCloseTo(12, 2);
    expect(metrik.pe.sector_average).toBeCloseTo(15, 2);
    expect(metrik.pe.difference_pct).toBeCloseTo(-20, 2);
    expect(metrik.pe.position).toBe("di bawah rata rata sektor");

    expect(metrik.pb.difference_pct).toBeCloseTo(20, 2);
    expect(metrik.pb.position).toBe("di atas rata rata sektor");

    expect(metrik.ps.year).toBe(2024);
    expect(metrik.ps.difference_pct).toBeCloseTo(200, 2);

    expect(metrik.revenue_growth.unit).toBe("%");
    expect(metrik.revenue_growth.basis).toBe("subsector_weighted_avg");
    expect(metrik.revenue_growth.value).toBeCloseTo(5, 2);
    expect(metrik.revenue_growth.sector_average).toBeCloseTo(3, 2);
    expect(metrik.revenue_growth.difference).toBeCloseTo(2, 2);
    expect(metrik.revenue_growth.difference_pct).toBeNull();
    expect(metrik.revenue_growth.position).toBe("di atas rata rata sektor");

    expect(metrik.earnings_growth.value).toBeCloseTo(6.67, 2);
    expect(metrik.earnings_growth.difference).toBeCloseTo(-1.33, 2);
    expect(metrik.earnings_growth.position).toBe("di bawah rata rata sektor");
  });

  test("mode mendalam tambang menghitung eksposur komoditas dan radar lisensi", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-mi-tambang");

    const response = await sesi.kirim(
      "get",
      "/insights/market-intelligence/ADRO",
    );
    expect(response.status()).toBe(200);

    const isi = await response.json();
    expect(isi.subtype).toBe("mining_deep_dive");
    expect(isi.payload.mode).toBe("mining_deep");
    expect(isi.score).toBeCloseTo(57.4, 2);

    const eksposur = isi.payload.commodity_exposure;
    expect(eksposur.components.production_trend).toBeCloseTo(66, 2);
    expect(eksposur.components.commodity_price_trend).toBeCloseTo(38, 2);
    expect(eksposur.components.reserve_life).toBeCloseTo(70, 2);
    expect(eksposur.base_score).toBeCloseTo(57.4, 2);
    expect(eksposur.entity_type).toBe("mine_owner");
    expect(eksposur.entity_factor).toBeCloseTo(1, 2);
    expect(eksposur.score).toBeCloseTo(57.4, 2);
    expect(eksposur.category).toBe("Sedang");
    expect(eksposur.commodity).toBe("Coal");

    const produksi = isi.payload.production_trend;
    expect(produksi.commodity).toBe("Coal");
    expect(produksi.yoy_pct).toBeCloseTo(8, 2);
    expect(produksi.reserve_life_years).toBeCloseTo(14, 2);
    expect(produksi.reserve_unit).toBe("Mt");

    const harga = isi.payload.commodity_price;
    expect(harga.commodity).toBe("Coal");
    expect(harga.unit).toBe("USD/t");
    expect(harga.yoy_pct).toBeCloseTo(-6, 2);
    expect(harga.series.length).toBeGreaterThanOrEqual(12);

    const profil = isi.payload.mining_profile;
    expect(profil.slug).toBe("pt-alamtri-resources-indonesia-tbk");
    expect(profil.commodities).toEqual(["Coal"]);

    const radar = isi.payload.license_radar;
    expect(radar.window_days).toBe(365);
    expect(radar.total_licenses).toBe(2);
    expect(radar.has_expiring_license).toBe(true);
    expect(
      radar.expiring_soon.map(
        (baris: { license_id: string }) => baris.license_id,
      ),
    ).toEqual(["IUP-ADRO-01"]);
    expect(radar.expiring_soon[0].expired).toBe(false);

    expect(isi.payload.mine_sites.length).toBe(2);
    expect(isi.payload.mine_sites[0].latitude).toBeCloseTo(-2.15, 2);
    expect(isi.payload.mine_sites[0].region).toBe(
      "Tabalong, Kalimantan Selatan",
    );

    expect(isi.payload.data_sources).toContain(
      "/mining/companies/pt-alamtri-resources-indonesia-tbk/",
    );
    expect(isi.payload.data_sources).toContain("/mining/commodities/coal/price/");
  });

  test("tipe entitas trader menurunkan skor eksposur komoditas", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-mi-trading");

    const isi = await (
      await sesi.kirim("get", "/insights/market-intelligence/INCO")
    ).json();
    const eksposur = isi.payload.commodity_exposure;

    expect(eksposur.entity_type).toBe("trader");
    expect(eksposur.entity_factor).toBeCloseTo(0.7, 2);
    expect(eksposur.components.reserve_life).toBeCloseTo(100, 2);
    expect(eksposur.base_score).toBeCloseTo(86, 2);
    expect(eksposur.score).toBeCloseTo(60.2, 2);
    expect(eksposur.category).toBe("Tinggi");
    expect(isi.payload.production_trend.reserve_unit).toBe("wmt");
  });

  test("emiten tambang tanpa data di ekstensi mining tetap memakai mode standar", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-mi-bukan-tambang");

    const isi = await (
      await sesi.kirim("get", "/insights/market-intelligence/PTBA")
    ).json();

    expect(isi.subtype).toBe("sector_relative_snapshot");
    expect(isi.payload.mode).toBe("standard");
    expect(isi.payload.data_sources).toContain("/mining/companies/");
  });

  test("ticker di luar daftar IDX ditolak sebelum menyentuh Sectors", async ({
    request,
  }) => {
    const sesi = await sesiSiap(request, "insight-ticker");

    const redFlag = await sesi.kirim("get", "/insights/red-flag/ZZZZ");
    expect(redFlag.status()).toBe(422);
    expect((await redFlag.json()).fields.ticker).toBeTruthy();

    const marketIntel = await sesi.kirim(
      "get",
      "/insights/market-intelligence/ZZZZ",
    );
    expect(marketIntel.status()).toBe(422);
  });

  test("endpoint insight menolak pengunjung tanpa sesi", async ({
    request,
  }) => {
    expect((await request.get("/insights/red-flag/ANTM")).status()).toBe(401);
    expect(
      (await request.get("/insights/market-intelligence/ADRO")).status(),
    ).toBe(401);
  });
});
