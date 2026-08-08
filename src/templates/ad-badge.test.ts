import { describe, expect, it } from "vitest";
import { AD_BADGE_TEXT, adBadgeColor, showAdBadge } from "./ad-badge";

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

/**
 * 인스타는 캐러셀 **첫 장 우측 상단에 `1/4` 표시**를 얹는다 — 거기에 [광고]를 두면 가려진다
 * (참고 사진에서 실제로 겹쳤다, 2026-08-09). 그래서 여러 장일 때는 둘째 장부터 넣는다.
 *
 * 한 장짜리(정보전달)에는 그 표시가 없으므로 첫 장에 넣어야 한다 — 안 그러면 어디에도 안 붙는다.
 */
describe("showAdBadge", () => {
  it("꺼져 있으면 어디에도 안 붙는다", () => {
    expect(showAdBadge(false, 0, 1)).toBe(false);
    expect(showAdBadge(false, 3, 5)).toBe(false);
  });

  it("여러 장이면 첫 장을 건너뛴다 — 인스타 장수 표시에 가린다", () => {
    expect(showAdBadge(true, 0, 5)).toBe(false);
    expect(showAdBadge(true, 1, 5)).toBe(true);
    expect(showAdBadge(true, 4, 5)).toBe(true);
  });

  it("한 장짜리면 그 한 장에 붙는다 — 장수 표시가 없다", () => {
    expect(showAdBadge(true, 0, 1)).toBe(true);
  });
});
