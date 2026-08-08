import { describe, it, expect, vi, afterEach } from "vitest";
import { POST } from "@/app/api/instagram-verify/route";
import { InstagramApiError } from "@/lib/instagram";

/**
 * `verifyInstagramConnection()`·`friendlyVerifyError()` 자체 로직은
 * `@/lib/instagram.test.ts`가 촘촘히 덮는다 — 여기서는 이 라우트가 로컬 전용 가드를
 * 앞단에 붙였는지, 설정 없음/성공/실패를 올바른 상태 코드·모양으로 요약하는지만 본다.
 */
vi.mock("@/lib/instagram", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/instagram")>();
  return { ...actual, verifyInstagramConnection: vi.fn() };
});

import { verifyInstagramConnection } from "@/lib/instagram";

const ENV_KEYS = ["PUBLIC_BASE_URL", "INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_GRAPH_HOST"] as const;
function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}
function setReadyEnv() {
  process.env.PUBLIC_BASE_URL = "https://example.ngrok-free.app";
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";
  process.env.INSTAGRAM_ACCESS_TOKEN = "long-lived-secret-token";
}
afterEach(clearEnv);

function makeRequest(host: string): Request {
  return new Request("http://x/api/instagram-verify", { method: "POST", headers: { host } });
}

describe("POST /api/instagram-verify", () => {
  it("계정 ID·토큰이 없으면 400과 빠진 항목을 한국어로 알려준다", async () => {
    clearEnv();
    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("필요한 값");
  });

  it("공개 주소가 없어도 계정 ID·토큰만 있으면 연결 확인을 시도한다", async () => {
    clearEnv();
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841400000000000";
    process.env.INSTAGRAM_ACCESS_TOKEN = "long-lived-secret-token";
    vi.mocked(verifyInstagramConnection).mockResolvedValueOnce({ username: "repick_official" });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, username: "repick_official" });
  });

  it("연결에 성공하면 계정 이름을 200으로 돌려준다", async () => {
    setReadyEnv();
    vi.mocked(verifyInstagramConnection).mockResolvedValueOnce({ username: "repick_official" });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, username: "repick_official" });
  });

  it("토큰이 만료되면 502와 한국어 안내를 돌려주고 토큰 값을 담지 않는다", async () => {
    setReadyEnv();
    vi.mocked(verifyInstagramConnection).mockRejectedValueOnce(
      new InstagramApiError("HTTP 400", {
        error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190 },
      }),
    );

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("연결");
    expect(JSON.stringify(data)).not.toContain("long-lived-secret-token");
  });
});
