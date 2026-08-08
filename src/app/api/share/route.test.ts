import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/share/route";

/**
 * 로그인 판정은 미들웨어(`src/middleware.ts`)가 하고 그 로직은 `@/lib/auth.test.ts` 가
 * 덮는다. 여기서는 이 라우트 자신의 검증만 본다.
 */
function makeRequest(host: string, body: unknown): Request {
  return new Request("http://x/api/share", {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/share 기본 검증", () => {
  it("이미지가 없으면 400 과 한국어 사유로 거절한다", async () => {
    const res = await POST(makeRequest("localhost:3500", { keyword: "k", images: [] }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("이미지");
  });
});
