import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { GET } from "@/app/api/publish-progress/route";
import { recordPublishProgress } from "@/lib/publish-progress-store";

/**
 * 로그인 판정은 미들웨어(`src/middleware.ts`)가 하고 그 로직은 `@/lib/auth.test.ts` 가
 * 덮는다. 여기서는 이 라우트 자신의 동작만 본다.
 */

function makeRequest(host: string, token: string | null): Request {
  const url = new URL("http://x/api/publish-progress");
  if (token !== null) url.searchParams.set("token", token);
  return new Request(url, { headers: { host } });
}

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
