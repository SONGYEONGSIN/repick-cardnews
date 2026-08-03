import { describe, it, expect } from "vitest";
import { createShareToken, isTokenExpired, SHARE_TOKEN_TTL_MS } from "@/lib/share-token";

describe("createShareToken", () => {
  it("호출할 때마다 다른 토큰을 만든다", () => {
    expect(createShareToken()).not.toBe(createShareToken());
  });

  it("추측 불가능한 형태(UUID)로 만든다", () => {
    expect(createShareToken()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("isTokenExpired", () => {
  const issuedAt = 1_700_000_000_000;

  it("발급 직후는 유효하다", () => {
    expect(isTokenExpired(issuedAt, issuedAt)).toBe(false);
  });

  it("유효 기간이 지나기 1ms 전까지는 유효하다", () => {
    expect(isTokenExpired(issuedAt, issuedAt + SHARE_TOKEN_TTL_MS - 1)).toBe(false);
  });

  it("경계값 — 정확히 유효 기간이 지난 시각은 무효로 본다", () => {
    expect(isTokenExpired(issuedAt, issuedAt + SHARE_TOKEN_TTL_MS)).toBe(true);
  });

  it("유효 기간을 지나면 무효다", () => {
    expect(isTokenExpired(issuedAt, issuedAt + SHARE_TOKEN_TTL_MS + 1)).toBe(true);
  });
});
