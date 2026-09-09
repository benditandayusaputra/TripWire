import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { sesiMasuk } from "./helpers/akun";
import { langgananUji, pengirimanPush, resetPush } from "./helpers/dorongan";

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
      (item) => `http://127.0.0.1:8899${item.path}` === langganan.endpoint,
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
      (item) => `http://127.0.0.1:8899${item.path}` === langganan.endpoint,
    );
    expect(pertama.length).toBe(1);
    expect(pertama[0].gone).toBe(true);

    await resetPush(request);
    await picuInsight(sesi, "BBRI");

    const kedua = (await pengirimanPush(request)).filter(
      (item) => `http://127.0.0.1:8899${item.path}` === langganan.endpoint,
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
  });
});
