import { describe, it, expect } from "vitest";
import { assignLayouts, CARD_LAYOUTS, LAYOUT_LABELS } from "@/lib/layout-assign";

describe("assignLayouts", () => {
  it("5장이면 표지 full-bleed · 중간 split · 마지막 text-only", () => {
    expect(assignLayouts(5)).toEqual(["full-bleed", "split", "split", "split", "text-only"]);
  });
  it("6장도 같은 규칙을 따른다", () => {
    expect(assignLayouts(6)).toEqual(["full-bleed", "split", "split", "split", "split", "text-only"]);
  });
  it("2장이면 표지와 마무리만 남는다", () => {
    expect(assignLayouts(2)).toEqual(["full-bleed", "text-only"]);
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
