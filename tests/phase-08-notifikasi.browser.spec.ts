import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { masukLewatBrowser, sesiMasuk } from "./helpers/akun";
import { kueri } from "./helpers/database";
import { langgananUji, redisAda } from "./helpers/dorongan";
import { tambahSaham } from "./helpers/watchlist";

const TTL_CACHE_MS = 2000;

function sisipkan(userId: string, eventId: string, jamLalu: number) {
  kueri(
    `INSERT INTO notifications (user_id, insight_event_id, sent_at)
     VALUES ('${userId}', '${eventId}', now() - interval '${jamLalu} hours')`,
  );
}

async function apiBrowser(page: Page, method: string, jalur: string, data?: unknown) {
  return page.evaluate(
    async ({ method, jalur, data }) => {
      const csrf = document.cookie.match(/(?:^|; )tw_csrf=([^;]*)/)?.[1] ?? "";
      const response = await fetch(`/api${jalur}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": decodeURIComponent(csrf),
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      return { status: response.status, isi: await response.json().catch(() => null) };
    },
    { method, jalur, data },
  );
}

const baris = (page: Page, ticker: string) =>
  page.locator(`[data-testid="notifikasi-item"][data-ticker="${ticker}"]`);

test.describe("Fase 8: insight baru muncul realtime tanpa muat ulang", () => {
  test("SSE mengantar insight ke layar dan presence tercatat di Redis", async ({
    page,
    request,
  }) => {
    const akun = await masukLewatBrowser(page, "sse-live");

    await page.getByTestId("nav-watchlist").click();
    await expect(page).toHaveURL(/\/watchlist/);
    await tambahSaham(page, "BBRI");
    await expect(
      page.getByTestId("watchlist-item").filter({ hasText: "BBRI" }),
    ).toBeVisible();

    await page.goto("/notifications");

    await expect(page.getByTestId("status-stream")).toHaveAttribute(
      "data-terhubung",
      "true",
    );
    await expect(page.getByTestId("insight-live-kosong")).toBeVisible();

    const userID = kueri(`SELECT id FROM users WHERE email = '${akun.email}'`);
    expect(userID).not.toBe("");
    await expect
      .poll(() => redisAda(`presence:${userID}`), { timeout: 5000 })
      .toBe(true);

    await page.evaluate(() => {
      (window as unknown as { penandaHalaman: string }).penandaHalaman =
        "belum-dimuat-ulang";
    });

    const { sesi } = await sesiMasuk(request, "sse-pemicu");
    await new Promise((selesai) => setTimeout(selesai, TTL_CACHE_MS + 400));
    const dipicu = await sesi.kirim("get", "/insights/red-flag/BBRI");
    expect(dipicu.status(), await dipicu.text()).toBe(200);

    const kartu = page
      .getByTestId("insight-live-item")
      .filter({ hasText: "BBRI" });
    await expect(kartu).toHaveCount(1, { timeout: 10_000 });
    await expect(kartu).toContainText("Bank Rakyat Indonesia");

    const penanda = await page.evaluate(
      () => (window as unknown as { penandaHalaman?: string }).penandaHalaman,
    );
    expect(penanda).toBe("belum-dimuat-ulang");

    await expect(page.getByTestId("notifikasi-riwayat")).not.toContainText(
      "BBRI",
    );

    await page.reload();
    await expect(page.getByTestId("notifikasi-riwayat")).toContainText("BBRI");
  });

  test("dashboard menerima insight baru lewat SSE tanpa muat ulang", async ({
    page,
    request,
  }) => {
    await masukLewatBrowser(page, "sse-dashboard");

    await page.goto("/watchlist");
    await tambahSaham(page, "BBRI");
    await expect(
      page.getByTestId("watchlist-item").filter({ hasText: "BBRI" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByTestId("status-live")).toHaveAttribute(
      "data-terhubung",
      "true",
    );
    await page.evaluate(() => {
      (window as unknown as { penandaHalaman: string }).penandaHalaman =
        "belum-dimuat-ulang";
    });

    const { sesi } = await sesiMasuk(request, "sse-dashboard-pemicu");
    await new Promise((selesai) => setTimeout(selesai, TTL_CACHE_MS + 400));
    const dipicu = await sesi.kirim("get", "/insights/red-flag/BBRI");
    expect(dipicu.status(), await dipicu.text()).toBe(200);

    await expect(page.getByTestId("kabar-insight")).toContainText("BBRI", {
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("insight-card").filter({ hasText: "BBRI" }).first(),
    ).toBeVisible();

    const penanda = await page.evaluate(
      () => (window as unknown as { penandaHalaman?: string }).penandaHalaman,
    );
    expect(penanda).toBe("belum-dimuat-ulang");
  });

  test("presence dilepas dari Redis setelah koneksi stream ditutup", async ({
    page,
  }) => {
    const akun = await masukLewatBrowser(page, "sse-presence");
    await page.goto("/notifications");

    await expect(page.getByTestId("status-stream")).toHaveAttribute(
      "data-terhubung",
      "true",
    );

    const userID = kueri(`SELECT id FROM users WHERE email = '${akun.email}'`);
    await expect
      .poll(() => redisAda(`presence:${userID}`), { timeout: 5000 })
      .toBe(true);

    await page.goto("/account");
    await expect
      .poll(() => redisAda(`presence:${userID}`), {
        timeout: 20_000,
        intervals: [500],
      })
      .toBe(false);
  });

  test("insight yang disiarkan proses lain lewat Redis tampil langsung di halaman", async ({
    page,
  }) => {
    const akun = await masukLewatBrowser(page, "sse-siaran");
    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute(
      "data-terhubung",
      "true",
    );

    const userID = kueri(`SELECT id FROM users WHERE email = '${akun.email}'`);
    execFileSync("redis-cli", [
      "-n",
      "1",
      "PUBLISH",
      "stream:siaran",
      JSON.stringify({
        user_id: userID,
        event: {
          type: "insight",
          data: {
            notification_id: randomUUID(),
            insight_id: randomUUID(),
            ticker: "ANTM",
            company_name: "Aneka Tambang",
            insight_type: "red_flag",
            subtype: "governance_risk_composite",
            score: 97.4,
            category: "Kritis",
          },
        },
      }),
    ]);

    const kartu = page.getByTestId("insight-live-item").filter({ hasText: "ANTM" });
    await expect(kartu).toHaveCount(1, { timeout: 10_000 });
    await expect(kartu).toContainText("Aneka Tambang");
    await expect(kartu).toContainText("Risiko tata kelola kritis");
  });
});

test.describe("Fase 8: pusat notifikasi bergaya aplikasi saham", () => {
  test("KPI, lencana, filter, dan aksi baca hapus bekerja tanpa muat ulang", async ({
    page,
    request,
  }) => {
    const akun = await masukLewatBrowser(page, "pusat-notif");
    const userID = kueri(`SELECT id FROM users WHERE email = '${akun.email}'`);

    const { sesi } = await sesiMasuk(request, "pusat-notif-pemicu");
    const idInsight = async (jalur: string) =>
      (await (await sesi.kirim("get", jalur)).json()).id as string;
    const itmg = await idInsight("/insights/red-flag/ITMG");
    const tlkm = await idInsight("/insights/red-flag/TLKM");
    const bbca = await idInsight("/insights/market-intelligence/BBCA");

    for (const ticker of ["ITMG", "TLKM", "BBCA"]) {
      expect((await apiBrowser(page, "POST", "/watchlist", { ticker })).status).toBe(201);
    }
    sisipkan(userID, itmg, 1);
    sisipkan(userID, tlkm, 30);
    sisipkan(userID, bbca, 50);

    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute("data-terhubung", "true");
    await expect(page.getByTestId("kpi-belum")).toHaveText("3");
    await expect(page.getByTestId("lencana-notifikasi")).toContainText("3");
    await expect(page.getByTestId("notifikasi-item")).toHaveCount(3);
    for (const baris of await page.getByTestId("notifikasi-item").all()) {
      const kode = await baris.getAttribute("data-ticker");
      await expect(baris.getByTestId("logo-emiten")).toHaveAttribute(
        "src",
        `https://storage.googleapis.com/sectorsapp-sea/logo/${kode}.webp`,
      );
    }
    await expect(page.getByTestId("aktivitas-total")).toHaveText("3");
    await expect(page.getByTestId("kpi-puncak")).toContainText("100");
    await expect(page.getByTestId("emiten-teraktif")).toContainText("ITMG");
    await expect(baris(page, "ITMG")).toContainText("Risiko tata kelola kritis");

    await page.getByTestId("chip-critical").click();
    await expect(page).toHaveURL(/tier=critical/);
    await expect(page.getByTestId("notifikasi-item")).toHaveCount(1);
    await expect(baris(page, "ITMG")).toBeVisible();

    await page.getByTestId("tab-market").click();
    await expect(page).toHaveURL(/type=market_intelligence/);
    await expect(page).not.toHaveURL(/tier=/);
    await expect(page.getByTestId("notifikasi-item")).toHaveCount(1);
    await expect(baris(page, "BBCA")).toBeVisible();

    await page.getByTestId("reset-filter").click();
    await expect(page).toHaveURL(/\/notifications$/);
    await page.getByTestId("filter-emiten").selectOption("TLKM");
    await expect(page).toHaveURL(/ticker=TLKM/);
    await expect(page.getByTestId("notifikasi-item")).toHaveCount(1);
    await page.getByTestId("reset-filter").click();
    await expect(page.getByTestId("notifikasi-item")).toHaveCount(3);

    await baris(page, "ITMG").getByTestId("tandai-dibaca").click();
    await expect(baris(page, "ITMG")).toHaveAttribute("data-dibaca", "true");
    await expect(page.getByTestId("kpi-belum")).toHaveText("2");
    await expect(page.getByTestId("lencana-notifikasi")).toContainText("2");

    await baris(page, "ITMG").getByTestId("tandai-belum").click();
    await expect(baris(page, "ITMG")).toHaveAttribute("data-dibaca", "false");
    await expect(page.getByTestId("kpi-belum")).toHaveText("3");

    await baris(page, "BBCA").getByTestId("hapus-notifikasi").click();
    await expect(baris(page, "BBCA")).toHaveCount(0);
    await expect(page.getByTestId("kpi-belum")).toHaveText("2");
    expect(kueri(`SELECT count(*) FROM notifications WHERE user_id = '${userID}'`)).toBe("2");

    await baris(page, "TLKM").locator("a").first().click();
    await expect(page).toHaveURL(/\/insights\//, { timeout: 30_000 });
    await expect
      .poll(() =>
        kueri(
          `SELECT count(*) FROM notifications n JOIN insight_events e ON e.id = n.insight_event_id
           WHERE n.user_id = '${userID}' AND e.ticker = 'TLKM' AND n.read_at IS NOT NULL`,
        ),
      )
      .toBe("1");

    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute("data-terhubung", "true");
    await expect(page.getByTestId("kpi-belum")).toHaveText("1");
    await page.getByTestId("tandai-semua").click();
    await expect(page.getByTestId("kpi-belum")).toHaveText("0");
    await expect(page.getByTestId("lencana-notifikasi")).toHaveCount(0);

    await page.getByTestId("bersihkan-dibaca").click();
    await page.getByTestId("konfirmasi-bersih").click();
    await expect(page.getByTestId("kosong-total")).toBeVisible();
    expect(kueri(`SELECT count(*) FROM notifications WHERE user_id = '${userID}'`)).toBe("0");
  });

  test("perangkat push dan aturan peringatan diatur dari pusat notifikasi", async ({ page }) => {
    await masukLewatBrowser(page, "notif-pengaturan");

    const tambah = await apiBrowser(page, "POST", "/watchlist", { ticker: "ANTM" });
    expect(tambah.status).toBe(201);
    const item = tambah.isi.item;
    expect(
      (
        await apiBrowser(page, "POST", `/watchlist/${item.id}/conditions`, {
          condition_type: "recent_event",
          config: { min_score: 60 },
        })
      ).status,
    ).toBe(201);

    const langganan = langgananUji();
    expect((await apiBrowser(page, "POST", "/push/subscribe", langganan)).status).toBe(201);

    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute("data-terhubung", "true");
    await expect(page.getByTestId("jumlah-perangkat")).toHaveText("1");
    await expect(page.getByTestId("perangkat-push")).toHaveCount(1);

    const sakelar = page.getByTestId("sakelar-kondisi");
    await expect(sakelar).toHaveAttribute("aria-checked", "true");
    await sakelar.click();
    await expect(sakelar).toHaveAttribute("aria-checked", "false");
    expect(
      kueri(`SELECT is_active FROM watch_conditions WHERE watchlist_item_id = '${item.id}'`),
    ).toBe("f");

    await page.getByTestId("cabut-perangkat").click();
    await expect(page.getByTestId("perangkat-push")).toHaveCount(0);
    expect(
      kueri(`SELECT count(*) FROM push_subscriptions WHERE endpoint = '${langganan.endpoint}'`),
    ).toBe("0");
  });
});

