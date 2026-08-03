import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/share/route";

/**
 * `isLocalHost()` 자체 판정 로직은 `@/lib/local-guard.test.ts`가 촘촘히 덮는다 — 여기서는
 * 이 라우트가 그 판정을 실제로 앞단에 붙였는지(로컬이 아니면 기존 로직까지 가지 않고
 * 403으로 먼저 막는지, 로컬이면 기존 검증으로 그대로 넘어가는지)만 확인한다.
 */
function makeRequest(host: string, body: unknown): Request {
  return new Request("http://x/api/share", {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/share 로컬 전용 가드", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막고 한국어로 안내한다", async () => {
    const res = await POST(makeRequest("192.168.0.5:3500", { keyword: "k", images: ["AAAA"] }));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });

  it("localhost로 온 요청은 가드를 통과해 기존 검증(이미지 없음 400)으로 넘어간다", async () => {
    const res = await POST(makeRequest("localhost:3500", { keyword: "k", images: [] }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("이미지");
  });
});
