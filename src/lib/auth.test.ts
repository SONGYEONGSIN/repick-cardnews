import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, isPublicPath, isUsablePassword, safeEqual, signSession, verifySession } from "./auth";

describe("isUsablePassword", () => {
  // 해시도 시도 제한도 없는 설계라 **길이가 유일한 방어**다. 그런데 그 전제를 코드가 확인하지
  // 않으면, 급할 때 짧은 값으로 바꿔 놓고 아무도 모르는 상태가 된다.
  it("기준 길이 미만은 거절한다", () => {
    expect(isUsablePassword("짧은값123")).toBe(false);
    expect(isUsablePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it("기준 길이 이상은 받는다", () => {
    expect(isUsablePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isUsablePassword("고양이가창문에서졸고있다")).toBe(true);
  });

  it("없거나 공백뿐이면 거절한다", () => {
    expect(isUsablePassword(undefined)).toBe(false);
    expect(isUsablePassword("")).toBe(false);
    expect(isUsablePassword(" ".repeat(MIN_PASSWORD_LENGTH + 5))).toBe(false);
  });

  it("기준은 12자다 — 낮추면 이 테스트가 먼저 깨진다", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});

describe("isPublicPath", () => {
  it("화면과 API 는 전부 막는다", () => {
    for (const p of ["/", "/info", "/settings", "/api/generate", "/api/publish", "/api/schedule"]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("인스타그램이 가져갈 이미지 경로는 연다", () => {
    expect(isPublicPath("/s/abc123/1.png")).toBe(true);
    expect(isPublicPath("/s/abc123")).toBe(true);
  });

  it("로그인 화면과 로그인 API 는 연다", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/login")).toBe(true);
  });

  // cron 서비스는 로그인할 수 없다. 대신 CRON_SECRET 이 막는다(`@/lib/cron-auth`).
  it("cron 입구는 연다", () => {
    expect(isPublicPath("/api/cron/tick")).toBe(true);
  });

  it("Next 정적 파일은 연다", () => {
    expect(isPublicPath("/_next/static/chunk.js")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
  });

  // 접두사만 보고 열면 `/s` 로 시작하는 다른 경로가 통째로 새어 나간다.
  it("공개 경로와 앞글자만 같은 경로는 막는다", () => {
    expect(isPublicPath("/slogan")).toBe(false);
    expect(isPublicPath("/settings/secret")).toBe(false);
    expect(isPublicPath("/loginhack")).toBe(false);
    expect(isPublicPath("/api/loginhack")).toBe(false);
    expect(isPublicPath("/api/cronhack")).toBe(false);
  });
});

describe("safeEqual", () => {
  it("같으면 참", () => {
    expect(safeEqual("동일한값", "동일한값")).toBe(true);
  });

  it("다르면 거짓", () => {
    expect(safeEqual("값1", "값2")).toBe(false);
  });

  it("길이가 달라도 거짓", () => {
    expect(safeEqual("짧다", "짧다더길다")).toBe(false);
    expect(safeEqual("", "무언가")).toBe(false);
  });
});

describe("세션 쿠키", () => {
  const secret = "테스트-비밀-키";

  it("서명한 것을 같은 비밀로 검증하면 통과한다", async () => {
    const token = await signSession(2_000, secret);
    expect(await verifySession(token, secret, 1_000)).toBe(true);
  });

  it("만료 시각을 지나면 거절한다", async () => {
    const token = await signSession(1_000, secret);
    expect(await verifySession(token, secret, 1_001)).toBe(false);
  });

  it("다른 비밀로 서명된 것은 거절한다", async () => {
    const token = await signSession(2_000, "다른-비밀");
    expect(await verifySession(token, secret, 1_000)).toBe(false);
  });

  // 만료 시각만 늘려 서명을 그대로 두는 시도.
  it("서명을 두고 만료만 늘린 것은 거절한다", async () => {
    const token = await signSession(1_000, secret);
    const forged = token.replace(/^\d+/, "9999999");
    expect(await verifySession(forged, secret, 1_001)).toBe(false);
  });

  it("쿠키가 없거나 모양이 아니면 거절한다", async () => {
    expect(await verifySession(undefined, secret, 1_000)).toBe(false);
    expect(await verifySession("", secret, 1_000)).toBe(false);
    expect(await verifySession("서명없음", secret, 1_000)).toBe(false);
    expect(await verifySession("abc.def", secret, 1_000)).toBe(false);
  });
});
