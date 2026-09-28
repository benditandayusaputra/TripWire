import { execFileSync, spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { sesiMasuk } from "./helpers/akun";
import { kueri } from "./helpers/database";
import { STUB_URL, langgananUji, pengirimanPush, resetPush } from "./helpers/dorongan";

type Sesi = Awaited<ReturnType<typeof sesiMasuk>>["sesi"];

const TTL_CACHE_MS = 2000;

async function sesiSiap(request: APIRequestContext, prefix: string) {
  const { akun, sesi } = await sesiMasuk(request, prefix);

  for (let percobaan = 0; percobaan < 40; percobaan += 1) {
    const response = await sesi.kirim("get", "/market/credits");
    if (response.ok() && (await response.json()).meta.circuit_open === false) {
      return { akun, sesi, csrf: { "X-CSRF-Token": sesi.cookie("tw_csrf") } };
    }
    await new Promise((selesai) => setTimeout(selesai, 500));
  }

  throw new Error("Circuit breaker Sectors tidak kunjung tertutup");
}

async function pantau(
  sesi: Sesi,
  csrf: Record<string, string>,
  ticker: string,
) {
  const response = await sesi.kirim("post", "/watchlist", {
    data: { ticker },
    headers: csrf,
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item;
}

async function tungguCache() {
  await new Promise((selesai) => setTimeout(selesai, TTL_CACHE_MS + 400));
}

async function picuInsight(sesi: Sesi, ticker: string) {
  await tungguCache();
  const response = await sesi.kirim("get", `/insights/red-flag/${ticker}`);
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe("Fase 8: notifikasi, web push, dan presence", () => {
  test("langganan push tersimpan lalu bisa dicabut pemiliknya", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "push-langganan");
    const langganan = langgananUji();

    const dibuat = await sesi.kirim("post", "/push/subscribe", {
      data: langganan,
      headers: csrf,
    });
    expect(dibuat.status()).toBe(201);
    expect((await dibuat.json()).subscription.endpoint).toBe(
      langganan.endpoint,
    );

    const ulang = await sesi.kirim("post", "/push/subscribe", {
      data: langganan,
      headers: csrf,
    });
    expect(ulang.status()).toBe(201);

    const kunci = Buffer.from(langganan.endpoint).toString("base64url");
    const dicabut = await sesi.kirim("delete", `/push/subscribe/${kunci}`, {
      headers: csrf,
    });
    expect(dicabut.status()).toBe(204);

    const lagi = await sesi.kirim("delete", `/push/subscribe/${kunci}`, {
      headers: csrf,
    });
    expect(lagi.status()).toBe(404);
  });

  test("langganan milik pengguna lain tidak bisa dicabut", async ({
    request,
  }) => {
    const { sesi: sesiA, csrf: csrfA } = await sesiSiap(request, "push-ownerA");
    const { sesi: sesiB, csrf: csrfB } = await sesiSiap(request, "push-ownerB");

    const langganan = langgananUji();
    expect(
      (
        await sesiA.kirim("post", "/push/subscribe", {
          data: langganan,
          headers: csrfA,
        })
      ).status(),
    ).toBe(201);

    const kunci = Buffer.from(langganan.endpoint).toString("base64url");
    const dicabutB = await sesiB.kirim("delete", `/push/subscribe/${kunci}`, {
      headers: csrfB,
    });
    expect(dicabutB.status()).toBe(404);

    const dicabutA = await sesiA.kirim("delete", `/push/subscribe/${kunci}`, {
      headers: csrfA,
    });
    expect(dicabutA.status()).toBe(204);
  });

  test("endpoint dan kunci langganan yang tidak masuk akal ditolak", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "push-validasi");
    const langganan = langgananUji();

    const bukanUrl = await sesi.kirim("post", "/push/subscribe", {
      data: { ...langganan, endpoint: "bukan-url" },
      headers: csrf,
    });
    expect(bukanUrl.status()).toBe(422);
    expect((await bukanUrl.json()).fields.endpoint).toBeTruthy();

    const kunciPendek = await sesi.kirim("post", "/push/subscribe", {
      data: { ...langganan, p256dh: "YWJj" },
      headers: csrf,
    });
    expect(kunciPendek.status()).toBe(422);
    expect((await kunciPendek.json()).fields.p256dh).toBeTruthy();
  });

  test("pengguna offline menerima insight baru lewat web push terenkripsi", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "push-kirim");
    await pantau(sesi, csrf, "BBRI");

    const langganan = langgananUji();
    expect(
      (
        await sesi.kirim("post", "/push/subscribe", {
          data: langganan,
          headers: csrf,
        })
      ).status(),
    ).toBe(201);

    await resetPush(request);
    const insight = await picuInsight(sesi, "BBRI");
    expect(insight.id).toBeTruthy();

    const pengiriman = (await pengirimanPush(request)).filter(
      (item) => `${STUB_URL}${item.path}` === langganan.endpoint,
    );

    expect(pengiriman.length).toBe(1);
    expect(pengiriman[0].method).toBe("POST");
    expect(pengiriman[0].content_encoding).toBe("aes128gcm");
    expect(pengiriman[0].authorization).toMatch(/^vapid t=/);
    expect(pengiriman[0].authorization).toContain("k=");
    expect(Number(pengiriman[0].ttl)).toBeGreaterThan(0);
    expect(pengiriman[0].body_bytes).toBeGreaterThan(0);
    expect(pengiriman[0].body_text).not.toContain("TripWire");
    expect(pengiriman[0].body_text).not.toContain("BBRI");
  });

  test("ambang skor kondisi event terbaru menyaring penerima notifikasi", async ({
    request,
  }) => {
    const ketat = await sesiSiap(request, "notif-ambang-ketat");
    const longgar = await sesiSiap(request, "notif-ambang-longgar");
    const campur = await sesiSiap(request, "notif-ambang-campur");

    async function kondisi(
      sesi: Sesi,
      csrf: Record<string, string>,
      itemId: string,
      jenis: string,
      config: Record<string, unknown>,
    ) {
      const response = await sesi.kirim(
        "post",
        `/watchlist/${itemId}/conditions`,
        { data: { condition_type: jenis, config }, headers: csrf },
      );
      expect(response.status()).toBe(201);
    }

    const itemKetat = await pantau(ketat.sesi, ketat.csrf, "BBRI");
    await kondisi(ketat.sesi, ketat.csrf, itemKetat.id, "recent_event", {
      min_score: 90,
    });

    const itemLonggar = await pantau(longgar.sesi, longgar.csrf, "BBRI");
    await kondisi(longgar.sesi, longgar.csrf, itemLonggar.id, "geopolitical", {
      min_score: 5,
    });

    const itemCampur = await pantau(campur.sesi, campur.csrf, "BBRI");
    await kondisi(campur.sesi, campur.csrf, itemCampur.id, "recent_event", {
      min_score: 90,
    });
    await kondisi(campur.sesi, campur.csrf, itemCampur.id, "daily", {});

    const insight = await picuInsight(ketat.sesi, "BBRI");
    expect(insight.score).toBeGreaterThan(5);
    expect(insight.score).toBeLessThan(90);

    async function menerima(sesi: Sesi) {
      const isi = await (await sesi.kirim("get", "/notifications")).json();
      return isi.notifications.some(
        (item: { insight_event_id: string }) =>
          item.insight_event_id === insight.id,
      );
    }

    expect(await menerima(ketat.sesi)).toBe(false);
    expect(await menerima(longgar.sesi)).toBe(true);
    expect(await menerima(campur.sesi)).toBe(true);
  });

  test("insight yang terkirim tercatat di riwayat notifikasi pemiliknya", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "notif-riwayat");
    await pantau(sesi, csrf, "BBRI");

    const insight = await picuInsight(sesi, "BBRI");

    const riwayat = await sesi.kirim("get", "/notifications");
    expect(riwayat.status()).toBe(200);

    const isi = await riwayat.json();
    const cocok = isi.notifications.find(
      (item: { insight_event_id: string }) =>
        item.insight_event_id === insight.id,
    );

    expect(cocok).toBeTruthy();
    expect(cocok.ticker).toBe("BBRI");
    expect(cocok.insight_type).toBe("red_flag");
    expect(cocok.read_at).toBeNull();
    expect(isi.unread).toBeGreaterThanOrEqual(1);
    expect(isi.online).toBe(false);

    const dibaca = await sesi.kirim(
      "patch",
      `/notifications/${cocok.id}/read`,
      { headers: csrf },
    );
    expect(dibaca.status()).toBe(200);
    expect((await dibaca.json()).notification.read_at).not.toBeNull();
  });

  test("notifikasi pengguna lain dijawab 404 saat ditandai dibaca", async ({
    request,
  }) => {
    const { sesi: sesiA, csrf: csrfA } = await sesiSiap(
      request,
      "notif-ownerA",
    );
    const { sesi: sesiB, csrf: csrfB } = await sesiSiap(
      request,
      "notif-ownerB",
    );

    await pantau(sesiA, csrfA, "BBRI");
    const insight = await picuInsight(sesiA, "BBRI");

    const riwayat = await (await sesiA.kirim("get", "/notifications")).json();
    const milikA = riwayat.notifications.find(
      (item: { insight_event_id: string }) =>
        item.insight_event_id === insight.id,
    );
    expect(milikA).toBeTruthy();

    const dariB = await sesiB.kirim(
      "patch",
      `/notifications/${milikA.id}/read`,
      { headers: csrfB },
    );
    expect(dariB.status()).toBe(404);
  });

  test("langganan yang ditolak push service dengan status 410 ikut dibersihkan", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "push-mati");
    await pantau(sesi, csrf, "BBRI");

    const langganan = langgananUji("__push/hilang");
    expect(
      (
        await sesi.kirim("post", "/push/subscribe", {
          data: langganan,
          headers: csrf,
        })
      ).status(),
    ).toBe(201);

    await resetPush(request);
    await picuInsight(sesi, "BBRI");

    const pertama = (await pengirimanPush(request)).filter(
      (item) => `${STUB_URL}${item.path}` === langganan.endpoint,
    );
    expect(pertama.length).toBe(1);
    expect(pertama[0].gone).toBe(true);

    await resetPush(request);
    await picuInsight(sesi, "BBRI");

    const kedua = (await pengirimanPush(request)).filter(
      (item) => `${STUB_URL}${item.path}` === langganan.endpoint,
    );
    expect(kedua.length).toBe(0);
  });

  test("kunci publik VAPID tersedia untuk frontend dan endpoint realtime butuh sesi", async ({
    request,
  }) => {
    const { sesi } = await sesiSiap(request, "push-kunci");

    const kunci = await sesi.kirim("get", "/push/public-key");
    expect(kunci.status()).toBe(200);

    const isi = await kunci.json();
    expect(isi.enabled).toBe(true);
    expect(isi.public_key.length).toBeGreaterThan(80);

    expect((await request.get("/stream")).status()).toBe(401);
    expect((await request.get("/notifications")).status()).toBe(401);
    expect((await request.post("/push/subscribe")).status()).toBe(401);
    expect((await request.get("/notifications/summary")).status()).toBe(401);
    expect((await request.get("/push/subscriptions")).status()).toBe(401);
    expect((await request.post("/push/test")).status()).toBe(401);
  });
});

