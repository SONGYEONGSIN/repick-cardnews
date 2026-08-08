import { describe, expect, it } from "vitest";
import { AD_BADGE_TEXT, adBadgeColor } from "./ad-badge";

describe("AD_BADGE_TEXT", () => {
  // 표시광고법이 요구하는 표기다. 마음대로 줄이거나 영어로 바꾸면 안 된다.
  it("대괄호를 두른 '광고' 다", () => {
    expect(AD_BADGE_TEXT).toBe("[광고]");
  });
});

describe("adBadgeColor", () => {
  const theme = { fg: "#111111", onPhoto: "#ffffff" };

  // 사진 위에서는 카드 글자색이 사진에 묻힌다 — 스크림 위에 얹는 색을 따로 쓴다.
  it("사진 위에서는 onPhoto 색을 쓴다", () => {
    expect(adBadgeColor(theme, true)).toBe("#ffffff");
  });

  it("사진이 없으면 본문 글자색을 쓴다", () => {
    expect(adBadgeColor(theme, false)).toBe("#111111");
  });
});
