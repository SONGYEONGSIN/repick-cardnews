import { describe, it, expect } from "vitest";
import { checkCoupangConfig, checkYoutubeConfig, checkNaverDatalabConfig, checkTopicsConfig } from "@/lib/topics-config";

describe("checkYoutubeConfig — 필수", () => {
  it("유튜브 키가 있으면 파이프라인을 시작할 수 있다", () => {
    const result = checkYoutubeConfig({ YOUTUBE_API_KEY: "yt-key" });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({ youtubeApiKey: "yt-key" });
    }
  });

  it("유튜브 키가 없으면 무엇이 없는지 한국어로 알려준다", () => {
    const result = checkYoutubeConfig({});
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(["유튜브 API 키(YOUTUBE_API_KEY)"]);
    }
  });

  it("공백만 있는 값은 없는 것으로 본다", () => {
    const result = checkYoutubeConfig({ YOUTUBE_API_KEY: "   " });
    expect(result.ready).toBe(false);
  });
});

describe("checkNaverDatalabConfig — 선택", () => {
  it("클라이언트 ID·시크릿이 둘 다 있으면 설정된 것으로 본다", () => {
    const result = checkNaverDatalabConfig({ NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" });
    expect(result.configured).toBe(true);
    if (result.configured) {
      expect(result.config).toEqual({ clientId: "id", clientSecret: "secret" });
    }
  });

  it("둘 다 없으면 설정 안 된 것으로 조용히 본다(오류 아님)", () => {
    const result = checkNaverDatalabConfig({});
    expect(result.configured).toBe(false);
  });

  it("하나만 있으면(부분 설정) 설정 안 된 것으로 본다 — 오타로 인한 차단을 피한다", () => {
    const result = checkNaverDatalabConfig({ NAVER_CLIENT_ID: "id" });
    expect(result.configured).toBe(false);
  });
});

describe("checkTopicsConfig — 합성", () => {
  it("유튜브 키만 있으면 데이터랩 없이도 ready:true, naver는 null이다", () => {
    const result = checkTopicsConfig({ YOUTUBE_API_KEY: "yt-key" });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({ youtubeApiKey: "yt-key", naver: null });
    }
  });

  it("유튜브 키·네이버 값이 다 있으면 naver 설정도 함께 담는다", () => {
    const result = checkTopicsConfig({
      YOUTUBE_API_KEY: "yt-key",
      NAVER_CLIENT_ID: "id",
      NAVER_CLIENT_SECRET: "secret",
    });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({
        youtubeApiKey: "yt-key",
        naver: { clientId: "id", clientSecret: "secret" },
      });
    }
  });

  it("유튜브 키가 없으면 네이버 값이 있어도 ready:false — 유튜브 키만 missing에 담긴다", () => {
    const result = checkTopicsConfig({ NAVER_CLIENT_ID: "id", NAVER_CLIENT_SECRET: "secret" });
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(["유튜브 API 키(YOUTUBE_API_KEY)"]);
    }
  });
});

/**
 * 쿠팡은 **선택**이다. 없으면 "요즘 잘 팔리는 것" 모드만 잠기고 나머지(유튜브·네이버)는
 * 그대로 돈다 — 하나가 없다고 소재 찾기 전체가 막히면 안 된다.
 */
describe("checkCoupangConfig", () => {
  it("두 키가 다 있으면 준비된 것이다", () => {
    const r = checkCoupangConfig({ COUPANG_ACCESS_KEY: "AK", COUPANG_SECRET_KEY: "SK" });
    expect(r.ready).toBe(true);
    expect(r.ready && r.config).toEqual({ accessKey: "AK", secretKey: "SK" });
  });

  it("하나만 있으면 없는 것으로 본다 — 반쪽으로는 서명을 못 만든다", () => {
    expect(checkCoupangConfig({ COUPANG_ACCESS_KEY: "AK" }).ready).toBe(false);
    expect(checkCoupangConfig({ COUPANG_SECRET_KEY: "SK" }).ready).toBe(false);
  });

  it("빈 값·공백은 없는 것으로 친다", () => {
    expect(checkCoupangConfig({ COUPANG_ACCESS_KEY: "  ", COUPANG_SECRET_KEY: "SK" }).ready).toBe(false);
  });

  it("무엇이 없는지 한국어로 말하고 키 이름을 알려 준다", () => {
    const r = checkCoupangConfig({});
    expect(r.ready).toBe(false);
    expect(r.ready === false && r.missing.join(" ")).toContain("COUPANG_ACCESS_KEY");
    expect(r.ready === false && /[가-힣]/.test(r.missing.join(" "))).toBe(true);
  });
})