function idPengguna(email: string) {
  return kueri(`SELECT id FROM users WHERE email = '${email}'`);
}

function sisipkan(userId: string, eventId: string, jamLalu: number, dibaca = false) {
  return kueri(
    `INSERT INTO notifications (user_id, insight_event_id, sent_at, read_at)
     VALUES ('${userId}', '${eventId}', now() - interval '${jamLalu} hours', ${dibaca ? "now()" : "NULL"})
     RETURNING id`,
  ).split("\n")[0];
}

async function idInsight(sesi: Sesi, jalur: string) {
  const response = await sesi.kirim("get", jalur);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).id as string;
}

type ItemNotifikasi = {
  id: string;
  ticker: string;
  insight_type: string;
  read_at: string | null;
  company_name?: string;
  score?: number;
  prev_score?: number;
  category?: string;
  sub_scores?: Record<string, number>;
  signals?: string[];
};

async function daftar(sesi: Sesi, query = "") {
  const response = await sesi.kirim("get", `/notifications${query}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    notifications: ItemNotifikasi[];
    unread: number;
    next_cursor: string | null;
  };
}

test.describe("Fase 8: pusat notifikasi", () => {
  test("riwayat bisa disaring, dipaginasi, dan diringkas per hari dan emiten", async ({
    request,
  }) => {
    const { akun, sesi, csrf } = await sesiSiap(request, "notif-pusat");
    await pantau(sesi, csrf, "BBRI");
    const pertama = await picuInsight(sesi, "BBRI");
    await picuInsight(sesi, "BBRI");

    const userId = idPengguna(akun.email);
    sisipkan(userId, await idInsight(sesi, "/insights/red-flag/ITMG"), 26);
    sisipkan(userId, await idInsight(sesi, "/insights/red-flag/TLKM"), 72, true);
    sisipkan(userId, await idInsight(sesi, "/insights/market-intelligence/BBCA"), 240);

    const semua = await daftar(sesi);
    expect(semua.notifications.map((item) => item.ticker)).toEqual([
      "BBRI",
      "BBRI",
      "ITMG",
      "TLKM",
      "BBCA",
    ]);
    expect(semua.unread).toBe(4);

    const [bbriBaru] = semua.notifications;
    expect(bbriBaru.company_name).toContain("Bank Rakyat Indonesia");
    expect(bbriBaru.prev_score).toBeCloseTo(pertama.score, 2);

    const itmg = semua.notifications[2];
    expect(itmg.score).toBe(100);
    expect(itmg.category).toBe("Kritis");
    expect(Object.keys(itmg.sub_scores ?? {}).sort()).toEqual([
      "insider_clustering",
      "ownership_change",
      "suspension",
    ]);
    expect(itmg.signals).toHaveLength(3);

    const kritis = await daftar(sesi, "?tier=critical");
    expect(kritis.notifications.map((item) => item.ticker)).toEqual(["ITMG"]);

    const intel = await daftar(sesi, "?type=market_intelligence");
    expect(intel.notifications.map((item) => item.ticker)).toEqual(["BBCA"]);

    const belum = await daftar(sesi, "?status=unread");
    expect(belum.notifications).toHaveLength(4);
    expect(belum.notifications.some((item) => item.ticker === "TLKM")).toBe(false);

    const bbri = await daftar(sesi, "?ticker=bbri");
    expect(bbri.notifications.map((item) => item.ticker)).toEqual(["BBRI", "BBRI"]);

    const halaman1 = await daftar(sesi, "?limit=2");
    const halaman2 = await daftar(sesi, `?limit=2&before=${halaman1.next_cursor}`);
    const halaman3 = await daftar(sesi, `?limit=2&before=${halaman2.next_cursor}`);
    expect(
      [halaman1, halaman2, halaman3].flatMap((satu) =>
        satu.notifications.map((item) => item.id),
      ),
    ).toEqual(semua.notifications.map((item) => item.id));
    expect(halaman3.next_cursor).toBeNull();

    for (const [query, field] of [
      ["?status=aneh", "status"],
      ["?tier=merah", "tier"],
      ["?type=saham", "type"],
      ["?before=bukan-uuid", "before"],
    ]) {
      const salah = await sesi.kirim("get", `/notifications${query}`);
      expect(salah.status()).toBe(422);
      expect((await salah.json()).fields[field]).toBeTruthy();
    }

    const ringkasan = await (await sesi.kirim("get", "/notifications/summary")).json();
    expect(ringkasan).toMatchObject({
      total: 5,
      unread: 4,
      red_flag: 4,
      market_intelligence: 1,
      critical: 1,
      last_7_days: 4,
      critical_7_days: 1,
      last_30_days: 5,
      push_enabled: true,
      push_devices: 0,
    });
    expect(ringkasan.critical + ringkasan.high + ringkasan.moderate + ringkasan.low).toBe(4);
    expect(ringkasan.peak_30_days).toMatchObject({ ticker: "ITMG", score: 100 });

    expect(ringkasan.daily).toHaveLength(30);
    const hari = (jamLalu: number) =>
      new Date(Date.now() - jamLalu * 3_600_000).toLocaleDateString("en-CA", {
        timeZone: "Asia/Jakarta",
      });
    const perTanggal = Object.fromEntries(
      ringkasan.daily.map((satu: { date: string }) => [satu.date, satu]),
    );
    expect(ringkasan.daily.at(-1).date).toBe(hari(0));
    expect(perTanggal[hari(26)].critical).toBeGreaterThanOrEqual(1);
    expect(perTanggal[hari(240)].market).toBeGreaterThanOrEqual(1);
    expect(
      ringkasan.daily.reduce((jumlah: number, satu: { total: number }) => jumlah + satu.total, 0),
    ).toBe(5);

    const emiten = Object.fromEntries(
      ringkasan.tickers.map((satu: { ticker: string }) => [satu.ticker, satu]),
    );
    expect(emiten.BBRI).toMatchObject({ total: 2, unread: 2, recent_30_days: 2 });
    expect(emiten.BBRI.scores).toHaveLength(2);
    expect(emiten.ITMG.latest_score).toBe(100);
    expect(emiten.BBCA.latest_score).toBeNull();
  });

  test("notifikasi bisa ditandai, dikembalikan, dihapus, dan dibersihkan hanya oleh pemiliknya", async ({
    request,
  }) => {
    const a = await sesiSiap(request, "notif-aksi-a");
    const b = await sesiSiap(request, "notif-aksi-b");
    const userA = idPengguna(a.akun.email);
    const itmg = await idInsight(a.sesi, "/insights/red-flag/ITMG");
    const tlkm = await idInsight(a.sesi, "/insights/red-flag/TLKM");

    const satu = sisipkan(userA, itmg, 1);
    const dua = sisipkan(userA, tlkm, 2);
    const tiga = sisipkan(userA, tlkm, 3);

    expect(
      (await a.sesi.kirim("patch", `/notifications/${satu}/read`, { headers: a.csrf })).status(),
    ).toBe(200);
    const kembali = await a.sesi.kirim("delete", `/notifications/${satu}/read`, {
      headers: a.csrf,
    });
    expect(kembali.status()).toBe(200);
    expect((await kembali.json()).notification.read_at).toBeNull();

    for (const [method, jalur] of [
      ["patch", `/notifications/${satu}/read`],
      ["delete", `/notifications/${satu}/read`],
      ["delete", `/notifications/${satu}`],
    ] as const) {
      expect((await b.sesi.kirim(method, jalur, { headers: b.csrf })).status()).toBe(404);
    }
    expect(
      (await a.sesi.kirim("delete", "/notifications/bukan-uuid", { headers: a.csrf })).status(),
    ).toBe(404);
    expect((await a.sesi.kirim("post", "/notifications/read-all")).status()).toBe(403);

    const semua = await a.sesi.kirim("post", "/notifications/read-all", { headers: a.csrf });
    expect(semua.status()).toBe(200);
    expect((await semua.json()).updated).toBe(3);
    expect((await daftar(a.sesi)).unread).toBe(0);

    expect(
      (await a.sesi.kirim("delete", `/notifications/${dua}`, { headers: a.csrf })).status(),
    ).toBe(204);
    expect(
      (await a.sesi.kirim("delete", `/notifications/${dua}`, { headers: a.csrf })).status(),
    ).toBe(404);

    await a.sesi.kirim("delete", `/notifications/${tiga}/read`, { headers: a.csrf });
    const bersih = await a.sesi.kirim("delete", "/notifications/read", { headers: a.csrf });
    expect(bersih.status()).toBe(200);
    expect((await bersih.json()).deleted).toBe(1);

    expect((await daftar(a.sesi)).notifications.map((item) => item.id)).toEqual([tiga]);
    expect(kueri(`SELECT count(*) FROM notifications WHERE id = '${satu}'`)).toBe("0");
  });

  test("push uji dikirim terenkripsi ke semua perangkat pengguna dan dibatasi", async ({
    request,
  }) => {
    const { sesi, csrf } = await sesiSiap(request, "push-uji");
    const perangkat = [langgananUji(), langgananUji()];
    for (const langganan of perangkat) {
      expect(
        (await sesi.kirim("post", "/push/subscribe", { data: langganan, headers: csrf })).status(),
      ).toBe(201);
    }

    const terdaftar = await sesi.kirim("get", "/push/subscriptions");
    const isi = await terdaftar.json();
    expect(isi.subscriptions.map((item: { endpoint: string }) => item.endpoint).sort()).toEqual(
      perangkat.map((item) => item.endpoint).sort(),
    );
    expect(JSON.stringify(isi)).not.toContain(perangkat[0].p256dh);

    await resetPush(request);
    const uji = await sesi.kirim("post", "/push/test", { headers: csrf });
    expect(uji.status()).toBe(200);
    expect(await uji.json()).toEqual({ devices: 2, delivered: 2 });

    const terkirim = (await pengirimanPush(request)).filter((item) =>
      perangkat.some((satu) => satu.endpoint === `${STUB_URL}${item.path}`),
    );
    expect(terkirim).toHaveLength(2);
    expect(terkirim.every((item) => item.content_encoding === "aes128gcm")).toBe(true);
    expect(terkirim.every((item) => !item.body_text.includes("TripWire"))).toBe(true);

    let status = 200;
    for (let percobaan = 0; percobaan < 5 && status !== 429; percobaan += 1) {
      status = (await sesi.kirim("post", "/push/test", { headers: csrf })).status();
    }
    expect(status).toBe(429);
  });

  test("insight dari proses lain diteruskan lewat Redis ke pengguna yang sedang online", async ({
    request,
  }) => {
    const { akun, sesi, csrf } = await sesiSiap(request, "sse-jembatan");
    await pantau(sesi, csrf, "BBRI");
    const langganan = langgananUji();
    expect(
      (await sesi.kirim("post", "/push/subscribe", { data: langganan, headers: csrf })).status(),
    ).toBe(201);

    const userId = idPengguna(akun.email);
    const pendengar = spawn("redis-cli", ["-n", "1", "SUBSCRIBE", "stream:siaran"]);
    let keluaran = "";
    pendengar.stdout.on("data", (potongan) => (keluaran += potongan));

    try {
      await expect.poll(() => keluaran.includes("stream:siaran")).toBe(true);
      execFileSync("redis-cli", ["-n", "1", "SET", `presence:${userId}`, "uji", "EX", "60"]);

      await resetPush(request);
      const insight = await picuInsight(sesi, "BBRI");

      await expect.poll(() => keluaran.includes(userId), { timeout: 5000 }).toBe(true);
      const baris = keluaran.split("\n").find((satu) => satu.includes(userId)) ?? "{}";
      const siaran = JSON.parse(baris);
      expect(siaran.event.type).toBe("insight");
      expect(siaran.event.data.insight_id).toBe(insight.id);
      expect(siaran.event.data.ticker).toBe("BBRI");

      const push = (await pengirimanPush(request)).filter(
        (item) => `${STUB_URL}${item.path}` === langganan.endpoint,
      );
      expect(push).toHaveLength(0);
    } finally {
      pendengar.kill();
      execFileSync("redis-cli", ["-n", "1", "DEL", `presence:${userId}`]);
    }
  });
});
