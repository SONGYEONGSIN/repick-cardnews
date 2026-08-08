import { describe, it, expect } from "vitest";
import { checkInstagramConfig, checkInstagramConnectionConfig } from "@/lib/instagram-config";

describe("checkInstagramConfig", () => {
  it("계정 ID·토큰이 있으면 게시 가능 상태와 설정값을 돌려준다(호스트는 기본값)", () => {
    const result = checkInstagramConfig({
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({
        businessAccountId: "17841400000000000",
        accessToken: "long-lived-secret-token",
        graphHost: "graph.instagram.com",
      });
    }
  });

  // 인스타그램이 우리 서버로 이미지를 가지러 오던 시절에는 공개 주소가 필수였다. 이제는
  // Blob 주소에서 직접 가져가므로(`@/lib/share-blob`) 우리 주소를 몰라도 게시할 수 있다.
  it("공개 주소가 없어도 게시할 수 있다 — 인스타그램은 Blob 에서 가져간다", () => {
    const result = checkInstagramConfig({
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
  });

  it("INSTAGRAM_GRAPH_HOST 를 주면 기본값 대신 그 값을 쓴다(로그인 방식이 다른 경우 대비)", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
      INSTAGRAM_GRAPH_HOST: "graph.facebook.com",
    });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config.graphHost).toBe("graph.facebook.com");
    }
  });

  it("호스트가 없어도 게시 가능 상태를 막지 않는다(필수 항목 아님)", () => {
    const result = checkInstagramConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
  });

  it("다 없으면 두 항목이 빠졌다고 알려준다", () => {
    const result = checkInstagramConfig({});
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toHaveLength(2);
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
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "   ",
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

/**
 * `checkInstagramConnectionConfig` — "연결 확인"(POST /api/instagram-verify)에 필요한 값만
 * 본다. 공개 주소(PUBLIC_BASE_URL)는 게시할 때만 필요하므로 이 함수의 판정에 전혀 영향을
 * 주지 않는다 — 그 독립성 자체를 "공개 주소만 없음" 케이스로 확인한다.
 */
describe("checkInstagramConnectionConfig", () => {
  it("계정 ID·토큰이 다 있으면 공개 주소가 있든 없든 연결 가능 상태를 돌려준다(셋 다 있음)", () => {
    const result = checkInstagramConnectionConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
    if (result.ready) {
      expect(result.config).toEqual({
        businessAccountId: "17841400000000000",
        accessToken: "long-lived-secret-token",
        graphHost: "graph.instagram.com",
      });
    }
  });

  it("공개 주소만 없어도 연결 가능 상태를 막지 않는다(연결엔 필요 없는 값)", () => {
    const result = checkInstagramConnectionConfig({
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(true);
  });

  it("토큰만 없으면 토큰 항목만 빠졌다고 알려준다", () => {
    const result = checkInstagramConnectionConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
    });
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(["인스타그램 액세스 토큰(INSTAGRAM_ACCESS_TOKEN)"]);
    }
  });

  it("계정 ID만 없으면 계정 ID 항목만 빠졌다고 알려준다", () => {
    const result = checkInstagramConnectionConfig({
      PUBLIC_BASE_URL: "https://example.ngrok-free.app",
      INSTAGRAM_ACCESS_TOKEN: "long-lived-secret-token",
    });
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual(["인스타그램 비즈니스 계정 ID(INSTAGRAM_BUSINESS_ACCOUNT_ID)"]);
    }
  });

  it("다 없으면 계정 ID·토큰 두 항목이 빠졌다고 알려준다(공개 주소는 대상 아님)", () => {
    const result = checkInstagramConnectionConfig({});
    expect(result.ready).toBe(false);
    if (!result.ready) {
      expect(result.missing).toEqual([
        "인스타그램 비즈니스 계정 ID(INSTAGRAM_BUSINESS_ACCOUNT_ID)",
        "인스타그램 액세스 토큰(INSTAGRAM_ACCESS_TOKEN)",
      ]);
    }
  });

  it("missing 목록에 토큰 값 자체는 담기지 않는다", () => {
    const result = checkInstagramConnectionConfig({
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "17841400000000000",
    });
    expect(JSON.stringify(result)).not.toContain("long-lived-secret-token");
  });
});
