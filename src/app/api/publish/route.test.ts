import { describe, it, expect, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { POST } from "@/app/api/publish/route";

/**
 * `isLocalHost()` 자체 판정 로직은 `@/lib/local-guard.test.ts`가 촘촘히 덮는다 — 여기서는
 * 이 라우트가 그 판정을 실제로 앞단에 붙였는지만 확인한다. 인스타그램 설정을 모두 비워
 * 로컬 요청이 가드를 통과한 뒤 어디서 막히는지(설정 없음 400)를 결정론적으로 만든다.
 */
const ENV_KEYS = ["PUBLIC_BASE_URL", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"] as const;
function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}
afterEach(clearEnv);

function makeRequest(host: string, body: unknown): Request {
  return new Request("http://x/api/publish", {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/publish 로컬 전용 가드", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막고 한국어로 안내한다", async () => {
    clearEnv();
    const res = await POST(makeRequest("10.0.0.7:3500", { token: randomUUID(), caption: "" }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });

  it("localhost로 온 요청은 가드를 통과해 기존 검증(설정 없음 400)으로 넘어간다", async () => {
    clearEnv();
    const res = await POST(makeRequest("localhost:3500", { token: randomUUID(), caption: "" }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("설정");
  });
});
