import { describe, it, expect, afterEach } from "vitest";
import { GET } from "@/app/api/instagram-status/route";

/**
 * `checkInstagramConfig()` 자체 판정 로직은 `@/lib/instagram-config.test.ts` 가 이미 촘촘히
 * 덮는다 — 여기서는 이 라우트가 그 결과를 **그대로 요약해서만** 돌려주는지(특히 `ready: true`
 * 일 때 `config`/토큰 값을 절대 실어 보내지 않는지)만 확인한다.
 */

const ENV_KEYS = [
  "PUBLIC_BASE_URL",
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_GRAPH_HOST",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

afterEach(clearEnv);

describe("GET /api/instagram-status", () => {
  it("설정이 하나도 없으면 ready:false 와 빠진 항목 두 개를 돌려준다", async () => {
    clearEnv();

    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.missing).toHaveLength(2);
  });

  it("토큰만 없으면 토큰 항목만 빠졌다고 알려준다", async () => {
    clearEnv();
    process.env.PUBLIC_BASE_URL = "https://example.ngrok-free.app";
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";

    const res = await GET();

    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.missing).toEqual(["인스타그램 액세스 토큰(INSTAGRAM_ACCESS_TOKEN)"]);
  });

  it("셋 다 있으면 ready:true 만 돌려주고 설정값·토큰은 응답에 담지 않는다", async () => {
    clearEnv();
    process.env.PUBLIC_BASE_URL = "https://example.ngrok-free.app";
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";
    process.env.INSTAGRAM_ACCESS_TOKEN = "long-lived-secret-token";

    const res = await GET();

    const data = await res.json();
    expect(data).toEqual({ ready: true });
    expect(JSON.stringify(data)).not.toContain("long-lived-secret-token");
  });

  // 인스타그램이 Blob 주소에서 직접 가져가므로 공개 주소는 더 이상 게시 조건이 아니다.
  it("공개 주소가 없어도 ready:true 다 — 인스타그램은 Blob 에서 가져간다", async () => {
    clearEnv();
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";
    process.env.INSTAGRAM_ACCESS_TOKEN = "long-lived-secret-token";

    const res = await GET();

    const data = await res.json();
    expect(data.ready).toBe(true);
  });

  it("토큰이 없으면 connected:false 로 연결 자체가 안 됐음을 알려준다", async () => {
    clearEnv();
    process.env.PUBLIC_BASE_URL = "https://example.ngrok-free.app";
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";

    const res = await GET();

    const data = await res.json();
    expect(data.ready).toBe(false);
    expect(data.connected).toBe(false);
  });
});
