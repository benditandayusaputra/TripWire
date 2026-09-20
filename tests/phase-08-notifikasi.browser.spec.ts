import { expect, test } from "@playwright/test";
import { masukLewatBrowser, sesiMasuk } from "./helpers/akun";
import { kueri } from "./helpers/database";
import { redisAda } from "./helpers/dorongan";

const TTL_CACHE_MS = 2000;

test.describe("Fase 8: insight baru muncul realtime tanpa muat ulang", () => {
  test("SSE mengantar insight ke layar dan presence tercatat di Redis", async ({
    page,
    request,
  }) => {
    const akun = await masukLewatBrowser(page, "sse-live");

    await page.getByTestId("nav-watchlist").click();
    await expect(page).toHaveURL(/\/watchlist/);
    await page.getByLabel("Kode emiten").fill("BBRI");
    await page.getByTestId("tambah-ticker").click();
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

    await page.goto("/dashboard");
    await expect
      .poll(() => redisAda(`presence:${userID}`), {
        timeout: 20_000,
        intervals: [500],
      })
      .toBe(false);
  });
});
