import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { GET } from "@/app/api/publish-progress/route";
import { recordPublishProgress } from "@/lib/publish-progress-store";

/**
 * `isLocalHost()` 자체 판정 로직은 `@/lib/local-guard.test.ts`가 촘촘히 덮는다 — 여기서는
 * 이 라우트가 그 판정을 실제로 앞단에 붙였는지만 확인한다(`@/app/api/publish/route.test.ts`와
 * 같은 방식).
 */

function makeRequest(host: string, token: string | null): Request {
  const url = new URL("http://x/api/publish-progress");
  if (token !== null) url.searchParams.set("token", token);
  return new Request(url, { headers: { host } });
}

describe("GET /api/publish-progress 로컬 전용 가드", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막고 한국어로 안내한다", async () => {
    const res = await GET(makeRequest("10.0.0.7:3500", randomUUID()));

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });
});

describe("GET /api/publish-progress", () => {
  it("도는 게시가 없으면 조용히(200, progress: null) 응답한다", async () => {
    const res = await GET(makeRequest("localhost:3500", randomUUID()));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress).toBeNull();
  });

  it("도는 게시가 있으면 기록된 진행 상황을 그대로 돌려준다", async () => {
    const token = randomUUID();
    recordPublishProgress(token, { stage: "preparing", index: 3, total: 5 }, Date.now());

    const res = await GET(makeRequest("localhost:3500", token));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.progress).toEqual({ stage: "preparing", index: 3, total: 5 });
  });

  it("응답 바디에 토큰 값 자체는 담기지 않는다", async () => {
    const token = randomUUID();
    recordPublishProgress(token, { stage: "publishing" }, Date.now());

    const res = await GET(makeRequest("localhost:3500", token));

    const data = await res.json();
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("잘못된 형식의 토큰은 400으로 거부한다", async () => {
    const res = await GET(makeRequest("localhost:3500", "not-a-uuid"));

    expect(res.status).toBe(400);
  });

  it("토큰 파라미터가 아예 없으면 400으로 거부한다", async () => {
    const res = await GET(makeRequest("localhost:3500", null));

    expect(res.status).toBe(400);
  });
});
