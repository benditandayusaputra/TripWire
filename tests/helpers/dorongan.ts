import { createECDH, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import type { APIRequestContext } from "@playwright/test";

export const STUB_URL = `http://127.0.0.1:${process.env.SECTORS_STUB_PORT ?? "8899"}`;

export type Pengiriman = {
  path: string;
  gone: boolean;
  method: string;
  authorization: string;
  content_encoding: string;
  ttl: string;
  body_bytes: number;
  body_base64: string;
  body_text: string;
};

export function langgananUji(jalur = "__push") {
  const kunci = createECDH("prime256v1");
  kunci.generateKeys();

  return {
    endpoint: `${STUB_URL}/${jalur}/${randomBytes(8).toString("hex")}`,
    p256dh: kunci.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

export async function pengirimanPush(
  request: APIRequestContext,
): Promise<Pengiriman[]> {
  const response = await request.get(`${STUB_URL}/__stub/push`);
  return (await response.json()).deliveries as Pengiriman[];
}

export async function resetPush(request: APIRequestContext) {
  await request.post(`${STUB_URL}/__stub/push/reset`);
}

export function redisAda(kunci: string): boolean {
  const keluaran = execFileSync("redis-cli", ["-n", "1", "exists", kunci], {
    encoding: "utf8",
  });
  return keluaran.trim() === "1";
}
