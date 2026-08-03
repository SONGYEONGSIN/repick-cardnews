import { describe, it, expect, afterEach } from "vitest";
import { GET } from "./route";

const OLD_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...OLD_ENV };
});

function makeRequest(host: string) {
  return new Request(`http://${host}/api/topics-config`, { headers: { host } });
}

describe("GET /api/topics-config", () => {
  it("네이버 키가 있으면 true 를 주되 값 자체는 절대 담지 않는다", async () => {
    process.env.NAVER_CLIENT_ID = "super-secret-id";
    process.env.NAVER_CLIENT_SECRET = "super-secret-value";

    const res = await GET(makeRequest("localhost:3500"));
    const text = await res.text();

    expect(JSON.parse(text)).toEqual({ naverConfigured: true });
    expect(text).not.toContain("super-secret");
  });

  it("네이버 키가 없으면 false 다", async () => {
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;

    expect(await (await GET(makeRequest("localhost:3500"))).json()).toEqual({ naverConfigured: false });
  });

  it("한쪽만 있으면 false 다 — 반쪽 설정으로 렌즈를 열어 주면 100초 뒤에 실패한다", async () => {
    process.env.NAVER_CLIENT_ID = "id-only";
    delete process.env.NAVER_CLIENT_SECRET;

    expect(await (await GET(makeRequest("localhost:3500"))).json()).toEqual({ naverConfigured: false });
  });

  it("다른 기기에서는 403 이고 안내가 한국어다", async () => {
    const res = await GET(makeRequest("192.168.0.5:3500"));

    expect(res.status).toBe(403);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });
});