test.describe("Fase 8: contoh notifikasi untuk demo", () => {
  test("tombol contoh mengirim ulang insight asli dari watchlist sebagai notifikasi live", async ({
    page,
  }) => {
    await masukLewatBrowser(page, "contoh-notif");

    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute(
      "data-terhubung",
      "true",
    );
    await page.getByTestId("kirim-contoh").click();
    await expect(page.getByTestId("pesan-contoh")).toContainText(
      "Belum ada insight dari watchlist kamu",
    );

    await page.goto("/watchlist");
    await tambahSaham(page, "ANTM");
    const dipicu = await apiBrowser(page, "GET", "/insights/red-flag/ANTM");
    expect(dipicu.status).toBe(200);

    await page.goto("/notifications");
    await expect(page.getByTestId("status-stream")).toHaveAttribute(
      "data-terhubung",
      "true",
    );
    const sebelum = await page
      .getByTestId("insight-live-item")
      .filter({ hasText: "ANTM" })
      .count();

    await page.getByTestId("kirim-contoh").click();
    await expect(page.getByTestId("pesan-contoh")).toContainText("ANTM");
    await expect(
      page.getByTestId("insight-live-item").filter({ hasText: "ANTM" }),
    ).toHaveCount(sebelum + 1, { timeout: 10_000 });
  });
});
