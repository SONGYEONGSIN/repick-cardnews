import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * `performRefresh`/`decideAutoRefresh` 자체 로직은
 * `@/lib/instagram-token-refresh(-runtime).test.ts`가 이미 촘촘히 덮는다 — 여기서는 이 라우트가
 * (POST) 로컬 전용 가드를 앞단에 붙였는지, 성공/실패를 올바른 상태 코드·모양으로 요약하는지,
 * (GET) 저장된 만료일을 그대로 읽기 전용으로 알려주는지만 본다.
 */
vi.mock("@/lib/instagram-token-refresh-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/instagram-token-refresh-runtime")>();
  return { ...actual, refreshInstagramTokenNow: vi.fn() };
});

import { GET, POST } from "@/app/api/instagram-refresh-token/route";
import { refreshInstagramTokenNow } from "@/lib/instagram-token-refresh-runtime";

const ENV_KEYS = ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_TOKEN_EXPIRES_AT"] as const;
function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}
afterEach(clearEnv);

function makeRequest(host: string): Request {
  return new Request("http://x/api/instagram-refresh-token", { method: "POST", headers: { host } });
}

describe("GET /api/instagram-refresh-token", () => {
  it("기록이 없으면 expiresAt:null을 돌려준다", async () => {
    clearEnv();
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ expiresAt: null, expired: false, daysRemaining: null });
  });

  it("만료됐으면 expired:true, daysRemaining:0을 돌려준다", async () => {
    clearEnv();
    process.env.INSTAGRAM_TOKEN_EXPIRES_AT = new Date(Date.now() - 1000).toISOString();
    const res = await GET();
    const data = await res.json();
    expect(data.expired).toBe(true);
    expect(data.daysRemaining).toBe(0);
  });

  it("아직 유효하면 expired:false와 남은 일수를 돌려준다", async () => {
    clearEnv();
    process.env.INSTAGRAM_TOKEN_EXPIRES_AT = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = await GET();
    const data = await res.json();
    expect(data.expired).toBe(false);
    expect(typeof data.daysRemaining).toBe("number");
    expect(data.daysRemaining).toBeGreaterThan(0);
  });
});

describe("POST /api/instagram-refresh-token", () => {
  it("집 네트워크 IP로 온 요청은 403으로 막는다", async () => {
    const res = await POST(makeRequest("192.168.0.5:3500"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("컴퓨터");
  });

  it("성공하면 새 만료일만 200으로 돌려준다(토큰 값은 담지 않는다)", async () => {
    const expiresAt = new Date("2026-10-03T04:00:00.000Z");
    vi.mocked(refreshInstagramTokenNow).mockResolvedValueOnce({ ok: true, expiresAt });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, expiresAt: expiresAt.toISOString() });
  });

  it("24시간 미만이면 502와 '정상' 뉘앙스의 한국어 안내를 돌려준다", async () => {
    vi.mocked(refreshInstagramTokenNow).mockResolvedValueOnce({ ok: false, reason: "too-soon" });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.reason).toBe("too-soon");
    expect(data.error).toContain("정상");
  });

  it("만료·무효 토큰이면 502와 대시보드 안내를 돌려준다", async () => {
    vi.mocked(refreshInstagramTokenNow).mockResolvedValueOnce({ ok: false, reason: "invalid-or-expired" });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain("instagram-setup.md");
  });

  it("설정 자체가 없으면 400을 돌려준다", async () => {
    vi.mocked(refreshInstagramTokenNow).mockResolvedValueOnce({ ok: false, reason: "config-missing" });

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(400);
  });

  it("예상 못한 예외가 나도 502와 일반 안내를 돌려준다(토큰 값 노출 없음)", async () => {
    vi.mocked(refreshInstagramTokenNow).mockRejectedValueOnce(new Error("boom"));

    const res = await POST(makeRequest("localhost:3500"));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });
});
