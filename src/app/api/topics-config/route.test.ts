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

    expect(JSON.parse(text)).toMatchObject({ naverConfigured: true });
    expect(text).not.toContain("super-secret");
  });

  it("네이버 키가 없으면 false 다", async () => {
    delete process.env.NAVER_CLIENT_ID;
    delete process.env.NAVER_CLIENT_SECRET;

    expect(await (await GET(makeRequest("localhost:3500"))).json()).toMatchObject({ naverConfigured: false });
  });

  it("한쪽만 있으면 false 다 — 반쪽 설정으로 렌즈를 열어 주면 100초 뒤에 실패한다", async () => {
    process.env.NAVER_CLIENT_ID = "id-only";
    delete process.env.NAVER_CLIENT_SECRET;

    expect(await (await GET(makeRequest("localhost:3500"))).json()).toMatchObject({ naverConfigured: false });
  });

  it("다른 기기에서는 403 이고 안내가 한국어다", async () => {
    const res = await GET(makeRequest("192.168.0.5:3500"));

    expect(res.status).toBe(403);
    expect(/[가-힣]/.test((await res.json()).error)).toBe(true);
  });
});

/**
 * 쿠팡도 선택이라 화면이 미리 알아야 한다 — 없는데 모드를 열어 두면 100초를 기다린 끝에
 * "설정이 없어요" 를 본다. **키 값 자체는 절대 내려주지 않는다.**
 */
describe("쿠팡 설정 여부", () => {
  it("두 키가 다 있으면 참이다", async () => {
    process.env.COUPANG_ACCESS_KEY = "AK";
    process.env.COUPANG_SECRET_KEY = "SK";

    const body = (await (await GET(makeRequest("localhost:3500"))).json()) as { coupangConfigured?: boolean };

    expect(body.coupangConfigured).toBe(true);
  });

  it("없으면 거짓이다", async () => {
    delete process.env.COUPANG_ACCESS_KEY;
    delete process.env.COUPANG_SECRET_KEY;

    const body = (await (await GET(makeRequest("localhost:3500"))).json()) as { coupangConfigured?: boolean };

    expect(body.coupangConfigured).toBe(false);
  });

  it("키 값을 응답에 담지 않는다", async () => {
    process.env.COUPANG_ACCESS_KEY = "SECRET-ACCESS";
    process.env.COUPANG_SECRET_KEY = "SECRET-SECRET";

    const text = await (await GET(makeRequest("localhost:3500"))).text();

    expect(text).not.toContain("SECRET-ACCESS");
    expect(text).not.toContain("SECRET-SECRET");
  });
});
