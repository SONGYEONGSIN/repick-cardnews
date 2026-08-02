import { describe, it, expect } from "vitest";
import { checkInstagramConfig } from "@/lib/instagram-config";

describe("checkInstagramConfig", () => {
  it("셋 다 있으면 게시 가능 상태와 설정값을 돌려준다", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({
        publicBaseUrl: "https://example.ngrok-free.app",
        businessAccountId: "17841400000000000",
        accessToken: "long-lived-secret-token",
      });
    }
  });

  it("다 없으면 세 항목 모두 빠졌다고 알려준다", () => {
    const result = checkInstagramConfig({});
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toHaveLength(3);
    }
  });

  it("토큰만 없으면 토큰 항목만 빠졌다고 알려준다", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
    });
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(["인스타그램 액세스 토큰(INSTAGRAM_ACCESS_TOKEN)"]);
    }
  });

  it("빈 문자열·공백만 있는 값은 없는 것으로 본다", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "   ",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(false);
  });

  it("missing 목록에는 사람이 읽을 한국어 이름만 담기고 값 자체는 없다", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
    });
    expect(JSON.stringify(result)).not.toContain("long-lived-secret-token");
  });
});
