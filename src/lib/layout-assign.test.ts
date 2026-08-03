import { describe, it, expect } from "vitest";
import { assignLayouts, CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";

describe("assignLayouts", () => {
  // 예전에는 표지 full-bleed · 중간 split · 마지막 text-only 로 섞었다. 사용자가 "사진으로
  // 고정"을 요청해 전부 full-bleed 로 바꿨다(2026-08-04) — 사진이 카드뉴스의 축이고, 구성은
  // 툴바 '카드' 탭에서 카드마다 따로 바꿀 수 있다.
  it("전부 사진 전면이다", () => {
    expect(assignLayouts(5)).toEqual(["full-bleed", "full-bleed", "full-bleed", "full-bleed", "full-bleed"]);
  });
  it("장수가 달라도 같은 규칙이다", () => {
    expect(assignLayouts(6)).toEqual(Array.from({ length: 6 }, () => "full-bleed"));
    expect(assignLayouts(2)).toEqual(["full-bleed", "full-bleed"]);
  });
  it("1장이면 full-bleed 하나다", () => {
    expect(assignLayouts(1)).toEqual(["full-bleed"]);
  });
  it("0장이면 빈 배열이다", () => {
    expect(assignLayouts(0)).toEqual([]);
  });
});

describe("카탈로그", () => {
  it("레이아웃은 3종이다", () => {
    expect(CARD_LAYOUTS).toEqual(["full-bleed", "split", "text-only"]);
  });
  // 라벨은 편집 화면 세그먼트 컨트롤에 그대로 노출되는 사용자 대면 문자열이다.
  // 길이만 재면 전부 "x" 여도 통과하므로 리터럴로 대조한다.
  it("사용자에게 보이는 한국어 라벨이 정확하다", () => {
    expect(LAYOUT_LABELS).toEqual({
      "full-bleed": "사진 전면",
      split: "사진 + 글",
      "text-only": "글만",
    });
  });
});
